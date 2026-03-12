import { db } from "../config/firebase.js";

// Add a new NECC rate entry to Firestore
export const addNeccRate = async (req, res) => {
  try {
    const { date, outletId, outlet, rate, remarks, addedBy } = req.body;
    const outletValue = outletId || outlet;
    if (!date || !outletValue || !rate) {
      return res.status(400).json({ message: "Missing required field: date, outletId/outlet, or rate" });
    }
    const numericRate = Number(rate);
    const docData = {
      date,
      outletId: outletValue,
      outlet: outletValue,
      rate: `₹${numericRate.toFixed(2)} per egg`,
      rateValue: numericRate,
      remarks: remarks || "—",
      createdAt: new Date(),
    };

    if (addedBy) {
      docData.addedBy = {
        username: addedBy.username,
        zone: addedBy.zone,
        role: addedBy.role,
        timestamp: addedBy.timestamp
      };
    }

    const docRef = await db.collection("neccRates").add(docData);
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

// PATCH controller to update a NECC rate entry by ID
export const updateNeccRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, outletId, outlet, rate, remarks } = req.body;
    const outletValue = outletId || outlet;
    if (!date || !outletValue || rate === undefined || rate === null) {
      return res.status(400).json({ message: "Missing required field: date, outletId/outlet, or rate" });
    }
    const numericRate = typeof rate === "number" ? rate : Number(String(rate).replace(/[^\d.]/g, ""));
    if (isNaN(numericRate)) {
      return res.status(400).json({ message: "Invalid rate value" });
    }
    const updateData = {
      date,
      outletId: outletValue,
      outlet: outletValue,
      rate: `₹${numericRate.toFixed(2)} per egg`,
      rateValue: numericRate,
      remarks: remarks || "—",
    };
    const docRef = db.collection("neccRates").doc(id);
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.status(200).json({ id, ...updatedDoc.data() });
  } catch (error) {
    res.status(500).json({ message: "Error updating NECC rate", error: error.message });
  }
};

// Delete ALL NECC rate entries for a specific date (admin only)
export const deleteNeccRatesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const snapshot = await db.collection("neccRates").where("date", "==", date).get();

    let deletedCount = 0;
    const batch = db.batch();
    snapshot.docs.forEach(doc => { batch.delete(doc.ref); deletedCount++; });
    await batch.commit();

    res.status(200).json({ message: `Deleted ${deletedCount} entry(ies) for date ${date}`, count: deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Error deleting NECC rates", error: error.message });
  }
};

// Delete a specific OUTLET's NECC rate for a specific date (admin only)
// NECC stores one doc per outlet, so we delete the whole doc
export const deleteNeccRateByOutletAndDate = async (req, res) => {
  try {
    const { date, outletId } = req.params;
    if (!date || !outletId) return res.status(400).json({ message: "Date and outletId are required" });

    const snapshot = await db.collection("neccRates")
      .where("date", "==", date)
      .where("outletId", "==", outletId)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ message: "No NECC entry found for this outlet and date" });

    await snapshot.docs[0].ref.delete();
    res.status(200).json({ message: `NECC rate for outlet ${outletId} on ${date} deleted`, count: 1 });
  } catch (error) {
    res.status(500).json({ message: "Error deleting NECC rate", error: error.message });
  }
};