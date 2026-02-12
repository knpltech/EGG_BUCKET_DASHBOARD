// PATCH controller to update a cash payment entry by ID
export const updateCashPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const docRef = db.collection("cashPayments").doc(id);
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.status(200).json({ id, ...updatedDoc.data() });
  } catch (error) {
    res.status(500).json({ message: "Error updating cash payment", error: error.message });
  }
};
import { db } from "../config/firebase.js";

// Add a new cash payment entry to Firestore
// If an entry already exists for the date, merge the outlets instead of creating a new one
export const addCashPayment = async (req, res) => {
  try {
    const { date, outlets } = req.body;
    if (!date || !outlets || typeof outlets !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }
    
    // Check if an entry already exists for this date
    const existingSnapshot = await db.collection("cashPayments")
      .where("date", "==", date)
      .limit(1)
      .get();
    
    if (!existingSnapshot.empty) {
      // Merge with existing entry
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const mergedOutlets = { ...existingData.outlets, ...outlets };
      
      // Recalculate total from merged outlets
      const mergedTotal = Object.values(mergedOutlets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      
      await existingDoc.ref.update({
        outlets: mergedOutlets,
        total: mergedTotal,
        updatedAt: new Date(),
      });
      
      res.status(200).json({ id: existingDoc.id, message: "Cash payment merged with existing entry", merged: true });
    } else {
      // Calculate total
      const total = Object.values(outlets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const docRef = await db.collection("cashPayments").add({
        date,
        outlets,
        total,
        createdAt: new Date(),
      });
      res.status(201).json({ id: docRef.id, message: "Cash payment recorded" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error adding cash payment", error: error.message });
  }
};

// Get all cash payment entries from Firestore
export const getAllCashPayments = async (req, res) => {
  try {
    const snapshot = await db.collection("cashPayments").orderBy("date", "desc").get();
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching cash payments", error: error.message });
  }
};
