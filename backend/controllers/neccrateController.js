// PATCH controller to update a NECC rate entry by ID
export const updateNeccRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, outletId, rate, remarks } = req.body;
    if (!date || !outletId || !rate) {
      return res.status(400).json({ message: "Missing required field: date, outletId, or rate" });
    }
    const updateData = { date, outletId, rate, remarks: remarks || "—" };
    const docRef = db.collection("neccRates").doc(id);
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.status(200).json({ id, ...updatedDoc.data() });
  } catch (error) {
    res.status(500).json({ message: "Error updating NECC rate", error: error.message });
  }
};
import { db } from "../config/firebase.js";

// Add a new NECC rate entry to Firestore
export const addNeccRate = async (req, res) => {
  try {
    const { date, outletId, rate, remarks } = req.body;
    if (!date || !outletId || !rate) {
      return res.status(400).json({ message: "Missing required field: date, outletId, or rate" });
    }
    const numericRate = Number(rate);
    const docRef = await db.collection("neccRates").add({
      date,
      outletId,
      outlet: outletId, // duplicate for frontend compatibility
      rate: `₹${numericRate.toFixed(2)} per egg`,
      rateValue: numericRate,
      remarks: remarks || "—",
      createdAt: new Date(),
    });
    res.status(201).json({ id: docRef.id, message: "NECC rate recorded" });
  } catch (error) {
    res.status(500).json({ message: "Error adding NECC rate", error: error.message });
  }
};

// Get all NECC rate entries from Firestore
export const getAllNeccRates = async (req, res) => {
  try {
    const snapshot = await db.collection("neccRates").orderBy("date", "desc").get();
    const rates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(rates);
  } catch (error) {
    res.status(500).json({ message: "Error fetching NECC rates", error: error.message });
  }
};
