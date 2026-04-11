import { db } from "../config/firebase.js";
import { validateSupervisorSameDayEntry } from "../utils/entryCutoff.js";

const parseNumericRate = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getOutletKey = (payload = {}) => payload.outletId || payload.outlet || null;

const normalizeNeccDoc = (id, data = {}) => {
  const outletKey = data.outlet || data.outletId || null;
  const rateValue = parseNumericRate(data.rateValue) ?? parseNumericRate(data.rate) ?? 0;

  return {
    id,
    ...data,
    outlet: outletKey,
    outletId: data.outletId || outletKey,
    rateValue,
    rate: `₹${rateValue.toFixed(2)} per egg`,
    remarks: data.remarks || "—",
  };
};

export const addNeccRate = async (req, res) => {
  try {
    const { date, remarks, addedBy } = req.body;
    const outletKey = getOutletKey(req.body);
    const numericRate = parseNumericRate(req.body.rate);

    if (!date || !outletKey || numericRate === null) {
      return res.status(400).json({ message: "Missing required field: date, outletId/outlet, or rate" });
    }

    const entryValidation = validateSupervisorSameDayEntry(date, addedBy);
    if (!entryValidation.allowed) {
      return res.status(403).json({
        message: entryValidation.message,
        today: entryValidation.todayIso,
        timezone: entryValidation.timezone,
      });
    }

    const docData = {
      date,
      outletId: outletKey,
      outlet: outletKey,
      rateValue: numericRate,
      rate: `₹${numericRate.toFixed(2)} per egg`,
      remarks: remarks || "—",
      createdAt: new Date(),
    };

    if (addedBy) {
      docData.addedBy = {
        username: addedBy.username,
        zone: addedBy.zone,
        role: addedBy.role,
        timestamp: addedBy.timestamp,
      };
    }

    const docRef = await db.collection("neccRates").add(docData);
    res.status(201).json({ id: docRef.id, message: "NECC rate recorded" });
  } catch (error) {
    res.status(500).json({ message: "Error adding NECC rate", error: error.message });
  }
};

export const getAllNeccRates = async (req, res) => {
  try {
    const snapshot = await db.collection("neccRates").orderBy("date", "desc").get();
    const rates = snapshot.docs.map((doc) => normalizeNeccDoc(doc.id, doc.data()));
    res.status(200).json(rates);
  } catch (error) {
    res.status(500).json({ message: "Error fetching NECC rates", error: error.message });
  }
};

export const updateNeccRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, remarks } = req.body;
    const outletKey = getOutletKey(req.body);
    const numericRate = parseNumericRate(req.body.rate);

    if (!date || !outletKey || numericRate === null) {
      return res.status(400).json({ message: "Missing required field: date, outletId/outlet, or rate" });
    }

    const updateData = {
      date,
      outletId: outletKey,
      outlet: outletKey,
      rateValue: numericRate,
      rate: `₹${numericRate.toFixed(2)} per egg`,
      remarks: remarks || "—",
      updatedAt: new Date(),
    };

    const docRef = db.collection("neccRates").doc(id);
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.status(200).json(normalizeNeccDoc(id, updatedDoc.data()));
  } catch (error) {
    res.status(500).json({ message: "Error updating NECC rate", error: error.message });
  }
};

export const deleteNeccRatesByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const snapshot = await db.collection("neccRates").where("date", "==", date).get();
    const batch = db.batch();
    let deletedCount = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount += 1;
    });

    await batch.commit();

    res.status(200).json({
      message: `Deleted ${deletedCount} entry(ies) for date ${date}`,
      count: deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting NECC rates", error: error.message });
  }
};

export const deleteNeccRateByOutletAndDate = async (req, res) => {
  try {
    const { date, outletId } = req.params;
    if (!date || !outletId) {
      return res.status(400).json({ message: "Date and outletId are required" });
    }

    const snapshot = await db.collection("neccRates")
      .where("date", "==", date)
      .where("outletId", "==", outletId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No NECC entry found for this outlet and date" });
    }

    await snapshot.docs[0].ref.delete();
    res.status(200).json({ message: `NECC rate for outlet ${outletId} on ${date} deleted`, count: 1 });
  } catch (error) {
    res.status(500).json({ message: "Error deleting NECC rate", error: error.message });
  }
};
