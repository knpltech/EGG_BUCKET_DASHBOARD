import { collectionDb, isCollectionConfigured } from "../config/collectionFirebase.js";
import { db } from "../config/firebase.js";

// In-memory cache for DeliveryMan collection
let deliveryManCache = null;
let lastCacheTime = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// In-memory cache for customers collection, keyed by date
let customersDateCache = {};
const CUSTOMERS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const RETAIL_ADMIN_API_URL = process.env.RETAIL_ADMIN_API_URL || "https://eggbucketretailadmin.onrender.com/api/admin";
const RETAIL_ADMIN_REQUEST_TIMEOUT_MS = 15_000;

let retailCustomersCache = null;
let retailCustomersCacheTime = 0;
let retailCustomersInFlightPromise = null;
const inventoryMetricsCache = new Map();
const inventoryMetricsInFlightPromises = new Map();

const emptySummary = () => ({
  salesQty: 0,
  cashPayment: 0,
  cashHandover: 0,
  digitalPayment: 0,
  totalAmount: 0,
  damage: 0,
  foodAllowance: 0,
  incentive: 0,
  salesPoint: 0,
  neccRate: 0,
});

const toNumber = (value) => {
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[₹,\s]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getNestedValue = (source, path) => {
  return path.split(".").reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, source);
};

const pickNumber = (source, paths) => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value === null || value === undefined || value === "") continue;

    if (typeof value === "object") {
      const nestedValue = value.total ?? value.amount ?? value.qty ?? value.quantity ?? value.count ?? value.value;
      const numeric = toNumber(nestedValue);
      if (numeric) return numeric;
      continue;
    }

    const numeric = toNumber(value);
    if (numeric) return numeric;
  }

  return 0;
};

const getSalesQuantity = (delivery) => {
  const directQty = pickNumber(delivery, [
    "nettSales.qty",
    "nettSales.quantity",
    "netSales.qty",
    "netSales.quantity",
    "salesQty",
    "salesQuantity",
    "totalSalesQty",
  ]);

  if (directQty) return directQty;

  return pickNumber(delivery, ["quantity", "trays", "nettSales.trays", "netSales.trays"]) * 30;
};

const getDamage = (delivery) => pickNumber(delivery, [
  "damage",
  "damages",
  "damageQty",
  "damageQuantity",
  "damageCount",
  "damagedQty",
  "damagedQuantity",
  "damagedEggQty",
  "damagedEggs",
  "brokenEggs",
  "breakage",
]);

const getCashHandover = (delivery) => pickNumber(delivery, [
  "cashHandover",
  "cashHandOver",
  "cash_handover",
  "cashHandoverAmount",
  "cashHandOverAmount",
  "handoverCash",
  "cashHandedOver",
  "cashSubmitted",
  "cashDeposit",
]);

const getAgentId = (delivery) =>
  delivery.agentId ?? delivery.agentID ?? delivery.agentUid ?? delivery.agentUID ?? delivery.deliveryAgentId;

const getFoodAllowance = (delivery) => pickNumber(delivery, [
  "foodAllowance",
  "foodAllowanceValue",
  "foodAllowanceQty",
  "food",
  "allowance.food",
  "allowances.food",
  "foodAllowanceAmount",
]);

const getIncentive = (delivery) => pickNumber(delivery, [
  "incentive",
  "incentives",
  "dailyIncentive",
  "incentiveAmount",
  "incentiveValue",
]);

const getSalesPoint = (delivery, customer) => pickNumber(delivery, [
  "salesPoint",
  "salePoint",
  "salespoint",
  "salesPointValue",
  "salePointValue",
  "rate",
  "neccRate",
]) || pickNumber(customer, [
  "salesPoint",
  "salePoint",
  "salespoint",
  "salesPointValue",
  "salePointValue",
  "rate",
  "neccRate",
]);

const normalizePersonName = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const isMatchingAgent = (agentName, outletContact) => {
  const agent = normalizePersonName(agentName);
  const contact = normalizePersonName(outletContact);
  if (!agent || !contact) return false;

  // The retail feed stores a shortened agent name (for example, "Tapas"),
  // while the outlet record can store the person's full name.
  return agent === contact || agent.startsWith(contact) || contact.startsWith(agent);
};

const normalizeOutletName = (value) => String(value || "")
  .toLowerCase()
  .replace(/eggbucket/g, "")
  .replace(/[^a-z0-9]/g, "")
  .trim();

const isMatchingOutlet = (value, outlet) => {
  const entryOutlet = normalizeOutletName(value);
  const selectedOutlet = normalizeOutletName(outlet);
  return Boolean(entryOutlet && selectedOutlet && (
    entryOutlet === selectedOutlet ||
    entryOutlet.includes(selectedOutlet) ||
    selectedOutlet.includes(entryOutlet)
  ));
};

const getRetailAdminToken = async () => {
  const configuredToken = String(process.env.RETAIL_ADMIN_TOKEN || "").trim();
  if (configuredToken) return configuredToken;

  const username = String(process.env.RETAIL_ADMIN_USERNAME || "").trim();
  const password = String(process.env.RETAIL_ADMIN_PASSWORD || "");
  if (!username || !password) throw new Error("Retail Admin credentials are not configured.");

  const response = await fetch(`${RETAIL_ADMIN_API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role: "admin" }),
    signal: AbortSignal.timeout(RETAIL_ADMIN_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Retail Admin login failed with status ${response.status}`);

  const data = await response.json();
  if (!data?.token) throw new Error("Retail Admin login did not return a token.");
  return data.token;
};

const getRetailCustomers = async () => {
  const now = Date.now();
  if (retailCustomersCache && now - retailCustomersCacheTime < CUSTOMERS_CACHE_TTL) {
    return retailCustomersCache;
  }
  if (retailCustomersInFlightPromise) return retailCustomersInFlightPromise;

  retailCustomersInFlightPromise = (async () => {
    const token = await getRetailAdminToken();
    const response = await fetch(`${RETAIL_ADMIN_API_URL}/user-info`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(RETAIL_ADMIN_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Retail Admin user-info failed with status ${response.status}`);

    const customers = await response.json();
    retailCustomersCache = Array.isArray(customers) ? customers : [];
    retailCustomersCacheTime = Date.now();
    return retailCustomersCache;
  })();

  try {
    return await retailCustomersInFlightPromise;
  } finally {
    retailCustomersInFlightPromise = null;
  }
};

const getInventoryMetrics = async (date) => {
  const cached = inventoryMetricsCache.get(date);
  if (cached && Date.now() - cached.time < CUSTOMERS_CACHE_TTL) return cached.data;
  if (inventoryMetricsInFlightPromises.has(date)) return inventoryMetricsInFlightPromises.get(date);

  const request = (async () => {
    const token = await getRetailAdminToken();
    const response = await fetch(
      `${RETAIL_ADMIN_API_URL}/inventory-metrics?date=${encodeURIComponent(date)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(RETAIL_ADMIN_REQUEST_TIMEOUT_MS),
      }
    );
    if (!response.ok) throw new Error(`Retail Admin inventory-metrics failed with status ${response.status}`);

    const data = await response.json();
    inventoryMetricsCache.set(date, { data, time: Date.now() });
    return data;
  })();
  inventoryMetricsInFlightPromises.set(date, request);

  try {
    return await request;
  } finally {
    inventoryMetricsInFlightPromises.delete(date);
  }
};

const getMetricAgentNamesForOutlet = (metrics, outlet) => [
  ...(metrics?.cashHandoverEntries || []),
  ...(metrics?.foodAllowanceEntries || []),
  ...(metrics?.incentiveEntries || []),
]
  .filter((entry) => isMatchingOutlet(entry?.outletName || entry?.outlet, outlet))
  .map((entry) => entry?.agentName)
  .filter(Boolean);

const applyInventoryMetrics = async (summary, outlet, date, suppliedMetrics) => {
  try {
    const metrics = suppliedMetrics || await getInventoryMetrics(date);
    const sumForOutlet = (entries, paths) => (Array.isArray(entries) ? entries : [])
      .filter((entry) => isMatchingOutlet(entry?.outletName || entry?.outlet, outlet))
      .reduce((total, entry) => total + pickNumber(entry, paths), 0);

    // These values come from the Retail Admin collection cards and must be
    // scoped by outlet, rather than using the API's date-wide totals.
    summary.damage = sumForOutlet(metrics.damageEntries, ["quantity", "damage", "damages"]);
    summary.cashHandover = sumForOutlet(metrics.cashHandoverEntries, ["cash", "amount", "value"]);
    summary.cashPayment = summary.cashHandover;
    summary.foodAllowance = sumForOutlet(metrics.foodAllowanceEntries, ["cash", "amount", "value"]);
    summary.incentive = sumForOutlet(metrics.incentiveEntries, ["cash", "amount", "value"]);
  } catch (error) {
    // Keep the rest of the entry form available if the supplementary Retail
    // metrics service is temporarily unavailable.
    console.error("Error fetching Retail Admin inventory metrics:", error.message);
  }

  return summary;
};

const getRetailSummary = async (outlet, date) => {
  const [outletByArea, outletByName] = await Promise.all([
    db.collection("outlets").where("area", "==", outlet).limit(1).get(),
    db.collection("outlets").where("name", "==", outlet).limit(1).get(),
  ]);
  const outletRecord = outletByArea.docs[0]?.data() || outletByName.docs[0]?.data();
  const outletContact = outletRecord?.contact;
  const [customers, metrics] = await Promise.all([getRetailCustomers(), getInventoryMetrics(date)]);
  const agentNames = [outletContact, ...getMetricAgentNamesForOutlet(metrics, outlet)]
    .filter((value) => normalizePersonName(value) && normalizePersonName(value) !== "-");
  if (agentNames.length === 0) return applyInventoryMetrics(emptySummary(), outlet, date, metrics);

  const summary = emptySummary();

  customers.forEach((customer) => {
    const dayData = customer?.last8Days?.[date];
    const deliveries = Array.isArray(dayData) ? dayData : [dayData];

    deliveries.filter(Boolean).forEach((delivery) => {
      if (delivery.status !== "delivered" || !agentNames.some((agent) => isMatchingAgent(delivery.agentName, agent))) return;

      summary.salesQty += getSalesQuantity(delivery);
      summary.cashHandover += getCashHandover(delivery);
      summary.digitalPayment += pickNumber(delivery, ["upiAmount", "digitalAmount", "upi", "totalUPI", "totalUpi"]);
      summary.totalAmount += pickNumber(delivery, ["totalAmount", "amount", "netAmount"]);
      summary.damage += getDamage(delivery);
      summary.foodAllowance += getFoodAllowance(delivery);
      summary.incentive += getIncentive(delivery);
      summary.salesPoint = summary.salesPoint || getSalesPoint(delivery, customer);
    });
  });

  summary.cashPayment = summary.cashHandover;
  // Retail's Sales Point is the amount collected per tray for this outlet.
  // Use an explicitly stored value when present; otherwise derive the same
  // value from the outlet's collected amount and delivered trays.
  if (!summary.salesPoint && summary.salesQty > 0) {
    summary.salesPoint = summary.totalAmount / (summary.salesQty / 30);
  }
  summary.neccRate = summary.salesPoint > 0 ? summary.salesPoint / 30 : 0;
  return applyInventoryMetrics(summary, outlet, date, metrics);
};

export const getOutletSummary = async (req, res) => {
  try {
    const { outlet, date } = req.query;

    if (!outlet || !date) {
      return res.status(400).json({ message: "outlet and date query parameters are required" });
    }

    if (!isCollectionConfigured) {
      return res.status(200).json(await getRetailSummary(outlet, date));
    }

    if (!collectionDb) {
      return res.status(500).json({ message: "Collection database is not configured." });
    }

    // 1. Fetch DeliveryMan collection (using cache if valid)
    const now = Date.now();
    if (!deliveryManCache || !lastCacheTime || now - lastCacheTime > CACHE_TTL) {
      try {
        const snapshot = await collectionDb.collection("DeliveryMan").get();
        deliveryManCache = snapshot.docs.map(doc => doc.data());
        lastCacheTime = now;
      } catch (err) {
        console.error("Error fetching DeliveryMan collection (Are credentials configured?):", err.message);
        return res.status(200).json(emptySummary());
      }
    }

    // 2. Find agents assigned to the selected outlet
    const searchOutletName = outlet.toLowerCase().replace(/eggbucket/g, "").trim();

    const assignedAgents = deliveryManCache
      .filter(agent => {
        if (!agent.outlet) return false;
        const agentOutletName = agent.outlet.toLowerCase().replace(/eggbucket/g, "").trim();
        return agentOutletName === searchOutletName || agentOutletName.includes(searchOutletName) || searchOutletName.includes(agentOutletName);
      })
      .map(agent => agent.uid ?? agent.id ?? agent.agentId ?? agent.agentID)
      .filter(Boolean);


    // If no agents assigned to this outlet, we can return early
    if (assignedAgents.length === 0) {
      return res.status(200).json(emptySummary());
    }

    // 3. Query customers collection efficiently using a targeted query for the specific date
    let customersForDate = [];
    const cacheEntry = customersDateCache[date];

    if (!cacheEntry || now - cacheEntry.time > CUSTOMERS_CACHE_TTL) {
      try {
        // Only fetch customers that actually have a delivered order on this specific date!
        // This drops the reads from ~393 down to just ~40!
        const snapshot = await collectionDb.collection("customers")
          .where(`last8Days.${date}.status`, "==", "delivered")
          .get();

        customersForDate = snapshot.docs.map(doc => doc.data());

        // Cache the specific date
        customersDateCache[date] = {
          data: customersForDate,
          time: now
        };
      } catch (err) {
        console.error("Error fetching customers collection for date:", err.message);
        return res.status(200).json(emptySummary());
      }
    } else {
      customersForDate = cacheEntry.data;
    }

    let salesQty = 0;
    let cashPayment = 0;
    let cashHandover = 0;
    let digitalPayment = 0;
    let totalAmount = 0;
    let damage = 0;
    let foodAllowance = 0;
    let incentive = 0;
    let salesPoint = 0;

    // 4. Calculate summary
    customersForDate.forEach(data => {
      if (!data.last8Days) return;

      const dayData = data.last8Days[date];
      if (!dayData) return;

      const deliveries = Array.isArray(dayData) ? dayData : [dayData];

      deliveries.forEach(delivery => {
        if (delivery.status === "delivered") {
          // Match agentId against delivery agents belonging to the selected outlet
          if (assignedAgents.includes(getAgentId(delivery))) {
            salesQty += getSalesQuantity(delivery);
            cashHandover += getCashHandover(delivery);
            digitalPayment += pickNumber(delivery, ["upiAmount", "digitalAmount", "upi", "totalUPI", "totalUpi"]);
            totalAmount += pickNumber(delivery, ["totalAmount", "amount", "netAmount"]);
            damage += getDamage(delivery);
            foodAllowance += getFoodAllowance(delivery);
            incentive += getIncentive(delivery);
            salesPoint = salesPoint || getSalesPoint(delivery, data);
          }
        }
      });
    });

    if (!salesPoint && salesQty > 0) {
      salesPoint = totalAmount / (salesQty / 30);
    }
    const neccRate = salesPoint > 0 ? salesPoint / 30 : 0;

    // 5. Return JSON payload
    const summary = {
      salesQty,
      cashPayment: cashHandover,
      cashHandover,
      digitalPayment,
      totalAmount,
      damage,
      foodAllowance,
      incentive,
      salesPoint,
      neccRate
    };

    return res.status(200).json(await applyInventoryMetrics(summary, outlet, date));

  } catch (error) {
    console.error("Error in getOutletSummary:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
