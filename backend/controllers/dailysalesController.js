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
    const { date, outlets, total } = req.body;
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
      
      await existingDoc.ref.update({
        outlets: mergedOutlets,
        total: mergedTotal,
        updatedAt: new Date(),
      });
      
      res.status(200).json({ id: existingDoc.id, message: "Daily sales merged with existing entry", merged: true });
    } else {
      // Calculate total from outlets
      const calculatedTotal = Object.values(outletsWithDup).reduce((sum, val) => sum + (Number(val) || 0), 0);
      const docRef = await db.collection("dailySales").add({
        date,
        outlets: outletsWithDup,
        total: calculatedTotal,
        createdAt: new Date(),
      });
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
