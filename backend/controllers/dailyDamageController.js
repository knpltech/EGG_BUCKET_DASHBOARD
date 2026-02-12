

import { db } from "../config/firebase.js";

// Add a new DailyDamage entry to Firestore
// If an entry already exists for the date, merge the damages instead of creating a new one
export const addDailyDamage = async (req, res) => {
  try {
    const { date, damages, total } = req.body;
    if (!date || !damages || typeof damages !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }
    
    // Check if an entry already exists for this date
    const existingSnapshot = await db.collection("dailyDamages")
      .where("date", "==", date)
      .limit(1)
      .get();
    
    if (!existingSnapshot.empty) {
      // Merge with existing entry
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const mergedDamages = { ...existingData.damages, ...damages };
      
      // Recalculate total from merged damages
      const mergedTotal = Object.values(mergedDamages).reduce((sum, val) => sum + (Number(val) || 0), 0);
      
      await existingDoc.ref.update({
        damages: mergedDamages,
        total: mergedTotal,
        updatedAt: new Date(),
      });
      
      res.status(200).json({ id: existingDoc.id, message: "Daily damage merged with existing entry", merged: true });
    } else {
      // Create new entry
      const docRef = await db.collection("dailyDamages").add({
        date,
        damages,
        total: total || 0,
        createdAt: new Date(),
      });
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
