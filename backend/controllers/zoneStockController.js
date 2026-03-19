import { db } from "../config/firebase.js";

const COLLECTION = "zoneStockEntries";

const normalizeZoneLabel = (zone) => {
  if (!zone) return null;
  const raw = String(zone).trim();
  const match = raw.match(/(\d+)/);
  return match ? `Zone ${match[1]}` : raw;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const mapDoc = (doc) => ({ id: doc.id, ...doc.data() });

export const upsertZoneStockEntry = async (req, res) => {
  try {
    const { zone, date, openingStock, stockIn, salesQty, damagesQty, closingStock, addedBy } = req.body || {};

    const normalizedZone = normalizeZoneLabel(zone);
    const normalizedDate = normalizeDate(date);

    if (!normalizedZone || !normalizedDate) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const payload = {
      zone: normalizedZone,
      date: normalizedDate,
      openingStock: toNumber(openingStock),
      stockIn: toNumber(stockIn),
      salesQty: toNumber(salesQty),
      damagesQty: toNumber(damagesQty),
      closingStock: toNumber(closingStock),
      updatedAt: new Date(),
    };

    if (addedBy && typeof addedBy === "object") {
      payload.addedBy = {
        username: addedBy.username || "unknown",
        role: addedBy.role || "unknown",
        zone: addedBy.zone || normalizedZone,
        timestamp: addedBy.timestamp || new Date().toISOString(),
      };
    }

    const existingSnap = await db
      .collection(COLLECTION)
      .where("zone", "==", normalizedZone)
      .where("date", "==", normalizedDate)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      await existingDoc.ref.set(payload, { merge: true });
      return res.status(200).json({
        id: existingDoc.id,
        merged: true,
        message: "Zone stock entry updated",
      });
    }

    const docRef = await db.collection(COLLECTION).add({
      ...payload,
      createdAt: new Date(),
    });

    return res.status(201).json({
      id: docRef.id,
      merged: false,
      message: "Zone stock entry created",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error saving zone stock entry", error: error.message });
  }
};

export const getAllZoneStockEntries = async (_req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    const data = snapshot.docs
      .map(mapDoc)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching zone stock entries", error: error.message });
  }
};

export const getZoneStockEntriesByZone = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    if (!zone) return res.status(400).json({ message: "zone is required" });

    const snapshot = await db.collection(COLLECTION).where("zone", "==", zone).get();
    const data = snapshot.docs
      .map(mapDoc)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching zone stock entries", error: error.message });
  }
};

export const deleteZoneStockEntryByZoneAndDate = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    const date = normalizeDate(req.params.date);

    if (!zone || !date) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const snapshot = await db
      .collection(COLLECTION)
      .where("zone", "==", zone)
      .where("date", "==", date)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "Entry not found" });
    }

    await snapshot.docs[0].ref.delete();
    return res.status(200).json({ message: "Entry deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting zone stock entry", error: error.message });
  }
};
