

import { db } from "../config/firebase.js";

// Add a new DailyDamage entry to Firestore
// If an entry already exists for the date, merge the damages instead of creating a new one
export const addDailyDamage = async (req, res) => {
  try {
    const { date, damages, total, addedBy } = req.body;
    if (!date || !damages || typeof damages !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }
    // Duplicate outletId as outlet key for frontend compatibility
    const damagesWithDup = {};
    Object.entries(damages).forEach(([outletId, value]) => {
      damagesWithDup[outletId] = value;
      damagesWithDup[outletId] = value; // duplicate for clarity
    });
    // Check if an entry already exists for this date
    const existingSnapshot = await db.collection("dailyDamages")
      .where("date", "==", date)
      .limit(1)
      .get();
    if (!existingSnapshot.empty) {
      // Merge with existing entry
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const mergedDamages = { ...existingData.damages, ...damagesWithDup };
      // Recalculate total from merged damages
      const mergedTotal = Object.values(mergedDamages).reduce((sum, val) => sum + (Number(val) || 0), 0);
      
      const updatedData = {
        damages: mergedDamages,
        total: mergedTotal,
        updatedAt: new Date(),
      };
      
      // Store addedBy info per outlet
      if (addedBy) {
        const addedByPerOutlet = existingData.addedByPerOutlet || {};
        Object.keys(damagesWithDup).forEach(outletKey => {
          if (damagesWithDup[outletKey] !== undefined) {
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
      res.status(200).json({ id: existingDoc.id, message: "Daily damage merged with existing entry", merged: true });
    } else {
      // Create new entry
      const docData = {
        date,
        damages: damagesWithDup,
        total: total || 0,
        createdAt: new Date(),
      };
      
      // Store addedBy info per outlet
      if (addedBy) {
        const addedByPerOutlet = {};
        Object.keys(damagesWithDup).forEach(outletKey => {
          addedByPerOutlet[outletKey] = {
            username: addedBy.username,
            zone: addedBy.zone,
            role: addedBy.role,
            timestamp: addedBy.timestamp
          };
        });
        docData.addedByPerOutlet = addedByPerOutlet;
      }
      
      const docRef = await db.collection("dailyDamages").add(docData);
      res.status(201).json({ id: docRef.id, message: "Daily damage recorded" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error adding daily damage", error: error.message });
  }
};

// PATCH controller to update a daily damage entry by ID
export const updateDailyDamage = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const docRef = db.collection("dailyDamages").doc(id);
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.status(200).json({ id, ...updatedDoc.data() });
  } catch (error) {
    res.status(500).json({ message: "Error updating daily damage", error: error.message });
  }
};

// Delete all daily damage entries for a specific date (admin only)
export const deleteDailyDamagesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }
    
    const snapshot = await db.collection("dailyDamages")
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
    res.status(500).json({ message: "Error deleting daily damages", error: error.message });
  }
};
