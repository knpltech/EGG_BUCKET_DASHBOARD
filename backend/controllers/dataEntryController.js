import { db } from "../config/firebase.js";

// Simple outlet cache to avoid repeated lookups
const outletCache = new Map();

// Helper function to get outlet area/name from outlet ID (with caching)
const getOutletInfo = async (outletId) => {
  // Check cache first
  if (outletCache.has(outletId)) {
    return outletCache.get(outletId);
  }
  
  try {
    const doc = await db.collection("outlets").doc(outletId).get();
    if (doc.exists) {
      const data = doc.data();
      const info = { area: data.area || data.name, name: data.name };
      outletCache.set(outletId, info); // Cache for future use
      return info;
    }
    // If not found by ID, it might be the name itself
    const info = { area: outletId, name: outletId };
    outletCache.set(outletId, info);
    return info;
  } catch (err) {
    return { area: outletId, name: outletId };
  }
};

// Helper function to merge outlet data into existing date entry
const mergeToCollection = async (collectionName, date, outletKey, value, fieldName = "outlets") => {
  const existingSnapshot = await db.collection(collectionName)
    .where("date", "==", date)
    .limit(1)
    .get();
  
  if (!existingSnapshot.empty) {
    const existingDoc = existingSnapshot.docs[0];
    const existingData = existingDoc.data();
    const mergedData = { ...existingData[fieldName], [outletKey]: value };
    const mergedTotal = Object.values(mergedData).reduce((sum, val) => sum + (Number(val) || 0), 0);
    
    await existingDoc.ref.update({
      [fieldName]: mergedData,
      total: mergedTotal,
      updatedAt: new Date(),
    });
    return { id: existingDoc.id, merged: true };
  } else {
    const docRef = await db.collection(collectionName).add({
      date,
      [fieldName]: { [outletKey]: value },
      total: Number(value) || 0,
      createdAt: new Date(),
    });
    return { id: docRef.id, merged: false };
  }
};

// Add a new data entry - stores to multiple collections (OPTIMIZED with parallel operations)
export const addDataEntry = async (req, res) => {
  try {
    const { 
      outletId, 
      date, 
      salesQty, 
      neccRate, 
      dailyDamage, 
      digitalPayment, 
      cashPayment,
      totalSalesAmount,
      totalReceivedAmount,
      differenceAmount
    } = req.body;
    
    if (!outletId || !date) {
      return res.status(400).json({ message: "Outlet and date are required" });
    }
    
    // Run initial queries in PARALLEL
    const [outletInfo, existingEntrySnap] = await Promise.all([
      getOutletInfo(outletId),
      db.collection("dataEntries")
        .where("outletId", "==", outletId)
        .where("date", "==", date)
        .limit(1)
        .get()
    ]);
    
    const outletKey = outletInfo.area;
    
    if (!existingEntrySnap.empty) {
      return res.status(400).json({ message: "Entry already exists for this outlet and date" });
    }
    
    // Prepare all merge operations to run in PARALLEL
    const mergePromises = [];
    const resultKeys = [];
    
    // 1. Daily Sales (quantity)
    if (salesQty && Number(salesQty) > 0) {
      mergePromises.push(mergeToCollection("dailySales", date, outletKey, Number(salesQty)));
      resultKeys.push("dailySales");
    }
    
    // 2. Daily Damages
    if (dailyDamage && Number(dailyDamage) > 0) {
      mergePromises.push(mergeToCollection("dailyDamages", date, outletKey, Number(dailyDamage), "damages"));
      resultKeys.push("dailyDamages");
    }
    
    // 3. Digital Payments
    if (digitalPayment && Number(digitalPayment) > 0) {
      mergePromises.push(mergeToCollection("digitalPayments", date, outletKey, Number(digitalPayment)));
      resultKeys.push("digitalPayments");
    }
    
    // 4. Cash Payments
    if (cashPayment && Number(cashPayment) > 0) {
      mergePromises.push(mergeToCollection("cashPayments", date, outletKey, Number(cashPayment), "outlets"));
      resultKeys.push("cashPayments");
    }
    
    // 5. NECC Rate - handled separately due to different logic
    let neccRateResult = null;
    if (neccRate && Number(neccRate) > 0 && outletId) {
      mergePromises.push(
        db.collection("neccRates")
          .where("date", "==", date)
          .where("outletId", "==", outletId)
          .limit(1)
          .get()
          .then(async (existingRate) => {
            if (existingRate.empty) {
              const rateDoc = await db.collection("neccRates").add({
                date,
                outletId,
                rate: `₹${Number(neccRate).toFixed(2)} per egg`,
                rateValue: Number(neccRate),
                createdAt: new Date(),
              });
              return { id: rateDoc.id, created: true };
            } else {
              return { id: existingRate.docs[0].id, exists: true };
            }
          })
      );
      resultKeys.push("neccRate");
    }
    
    // 6. Create main dataEntry document (add to parallel batch)
    const entryData = {
      outletId,
      outletName: outletInfo.name,
      outletArea: outletInfo.area,
      date,
      salesQty: Number(salesQty) || 0,
      neccRate: Number(neccRate) || 0,
      dailyDamage: Number(dailyDamage) || 0,
      digitalPayment: Number(digitalPayment) || 0,
      cashPayment: Number(cashPayment) || 0,
      totalSalesAmount: Number(totalSalesAmount) || 0,
      totalReceivedAmount: Number(totalReceivedAmount) || 0,
      differenceAmount: Number(differenceAmount) || 0,
      createdAt: new Date(),
    };
    mergePromises.push(db.collection("dataEntries").add(entryData));
    resultKeys.push("dataEntry");
    
    // Execute ALL operations in PARALLEL
    const parallelResults = await Promise.all(mergePromises);
    
    // Build results object
    const results = {};
    resultKeys.forEach((key, idx) => {
      results[key] = parallelResults[idx];
    });
    
    const entryRef = results.dataEntry;
    
    res.status(201).json({ 
      id: entryRef.id, 
      message: "Data entry saved successfully",
      results 
    });
  } catch (error) {
    console.error("Error adding data entry:", error);
    res.status(500).json({ message: "Error adding data entry", error: error.message });
  }
};

// Get all data entries
export const getAllDataEntries = async (req, res) => {
  try {
    const snapshot = await db.collection("dataEntries").orderBy("date", "desc").get();
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(entries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching data entries", error: error.message });
  }
};

// Get data entries by outlet
export const getDataEntriesByOutlet = async (req, res) => {
  try {
    const { outletId } = req.params;
    const snapshot = await db.collection("dataEntries")
      .where("outletId", "==", outletId)
      .orderBy("date", "desc")
      .get();
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(entries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching data entries", error: error.message });
  }
};

// Get data entries by date
export const getDataEntriesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const snapshot = await db.collection("dataEntries")
      .where("date", "==", date)
      .get();
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(entries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching data entries", error: error.message });
  }
};
