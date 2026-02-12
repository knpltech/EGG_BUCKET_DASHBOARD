// Update a digital payment entry by ID
export const updateDigitalPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, outlets } = req.body;
    if (!id || !date || !outlets || typeof outlets !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }
    const total = Object.values(outlets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    await db.collection("digitalPayments").doc(id).update({
      date,
      outlets,
      total,
      updatedAt: new Date(),
    });
    res.status(200).json({ message: "Digital payment updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating digital payment", error: error.message });
  }
};
import { db } from "../config/firebase.js";

// Add a new digital payment entry to Firestore
// If an entry already exists for the date, merge the outlets instead of creating a new one
export const addDigitalPayment = async (req, res) => {
  try {
    const { date, outlets } = req.body;
    if (!date || !outlets || typeof outlets !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }
    
    // Check if an entry already exists for this date
    const existingSnapshot = await db.collection("digitalPayments")
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
      
      res.status(200).json({ id: existingDoc.id, message: "Digital payment merged with existing entry", merged: true });
    } else {
      // Calculate total
      const total = Object.values(outlets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const docRef = await db.collection("digitalPayments").add({
        date,
        outlets,
        total,
        createdAt: new Date(),
      });
      res.status(201).json({ id: docRef.id, message: "Digital payment recorded" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error adding digital payment", error: error.message });
  }
};

// Get all digital payment entries from Firestore
export const getAllDigitalPayments = async (req, res) => {
  try {
    const snapshot = await db.collection("digitalPayments").orderBy("date", "desc").get();
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching digital payments", error: error.message });
  }
};
