import { collectionDb, isCollectionConfigured } from "../config/collectionFirebase.js";

// In-memory cache for DeliveryMan collection
let deliveryManCache = null;
let lastCacheTime = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// In-memory cache for customers collection, keyed by date
let customersDateCache = {};
const CUSTOMERS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const getOutletSummary = async (req, res) => {
  try {
    const { outlet, date } = req.query;

    if (!outlet || !date) {
      return res.status(400).json({ message: "outlet and date query parameters are required" });
    }

    if (!collectionDb) {
      return res.status(500).json({ message: "Collection database is not configured." });
    }

    if (!isCollectionConfigured) {
      return res.status(200).json({ salesQty: 0, cashPayment: 0, digitalPayment: 0, totalAmount: 0 });
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
        return res.status(200).json({ salesQty: 0, cashPayment: 0, digitalPayment: 0, totalAmount: 0 });
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
      .map(agent => agent.uid);


    // If no agents assigned to this outlet, we can return early
    if (assignedAgents.length === 0) {
      return res.status(200).json({
        salesQty: 0,
        cashPayment: 0,
        digitalPayment: 0,
        totalAmount: 0
      });
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
        return res.status(200).json({ salesQty: 0, cashPayment: 0, digitalPayment: 0, totalAmount: 0 });
      }
    } else {
      customersForDate = cacheEntry.data;
    }

    let salesQty = 0;
    let cashPayment = 0;
    let digitalPayment = 0;
    let totalAmount = 0;

    // 4. Calculate summary
    customersForDate.forEach(data => {
      if (!data.last8Days) return;

      const dayData = data.last8Days[date];
      if (!dayData) return;

      const deliveries = Array.isArray(dayData) ? dayData : [dayData];

      deliveries.forEach(delivery => {
        if (delivery.status === "delivered") {
          // Match agentId against delivery agents belonging to the selected outlet
          if (assignedAgents.includes(delivery.agentId)) {
            salesQty += (delivery.quantity || 0) * 30; // Multiply by 30 as requested
            cashPayment += delivery.cashAmount || 0;
            digitalPayment += delivery.upiAmount || delivery.digitalAmount || 0; // Check upiAmount or digitalAmount
            totalAmount += delivery.totalAmount || 0;
          }
        }
      });
    });

    // 5. Return JSON payload
    return res.status(200).json({
      salesQty,
      cashPayment,
      digitalPayment,
      totalAmount
    });

  } catch (error) {
    console.error("Error in getOutletSummary:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
