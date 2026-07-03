import { db } from "../config/firebase.js";

const COLLECTION = "outletSalaryEntries";
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const toNumber = (value) => {
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeYear = (value) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return year;
};

const normalizeMonth = (value) => {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month;
};

const getDocId = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

const normalizeOutletsPayload = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {};
  const normalized = {};

  for (const [outletId, amount] of Object.entries(source)) {
    const key = String(outletId || "").trim();
    if (!key) continue;
    normalized[key] = toNumber(amount);
  }

  return normalized;
};

const mapDoc = (doc) => ({ id: doc.id, ...doc.data() });

export const getOutletSalaryEntries = async (req, res) => {
  try {
    const year = normalizeYear(req.query?.year);
    if (!year) {
      return res.status(400).json({ message: "Valid year query parameter is required" });
    }

    const snapshot = await db.collection(COLLECTION).where("year", "==", year).get();
    const rows = snapshot.docs
      .map(mapDoc)
      .sort((a, b) => Number(a.month) - Number(b.month));
    return res.json(rows);
  } catch (error) {
    console.error("Failed to fetch outlet salary entries:", error.message);
    return res.status(500).json({ message: "Failed to fetch outlet salary entries", error: error.message });
  }
};

export const getOutletSalaryEntryByMonth = async (req, res) => {
  try {
    const year = normalizeYear(req.params?.year);
    const month = normalizeMonth(req.params?.month);

    if (!year || !month) {
      return res.status(400).json({ message: "Valid year and month are required" });
    }

    const docId = getDocId(year, month);
    const docSnap = await db.collection(COLLECTION).doc(docId).get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Outlet salary entry not found" });
    }

    return res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch outlet salary entry", error: error.message });
  }
};

export const upsertOutletSalaryEntry = async (req, res) => {
  try {
    const year = normalizeYear(req.body?.year);
    const month = normalizeMonth(req.body?.month);

    if (!year || !month) {
      return res.status(400).json({ message: "Valid year and month are required" });
    }

    const monthName = MONTHS[month - 1];
    const outlets = normalizeOutletsPayload(req.body?.outlets);
    const total = Object.values(outlets).reduce((sum, value) => sum + toNumber(value), 0);
    const now = new Date();
    const docId = getDocId(year, month);
    const docRef = db.collection(COLLECTION).doc(docId);
    const existing = await docRef.get();

    const payload = {
      year,
      month,
      monthName,
      outlets,
      total,
      updatedAt: now,
      updatedBy: req.user?.username || req.user?.email || "admin",
    };

    if (req.body?.addedBy && typeof req.body.addedBy === "object") {
      payload.addedBy = {
        username: req.body.addedBy.username || req.user?.username || req.user?.email || "admin",
        role: req.body.addedBy.role || req.user?.role || "admin",
        timestamp: req.body.addedBy.timestamp || now.toISOString(),
      };
    }

    if (!existing.exists) {
      payload.createdAt = now;
    }

    await docRef.set(payload, { merge: true });

    const saved = await docRef.get();
    return res.status(existing.exists ? 200 : 201).json({ id: saved.id, ...saved.data() });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save outlet salary entry", error: error.message });
  }
};
