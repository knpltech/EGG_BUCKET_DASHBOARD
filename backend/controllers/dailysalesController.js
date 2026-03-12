// PATCH controller to update a daily sales entry by ID
export const updateDailySales = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const docRef = db.collection("dailySales").doc(id);
    
    // Use set with merge instead of update + get for faster operation
    await docRef.set({ ...updateData, updatedAt: new Date() }, { merge: true });
    
    res.status(200).json({ id, ...updateData, message: "Updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating daily sales", error: error.message });
  }
};
import { db } from "../config/firebase.js";

// Add a new daily sales entry to Firestore
// If an entry already exists for the date, merge the outlet data instead of creating a new one
export const addDailySales = async (req, res) => {
  try {
    const { date, outlets, total, addedBy } = req.body;
    if (!date || !outlets || typeof outlets !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }
    
    // Prepare outlets data
    const outletsWithDup = { ...outlets };
    
    // Check if an entry already exists for this date
    const existingSnapshot = await db.collection("dailySales")
      .where("date", "==", date)
      .limit(1)
      .get();
      
    if (!existingSnapshot.empty) {
      // Merge with existing entry - combine outlets objects
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const mergedOutlets = { ...existingData.outlets, ...outletsWithDup };
      // Recalculate total from merged outlets
      const mergedTotal = Object.values(mergedOutlets).reduce((sum, val) => sum + (Number(val) || 0), 0);
      
      // Track who updated it - store per outlet
      const updatedData = {
        outlets: mergedOutlets,
        total: mergedTotal,
        updatedAt: new Date(),
      };
      
      // Store addedBy info per outlet (not as array anymore)
      if (addedBy) {
        const addedByPerOutlet = existingData.addedByPerOutlet || {};
        // Find which outlet this addedBy info corresponds to
        Object.keys(outlets).forEach(outletKey => {
          if (outlets[outletKey] !== undefined) {
            addedByPerOutlet[outletKey] = {
              username: addedBy.username,
              zone: addedBy.zone,
              role: addedBy.role,
              timestamp: addedBy.timestamp
            };
          }
        });
        updatedData.addedByPerOutlet = addedByPerOutlet;
      }
      
      await existingDoc.ref.update(updatedData);
      
      res.status(200).json({ id: existingDoc.id, message: "Daily sales merged with existing entry", merged: true });
    } else {
      // Calculate total from outlets
      const calculatedTotal = Object.values(outletsWithDup).reduce((sum, val) => sum + (Number(val) || 0), 0);
      const docData = {
        date,
        outlets: outletsWithDup,
        total: calculatedTotal,
        createdAt: new Date(),
      };
      
      // Store addedBy info per outlet
      if (addedBy) {
        const addedByPerOutlet = {};
        Object.keys(outletsWithDup).forEach(outletKey => {
          addedByPerOutlet[outletKey] = {
            username: addedBy.username,
            zone: addedBy.zone,
            role: addedBy.role,
            timestamp: addedBy.timestamp
          };
        });
        docData.addedByPerOutlet = addedByPerOutlet;
      }
      
      const docRef = await db.collection("dailySales").add(docData);
      res.status(201).json({ id: docRef.id, message: "Daily sales recorded" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error adding daily sales", error: error.message });
  }
};

// Get all daily sales entries from Firestore
export const getAllDailySales = async (req, res) => {
  try {
    const snapshot = await db.collection("dailySales").orderBy("date", "desc").get();
    const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: "Error fetching daily sales", error: error.message });
  }
};

// Delete all daily sales entries for a specific date (admin only)
export const deleteDailySalesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }
    
    const snapshot = await db.collection("dailySales")
      .where("date", "==", date)
      .get();
    
    let deletedCount = 0;
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    await batch.commit();
    res.status(200).json({ message: `Deleted ${deletedCount} entry(ies) for date ${date}`, count: deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Error deleting daily sales", error: error.message });
  }
};
