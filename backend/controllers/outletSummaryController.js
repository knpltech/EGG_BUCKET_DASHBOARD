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

const queryFirestoreCollectionByDateKey = async (targetDb, collectionName, dateKey) => {
  if (!targetDb) return [];
  try {
    const snapshot = await targetDb.collection(collectionName).where("dateKey", "==", dateKey).get();
    return snapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.warn(`Could not query ${collectionName} by dateKey in Firestore:`, err.message);
    return [];
  }
};

const fetchFirestoreInventoryMetrics = async (targetDb, date) => {
  const [foodEntries, cashEntries, damageEntries, incentiveEntries] = await Promise.all([
    queryFirestoreCollectionByDateKey(targetDb, "food_allowance_entries", date),
    queryFirestoreCollectionByDateKey(targetDb, "cash_handover_entries", date),
    queryFirestoreCollectionByDateKey(targetDb, "damage_reports", date),
    queryFirestoreCollectionByDateKey(targetDb, "incentive_entries", date),
  ]);
  return {
    foodAllowanceEntries: foodEntries,
    cashHandoverEntries: cashEntries,
    damageEntries: damageEntries,
    incentiveEntries: incentiveEntries,
  };
};

const getMetricAgentNamesForOutlet = (metrics, outlet) => [
  ...(metrics?.cashHandoverEntries || []),
  ...(metrics?.foodAllowanceEntries || []),
  ...(metrics?.incentiveEntries || []),
  ...(metrics?.damageEntries || []),   // also check damage entries (may exist even when cash/food/incentive = 0)
]
  .filter((entry) => isMatchingOutlet(entry?.outletName || entry?.outlet, outlet))
  .map((entry) => entry?.agentName)
  .filter(Boolean);

const applyInventoryMetrics = async (summary, outlet, date, suppliedMetrics) => {
  try {
    let metrics = suppliedMetrics;
    if (!metrics) {
      if (collectionDb) {
        const fsMetrics = await fetchFirestoreInventoryMetrics(collectionDb, date);
        if (fsMetrics.foodAllowanceEntries.length || fsMetrics.cashHandoverEntries.length || fsMetrics.damageEntries.length || fsMetrics.incentiveEntries.length) {
          metrics = fsMetrics;
        }
      }
      if (!metrics && db) {
        const fsMetrics = await fetchFirestoreInventoryMetrics(db, date);
        if (fsMetrics.foodAllowanceEntries.length || fsMetrics.cashHandoverEntries.length || fsMetrics.damageEntries.length || fsMetrics.incentiveEntries.length) {
          metrics = fsMetrics;
        }
      }
      if (!metrics) {
        metrics = await getInventoryMetrics(date);
      }
    }

    // Digital Payment must reflect what was actually handed over as UPI, not
    // the total UPI collected in customer deliveries. Firestore metric
    // snapshots may not include this collection, so obtain this specific
    // value from the Retail Admin metrics API when necessary.
    if (!Array.isArray(metrics?.upiHandoverEntries)) {
      const retailMetrics = await getInventoryMetrics(date);
      metrics = {
        ...metrics,
        upiHandoverEntries: retailMetrics?.upiHandoverEntries || [],
      };
    }

    const sumForOutlet = (entries, paths) => (Array.isArray(entries) ? entries : [])
      .filter((entry) => isMatchingOutlet(entry?.outletName || entry?.outlet, outlet))
      .reduce((total, entry) => total + pickNumber(entry, paths), 0);

    summary.damage = sumForOutlet(metrics.damageEntries, ["quantity", "damage", "damages", "Cash", "cash"]);
    summary.cashHandover = sumForOutlet(metrics.cashHandoverEntries, ["Cash", "cash", "amount", "value"]);
    summary.cashPayment = summary.cashHandover;
    summary.foodAllowance = sumForOutlet(metrics.foodAllowanceEntries, ["Cash", "cash", "amount", "value"]);
    summary.incentive = sumForOutlet(metrics.incentiveEntries, ["Cash", "cash", "amount", "value"]);
    summary.digitalPayment = sumForOutlet(metrics.upiHandoverEntries, ["Cash", "cash", "amount", "value"]);
  } catch (error) {
    console.error("Error fetching inventory metrics:", error.message);
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

  // When no agent contact is configured for the outlet (e.g. Kudlu Gate has no
  // "contact" field in Firestore and no entries in the inventory metrics API),
  // fall back to matching deliveries directly by outlet name embedded in the
  // delivery / customer record. This avoids silently returning all zeros.
  const hasAgentNames = agentNames.length > 0;

  const summary = emptySummary();

  customers.forEach((customer) => {
    const dayData = customer?.last8Days?.[date];
    const deliveries = Array.isArray(dayData) ? dayData : [dayData];

    deliveries.filter(Boolean).forEach((delivery) => {
      if (delivery.status !== "delivered") return;

      if (hasAgentNames) {
        // Primary match: by agent name
        if (!agentNames.some((agent) => isMatchingAgent(delivery.agentName, agent))) return;
      } else {
        // Fallback match: by outlet name in the delivery or customer record
        const deliveryOutlet =
          delivery.outletName || delivery.outlet ||
          customer.outletName || customer.outlet || "";
        if (!deliveryOutlet || !isMatchingOutlet(deliveryOutlet, outlet)) return;
      }

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
      try {
        return res.status(200).json(await getRetailSummary(outlet, date));
      } catch (error) {
        console.error("Retail Admin outlet summary unavailable:", error.message);
        return res.status(200).json(emptySummary());
      }
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
    // Normalize to alphanumeric-only for robust matching.
    // Handles variations like "Kudlu Gate", "KudluGate", "kudlu-gate", "KUDLU GATE" etc.
    const normalizeOutletKey = (name) => String(name || "")
      .toLowerCase()
      .replace(/eggbucket/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
    const searchOutletKey = normalizeOutletKey(outlet);

    const matchingOutletAgents = deliveryManCache
      .filter(agent => {
        if (!agent.outlet) return false;
        const agentKey = normalizeOutletKey(agent.outlet);
        return agentKey === searchOutletKey
          || agentKey.includes(searchOutletKey)
          || searchOutletKey.includes(agentKey);
      });

    const assignedAgents = matchingOutletAgents
      .map(agent => agent.uid ?? agent.id ?? agent.agentId ?? agent.agentID)
      .filter(Boolean);

    // Some retail deliveries retain a former customer's assignment/route but
    // record the actual delivery under the current agent's name. Match that
    // name too, so an outdated assignment cannot hide a valid outlet sale.
    const assignedAgentNames = matchingOutletAgents
      .map(agent => agent.agentName ?? agent.name ?? agent.fullName ?? agent.displayName ?? agent.username)
      .filter(name => normalizePersonName(name) && normalizePersonName(name) !== "-");


    const hasAssignedAgents = assignedAgents.length > 0 || assignedAgentNames.length > 0;

    // 3. Query customers collection efficiently using a targeted query for the specific date
    let customersForDate = [];
    const cacheEntry = customersDateCache[date];

    if (!cacheEntry || now - cacheEntry.time > CUSTOMERS_CACHE_TTL) {
      try {
        // Fetch all customers and filter in code.
        // The previous approach used a nested-field Firestore query
        // (.where(`last8Days.${date}.status`, "==", "delivered")) which only
        // works when the day's delivery is stored as a plain object. Some
        // outlets (e.g. Kudlu Gate) store deliveries as an ARRAY, making the
        // nested-field query silently return 0 results for those outlets.
        // Fetching all docs and filtering in code handles both formats.
        const allSnapshot = await collectionDb.collection("customers").get();
        customersForDate = allSnapshot.docs
          .map(doc => doc.data())
          .filter(data => {
            const dayData = data.last8Days?.[date];
            if (!dayData) return false;
            const deliveries = Array.isArray(dayData) ? dayData : [dayData];
            return deliveries.some(d => d?.status === "delivered");
          });

        customersDateCache[date] = {
          data: customersForDate,
          time: now,
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
          // DeliveryMan IDs can be absent or stale for an outlet.  A delivery
          // explicitly tagged with the selected outlet is equally authoritative,
          // so retain it even when DeliveryMan has a different mapping.
          const deliveryOutlet = delivery.outletName || delivery.outlet || data.outletName || data.outlet || "";
          const matchesOutlet = Boolean(deliveryOutlet && isMatchingOutlet(deliveryOutlet, outlet));
          const matchesAssignedAgent = hasAssignedAgents && (
            assignedAgents.includes(getAgentId(delivery)) ||
            assignedAgentNames.some(name => isMatchingAgent(delivery.agentName, name))
          );
          const isMatch = matchesAssignedAgent || matchesOutlet;

          if (isMatch) {
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

    const summaryWithMetrics = await applyInventoryMetrics(summary, outlet, date);

    // DeliveryMan assignments can lag behind the Retail Admin application.
    // In that state a valid delivery (such as Kudlu's KRISHNA entry) has no
    // usable outlet field or current assignment in this Firebase collection.
    // The retail feed has the authoritative agent name, so use it only when
    // the collection lookup produced no data at all.
    const hasCollectionData = Object.values(summaryWithMetrics)
      .some((value) => Number(value) !== 0);

    if (!hasCollectionData) {
      try {
        const retailSummary = await getRetailSummary(outlet, date);
        const hasRetailData = Object.values(retailSummary)
          .some((value) => Number(value) !== 0);
        if (hasRetailData) return res.status(200).json(retailSummary);
      } catch (error) {
        // Preserve the existing zero summary if the optional retail service is
        // unavailable; this endpoint must remain usable for all outlets.
        console.error("Retail Admin fallback unavailable:", error.message);
      }
    }

    return res.status(200).json(summaryWithMetrics);

  } catch (error) {
    console.error("Error in getOutletSummary:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Reuse the exact same source calculation outside HTTP handlers (the nightly
// final-save job uses this instead of inventing zero-value defaults).
export const getSourceOutletSummary = async (outlet, date) => {
  let statusCode = 500;
  let payload;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return data;
    },
  };

  await getOutletSummary({ query: { outlet, date } }, response);

  if (statusCode < 200 || statusCode >= 300 || !payload || payload.message) {
    throw new Error(payload?.message || `Source summary failed with status ${statusCode}`);
  }
  return payload;
};
