import { db } from "../config/firebase.js";

const COLLECTION = "zoneStockEntries";
const DAILY_SALES_COLLECTION = "dailySales";
const DAILY_DAMAGES_COLLECTION = "dailyDamages";
const OUTLETS_COLLECTION = "outlets";
const ALL_ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

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
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("-");
      return `${year}-${month}-${day}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("/");
      return `${year}-${month}-${day}`;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getIsoToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const addDays = (isoDate, days) => {
  const base = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
};

const iterateDatesInclusive = (startIso, endIso) => {
  if (!startIso || !endIso || String(startIso).localeCompare(String(endIso)) > 0) return [];
  const dates = [];
  let cursor = startIso;
  while (String(cursor).localeCompare(String(endIso)) <= 0) {
    dates.push(cursor);
    const next = addDays(cursor, 1);
    if (!next) break;
    cursor = next;
  }
  return dates;
};

const getLatestDocByDate = (rows, dateIso) => {
  if (!Array.isArray(rows) || !dateIso) return null;
  const matching = rows
    .filter((row) => normalizeDate(row?.date || row?.createdAt) === dateIso)
    .sort((a, b) => {
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return bTime - aTime;
    });
  return matching[0] || null;
};

const getZoneOutletMap = (outlets) => {
  const map = new Map(ALL_ZONES.map((zone) => [zone, []]));
  for (const outlet of outlets || []) {
    const zone = normalizeZoneLabel(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber);
    if (!zone || !map.has(zone)) continue;
    if (outlet?.status && outlet.status !== "Active") continue;
    const keys = [outlet?.id, outlet?.area, outlet?.name].filter(Boolean);
    if (keys.length) map.get(zone).push(...keys);
  }
  for (const zone of map.keys()) {
    map.set(zone, Array.from(new Set(map.get(zone))));
  }
  return map;
};

const sumValuesByKeys = (values, keys) => {
  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;
  return (keys || []).reduce((sum, key) => sum + toNumber(values[key]), 0);
};

const commitBatches = async (refsAndData) => {
  if (!refsAndData.length) return 0;
  let written = 0;
  for (let i = 0; i < refsAndData.length; i += 450) {
    const chunk = refsAndData.slice(i, i + 450);
    const batch = db.batch();
    for (const item of chunk) {
      batch.set(item.ref, item.data);
      written += 1;
    }
    await batch.commit();
  }
  return written;
};

const ensureZoneStockDefaults = async () => {
  const yesterday = addDays(getIsoToday(), -1);
  if (!yesterday) return;

  const [zoneStockSnap, outletsSnap, salesSnap, damagesSnap] = await Promise.all([
    db.collection(COLLECTION).get(),
    db.collection(OUTLETS_COLLECTION).get(),
    db.collection(DAILY_SALES_COLLECTION).get(),
    db.collection(DAILY_DAMAGES_COLLECTION).get(),
  ]);

  const zoneRows = zoneStockSnap.docs.map(mapDoc);
  const salesRows = salesSnap.docs.map(mapDoc);
  const damageRows = damagesSnap.docs.map(mapDoc);
  const outletRows = outletsSnap.docs.map(mapDoc);

  const knownDates = new Set();
  for (const row of zoneRows) {
    const d = normalizeDate(row?.date || row?.createdAt);
    if (d) knownDates.add(d);
  }
  for (const row of salesRows) {
    const d = normalizeDate(row?.date || row?.createdAt);
    if (d) knownDates.add(d);
  }
  for (const row of damageRows) {
    const d = normalizeDate(row?.date || row?.createdAt);
    if (d) knownDates.add(d);
  }

  const dateList = Array.from(knownDates).sort((a, b) => String(a).localeCompare(String(b)));
  if (!dateList.length) return;

  const startDate = dateList[0];
  const fullDateRange = iterateDatesInclusive(startDate, yesterday);
  if (!fullDateRange.length) return;

  const zoneOutletsMap = getZoneOutletMap(outletRows);
  const existingByZoneDate = new Map();
  for (const row of zoneRows) {
    const rowZone = normalizeZoneLabel(row?.zone);
    const rowDate = normalizeDate(row?.date || row?.createdAt);
    if (!rowZone || !rowDate) continue;
    existingByZoneDate.set(`${rowZone}__${rowDate}`, row);
  }

  const writes = [];

  for (const zone of ALL_ZONES) {
    let previousClosing = 0;
    for (const date of fullDateRange) {
      const key = `${zone}__${date}`;
      const existing = existingByZoneDate.get(key);

      if (existing) {
        previousClosing = toNumber(existing.closingStock);
        continue;
      }

      const salesDoc = getLatestDocByDate(salesRows, date);
      const damagesDoc = getLatestDocByDate(damageRows, date);
      const outletKeys = zoneOutletsMap.get(zone) || [];
      const salesQty = sumValuesByKeys(salesDoc?.outlets, outletKeys);
      const damagesQty = sumValuesByKeys(damagesDoc?.damages, outletKeys);
      const openingStock = previousClosing;
      const stockIn = 0;
      const closingStock = openingStock + stockIn - salesQty - damagesQty;

      const payload = {
        zone,
        date,
        openingStock,
        stockIn,
        salesQty,
        damagesQty,
        closingStock,
        isAutoDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        addedBy: {
          username: "system",
          role: "system",
          zone,
          timestamp: new Date().toISOString(),
        },
      };

      const ref = db.collection(COLLECTION).doc();
      writes.push({ ref, data: payload });
      previousClosing = closingStock;
    }
  }

  await commitBatches(writes);
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
    await ensureZoneStockDefaults();
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
    await ensureZoneStockDefaults();
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

export const deleteZoneStockEntriesByZone = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    if (!zone) return res.status(400).json({ message: "zone is required" });

    const snapshot = await db.collection(COLLECTION).where("zone", "==", zone).get();
    if (snapshot.empty) {
      return res.status(404).json({ message: "No entries found for zone", zone, count: 0 });
    }

    let deletedCount = 0;
    for (let i = 0; i < snapshot.docs.length; i += 450) {
      const chunk = snapshot.docs.slice(i, i + 450);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
        deletedCount += 1;
      }
      await batch.commit();
    }

    return res.status(200).json({ message: "Zone inventory entries deleted", zone, count: deletedCount });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting zone stock entries", error: error.message });
  }
};

export const resetAllZoneStockEntries = async (_req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    if (snapshot.empty) {
      return res.status(200).json({ message: "No inventory entries to reset", count: 0 });
    }

    let deletedCount = 0;
    for (let i = 0; i < snapshot.docs.length; i += 450) {
      const chunk = snapshot.docs.slice(i, i + 450);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
        deletedCount += 1;
      }
      await batch.commit();
    }

    return res.status(200).json({ message: "All inventory entries reset", count: deletedCount });
  } catch (error) {
    return res.status(500).json({ message: "Error resetting zone stock entries", error: error.message });
  }
};
