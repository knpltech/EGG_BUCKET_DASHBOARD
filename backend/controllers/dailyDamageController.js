import { db } from "../config/firebase.js";

// Add a new DailyDamage entry to Firestore
// If an entry already exists for the date, merge the damages instead of creating a new one
export const addDailyDamage = async (req, res) => {
  try {
    const { date, damages, total, addedBy } = req.body;
    if (!date || !damages || typeof damages !== 'object') {
      return res.status(400).json({ message: "Missing or invalid required fields" });
    }

    const damagesWithDup = {};
    Object.entries(damages).forEach(([outletId, value]) => {
      damagesWithDup[outletId] = value;
    });

    const existingSnapshot = await db.collection("dailyDamages")
      .where("date", "==", date)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const mergedDamages = { ...existingData.damages, ...damagesWithDup };
      const mergedTotal = Object.values(mergedDamages).reduce((sum, val) => sum + (Number(val) || 0), 0);

      const updatedData = {
        damages: mergedDamages,
        total: mergedTotal,
        updatedAt: new Date(),
      };

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
      const docData = {
        date,
        damages: damagesWithDup,
        total: total || 0,
        createdAt: new Date(),
      };

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

// Delete ALL daily damage entries for a specific date (admin only)
export const deleteDailyDamagesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const snapshot = await db.collection("dailyDamages").where("date", "==", date).get();

    let deletedCount = 0;
    const batch = db.batch();
    snapshot.docs.forEach(doc => { batch.delete(doc.ref); deletedCount++; });
    await batch.commit();

    res.status(200).json({ message: `Deleted ${deletedCount} entry(ies) for date ${date}`, count: deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Error deleting daily damages", error: error.message });
  }
};

// Delete a specific OUTLET's damage data for a specific date (admin only)
export const deleteDailyDamageByOutletAndDate = async (req, res) => {
  try {
    const { date, outletId } = req.params;
    if (!date || !outletId) return res.status(400).json({ message: "Date and outletId are required" });

    const snapshot = await db.collection("dailyDamages").where("date", "==", date).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ message: "No entry found for this date" });

    const doc = snapshot.docs[0];
    const data = doc.data();
    const damages = { ...data.damages };
    const addedByPerOutlet = { ...(data.addedByPerOutlet || {}) };

    if (damages[outletId] === undefined) return res.status(404).json({ message: "Outlet not found for this date" });

    delete damages[outletId];
    delete addedByPerOutlet[outletId];
    const newTotal = Object.values(damages).reduce((sum, v) => sum + (Number(v) || 0), 0);

    await doc.ref.update({ damages, addedByPerOutlet, total: newTotal, updatedAt: new Date() });
    res.status(200).json({ message: `Outlet ${outletId} removed from daily damages for ${date}`, count: 1 });
  } catch (error) {
    res.status(500).json({ message: "Error deleting outlet from daily damages", error: error.message });
  }
};