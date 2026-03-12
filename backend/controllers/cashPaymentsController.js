import { db } from "../config/firebase.js";

// Add a new cash payment entry to Firestore
// If an entry already exists for the date, merge the outlets instead of creating a new one
export const addCashPayment = async (req, res) => {
  try {
    const { date, outlets, addedBy } = req.body;
    if (!date || !outlets || typeof outlets !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }

    const outletsWithDup = {};
    Object.entries(outlets).forEach(([outletId, value]) => {
      outletsWithDup[outletId] = value;
    });

    const existingSnapshot = await db.collection("cashPayments")
      .where("date", "==", date)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const mergedOutlets = { ...existingData.outlets, ...outletsWithDup };
      const mergedTotal = Object.values(mergedOutlets).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

      const updatedData = {
        outlets: mergedOutlets,
        total: mergedTotal,
        updatedAt: new Date(),
      };

      if (addedBy) {
        const addedByPerOutlet = existingData.addedByPerOutlet || {};
        Object.keys(outletsWithDup).forEach(outletKey => {
          if (outletsWithDup[outletKey] !== undefined) {
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
      res.status(200).json({ id: existingDoc.id, message: "Cash payment merged with existing entry", merged: true });
    } else {
      const total = Object.values(outletsWithDup).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const docData = {
        date,
        outlets: outletsWithDup,
        total,
        createdAt: new Date(),
      };

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

      const docRef = await db.collection("cashPayments").add(docData);
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

// Delete ALL cash payment entries for a specific date (admin only)
export const deleteCashPaymentsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const snapshot = await db.collection("cashPayments").where("date", "==", date).get();

    let deletedCount = 0;
    const batch = db.batch();
    snapshot.docs.forEach(doc => { batch.delete(doc.ref); deletedCount++; });
    await batch.commit();

    res.status(200).json({ message: `Deleted ${deletedCount} entry(ies) for date ${date}`, count: deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Error deleting cash payments", error: error.message });
  }
};

// Delete a specific OUTLET's cash payment data for a specific date (admin only)
export const deleteCashPaymentByOutletAndDate = async (req, res) => {
  try {
    const { date, outletId } = req.params;
    if (!date || !outletId) return res.status(400).json({ message: "Date and outletId are required" });

    const snapshot = await db.collection("cashPayments").where("date", "==", date).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ message: "No entry found for this date" });

    const doc = snapshot.docs[0];
    const data = doc.data();
    const outlets = { ...data.outlets };
    const addedByPerOutlet = { ...(data.addedByPerOutlet || {}) };

    if (outlets[outletId] === undefined) return res.status(404).json({ message: "Outlet not found for this date" });

    delete outlets[outletId];
    delete addedByPerOutlet[outletId];
    const newTotal = Object.values(outlets).reduce((sum, v) => sum + (Number(v) || 0), 0);

    await doc.ref.update({ outlets, addedByPerOutlet, total: newTotal, updatedAt: new Date() });
    res.status(200).json({ message: `Outlet ${outletId} removed from cash payments for ${date}`, count: 1 });
  } catch (error) {
    res.status(500).json({ message: "Error deleting outlet from cash payments", error: error.message });
  }
};