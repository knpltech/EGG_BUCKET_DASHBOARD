import { db } from "../config/firebase.js";
import { validateSupervisorSameDayEntry } from "../utils/entryCutoff.js";

/* ADD REMARKS */
export const addRemarks = async (req, res) => {
  try {
    const { date, outlet, value, addedBy } = req.body;

    if (!date || !outlet || value === undefined) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const entryValidation = validateSupervisorSameDayEntry(date, addedBy);
    if (!entryValidation.allowed) {
      return res.status(403).json({
        message: entryValidation.message,
        today: entryValidation.todayIso,
        timezone: entryValidation.timezone,
      });
    }

    const ref = db.collection("remarks").doc(date);
    const doc = await ref.get();

    if (doc.exists) {
      const data = doc.data();
      const outlets = data.outlets || {};

      if (outlets[outlet] !== undefined) {
        return res.status(400).json({
          error: "Remarks already entered for this outlet on this date",
        });
      }

      const updatedData = {
        [`outlets.${outlet}`]: value,
      };

      if (addedBy) {
        const addedByPerOutlet = data.addedByPerOutlet || {};
        addedByPerOutlet[outlet] = {
          username: addedBy.username,
          zone: addedBy.zone,
          role: addedBy.role,
          timestamp: addedBy.timestamp,
        };
        updatedData.addedByPerOutlet = addedByPerOutlet;
      }

      await ref.update(updatedData);
    } else {
      const docData = {
        date,
        outlets: { [outlet]: value },
      };

      if (addedBy) {
        docData.addedByPerOutlet = {
          [outlet]: {
            username: addedBy.username,
            zone: addedBy.zone,
            role: addedBy.role,
            timestamp: addedBy.timestamp,
          },
        };
      }

      await ref.set(docData);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
};

/* GET ALL REMARKS */
export const getAllRemarks = async (req, res) => {
  try {
    const snapshot = await db.collection("remarks").get();
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (err) {
    res.status(500).json(err.message);
  }
};

/* UPDATE REMARKS BY ID */
export const updateRemarks = async (req, res) => {
  const { id } = req.params;
  const { outlets } = req.body;
  try {
    await db.collection("remarks").doc(id).update({ outlets });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* DELETE a specific OUTLET's remarks for a specific date (admin only) */
export const deleteRemarksByOutletAndDate = async (req, res) => {
  try {
    const { date, outletId } = req.params;
    if (!date || !outletId) {
      return res.status(400).json({ error: "Date and outletId are required" });
    }

    const ref = db.collection("remarks").doc(date);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No remarks entry found for this date" });
    }

    const data = doc.data();
    const outlets = { ...data.outlets };
    const addedByPerOutlet = { ...(data.addedByPerOutlet || {}) };

    if (outlets[outletId] === undefined) {
      return res.status(404).json({ error: "Outlet not found for this date" });
    }

    delete outlets[outletId];
    delete addedByPerOutlet[outletId];

    await ref.update({ outlets, addedByPerOutlet });
    res.status(200).json({ message: `Outlet ${outletId} removed from remarks for ${date}`, count: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* DELETE ALL remarks for a specific date (admin only) */
export const deleteRemarksByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ error: "Date is required" });

    const ref = db.collection("remarks").doc(date);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No remarks entry found for this date" });
    }

    await ref.delete();
    res.status(200).json({ message: "All remarks deleted for the given date" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
