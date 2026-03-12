import { db } from "../config/firebase.js";

/* ADD INCENTIVE */
export const addIncentive = async (req, res) => {
  try {
    const { date, outlet, value, addedBy } = req.body;

    if (!date || !outlet || value === undefined) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const ref = db.collection("incentive").doc(date);
    const doc = await ref.get();

    if (doc.exists) {
      const data = doc.data();
      const outlets = data.outlets || {};

      if (outlets[outlet] !== undefined) {
        return res.status(400).json({
          error: "Incentive already entered for this outlet on this date"
        });
      }

      const newTotal = (data.total || 0) + Number(value);
      const updatedData = {
        [`outlets.${outlet}`]: Number(value),
        total: newTotal
      };

      if (addedBy) {
        const addedByPerOutlet = data.addedByPerOutlet || {};
        addedByPerOutlet[outlet] = {
          username: addedBy.username,
          zone: addedBy.zone,
          role: addedBy.role,
          timestamp: addedBy.timestamp
        };
        updatedData.addedByPerOutlet = addedByPerOutlet;
      }

      await ref.update(updatedData);
    } else {
      const docData = {
        date,
        outlets: { [outlet]: Number(value) },
        total: Number(value)
      };

      if (addedBy) {
        docData.addedByPerOutlet = {
          [outlet]: {
            username: addedBy.username,
            zone: addedBy.zone,
            role: addedBy.role,
            timestamp: addedBy.timestamp
          }
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

/* GET ALL INCENTIVES */
export const getAllIncentives = async (req, res) => {
  try {
    const snapshot = await db.collection("incentive").get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (err) {
    res.status(500).json(err.message);
  }
};

/* UPDATE INCENTIVE BY ID */
export const updateIncentive = async (req, res) => {
  const { id } = req.params;
  const { outlets, total } = req.body;
  try {
    await db.collection("incentive").doc(id).update({ outlets, total });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* DELETE a specific OUTLET's incentive for a specific date (admin only) */
export const deleteIncentiveByOutletAndDate = async (req, res) => {
  try {
    const { date, outletId } = req.params;
    if (!date || !outletId) return res.status(400).json({ error: "Date and outletId are required" });

    const ref = db.collection("incentive").doc(date);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: "No incentive entry found for this date" });

    const data = doc.data();
    const outlets = { ...data.outlets };
    const addedByPerOutlet = { ...(data.addedByPerOutlet || {}) };

    if (outlets[outletId] === undefined) return res.status(404).json({ error: "Outlet not found for this date" });

    delete outlets[outletId];
    delete addedByPerOutlet[outletId];
    const newTotal = Object.values(outlets).reduce((sum, v) => sum + (Number(v) || 0), 0);

    await ref.update({ outlets, addedByPerOutlet, total: newTotal });
    res.status(200).json({ message: `Outlet ${outletId} removed from incentive for ${date}`, count: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* DELETE ALL incentives for a specific date (admin only) */
export const deleteIncentivesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ error: "Date is required" });

    const ref = db.collection("incentive").doc(date);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: "No incentive entry found for this date" });

    await ref.delete();
    res.status(200).json({ message: `All incentive data for ${date} deleted`, count: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};