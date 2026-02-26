import { db } from "../config/firebase.js";

// Helper function to get outlet area/name from outlet ID
const getOutletInfo = async (outletId) => {
  try {
    const doc = await db.collection("outlets").doc(outletId).get();
    if (doc.exists) {
      const data = doc.data();
      return { area: data.area || data.name, name: data.name };
    }
    // If not found by ID, it might be the name itself
    return { area: outletId, name: outletId };
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

// Add a new data entry - stores to multiple collections
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
    
    // Get outlet area/name for storing in other collections
    const outletInfo = await getOutletInfo(outletId);
    const outletKey = outletInfo.area;
    
    // Check if entry already exists for this outlet + date
    const existingEntry = await db.collection("dataEntries")
      .where("outletId", "==", outletId)
      .where("date", "==", date)
      .limit(1)
      .get();
    
    if (!existingEntry.empty) {
      return res.status(400).json({ message: "Entry already exists for this outlet and date" });
    }
    
    // Store to respective collections
    const results = {};
    
    // 1. Daily Sales (quantity)
    if (salesQty && Number(salesQty) > 0) {
      results.dailySales = await mergeToCollection("dailySales", date, outletKey, Number(salesQty));
    }
    
    // 2. Daily Damages
    if (dailyDamage && Number(dailyDamage) > 0) {
      results.dailyDamages = await mergeToCollection("dailyDamages", date, outletKey, Number(dailyDamage), "damages");
    }
    
    // 3. Digital Payments
    if (digitalPayment && Number(digitalPayment) > 0) {
      results.digitalPayments = await mergeToCollection("digitalPayments", date, outletKey, Number(digitalPayment));
    }
    
    // 4. Cash Payments
    if (cashPayment && Number(cashPayment) > 0) {
      console.log("Saving cash payment:", { date, outletKey, cashPayment: Number(cashPayment) });
      results.cashPayments = await mergeToCollection("cashPayments", date, outletKey, Number(cashPayment), "outlets");
      console.log("Cash payment result:", results.cashPayments);
    }
    
    // 5. NECC Rate - Store to neccRates collection
    if (neccRate && Number(neccRate) > 0) {
      // Require outletId for NECC rate
      if (!outletId) {
        results.neccRate = { error: 'Missing outletId for NECC rate' };
      } else {
        // Check if NECC rate already exists for this date and outlet
        const existingRate = await db.collection("neccRates")
          .where("date", "==", date)
          .where("outletId", "==", outletId)
          .limit(1)
          .get();
        if (existingRate.empty) {
          // Create new NECC rate entry for this date and outlet
          const rateDoc = await db.collection("neccRates").add({
            date,
            outletId,
            rate: `₹${Number(neccRate).toFixed(2)} per egg`,
            rateValue: Number(neccRate),
            createdAt: new Date(),
          });
          results.neccRate = { id: rateDoc.id, created: true };
        } else {
          // NECC rate already exists for this date and outlet
          results.neccRate = { id: existingRate.docs[0].id, exists: true };
        }
      }
    }
    
    // 6. Store combined entry in dataEntries collection (for lock feature)
    const entryRef = await db.collection("dataEntries").add({
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
    });
    
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
