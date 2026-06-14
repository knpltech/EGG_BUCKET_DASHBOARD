import { db } from "../config/firebase.js";
import { recalculateZoneStockFromDate } from "./zoneStockController.js";

const COLLECTION = "stockOptionsEntries";
const INVENTORY_COLLECTION = "zoneStockEntries";
const ALL_ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

const normalizeZoneLabel = (zone) => {
  if (!zone) return null;
  const raw = String(zone).trim();
  const match = raw.match(/(\d+)/);
  return match ? `Zone ${match[1]}` : raw;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    const date = value.toDate();
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  if (value && typeof value === "object" && value._seconds !== undefined) {
    const date = new Date(value._seconds * 1000);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
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
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMillis = (value) => {
  if (!value) return 0;
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value && typeof value === "object" && value._seconds !== undefined) {
    return value._seconds * 1000;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const mapDoc = (doc) => ({ id: doc.id, ...doc.data() });

const aggregateRowsByZoneDate = (rows) => {
  const byKey = new Map();

  for (const row of rows || []) {
    const zone = normalizeZoneLabel(row?.zone);
    const date = normalizeDate(row?.date || row?.createdAt);
    if (!zone || !date) continue;

    const key = `${zone}__${date}`;
    const current = byKey.get(key);
    const candidateTs = toMillis(row?.updatedAt || row?.createdAt || row?.date);
    const currentTs = current ? toMillis(current?.updatedAt || current?.createdAt || current?.date) : -1;
    const rowStockQuantity = toNumber(row?.stockQuantity);
    const rowInvoiceAmount = toNumber(row?.invoiceAmount ?? rowStockQuantity * toNumber(row?.price));

    if (!current) {
      byKey.set(key, {
        ...row,
        zone,
        date,
        stockQuantity: rowStockQuantity,
        invoiceAmount: rowInvoiceAmount,
      });
      continue;
    }

    current.stockQuantity = toNumber(current.stockQuantity) + rowStockQuantity;
    current.invoiceAmount = toNumber(current.invoiceAmount) + rowInvoiceAmount;

    if (candidateTs >= currentTs) {
      current.updatedAt = row?.updatedAt || row?.createdAt || current.updatedAt;
      current.createdAt = current.createdAt || row?.createdAt;
      current.price = row?.price ?? current.price;
      current.farmName = row?.farmName ?? current.farmName;
      current.remarks = row?.remarks ?? current.remarks;
      current.addedBy = row?.addedBy ?? current.addedBy;
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const dateDiff = String(b.date).localeCompare(String(a.date));
    if (dateDiff !== 0) return dateDiff;
    return toMillis(b.updatedAt || b.createdAt || b.date) - toMillis(a.updatedAt || a.createdAt || a.date);
  });
};

const getLatestInventoryDocForZoneDate = async (zone, date) => {
  const snapshot = await db
    .collection(INVENTORY_COLLECTION)
    .where("zone", "==", zone)
    .where("date", "==", date)
    .get();

  if (snapshot.empty) return null;

  return snapshot.docs
    .map((doc) => ({ ref: doc.ref, id: doc.id, ...doc.data() }))
    .sort((a, b) => toMillis(b.updatedAt || b.createdAt || b.date) - toMillis(a.updatedAt || a.createdAt || a.date))[0] || null;
};

const getStockOptionDocsForZoneDate = async (zone, date) => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("zone", "==", zone)
    .where("date", "==", date)
    .get();

  return snapshot.docs.map((doc) => ({ ref: doc.ref, id: doc.id, ...doc.data() }));
};

const syncInventoryStockIn = async (zone, date, stockIn, addedBy) => {
  const latestInventoryDoc = await getLatestInventoryDocForZoneDate(zone, date);
  const payload = {
    zone,
    date,
    stockIn: toNumber(stockIn),
    updatedAt: new Date(),
  };

  if (addedBy && typeof addedBy === "object") {
    payload.addedBy = {
      username: addedBy.username || "unknown",
      role: addedBy.role || "unknown",
      zone: addedBy.zone || zone,
      timestamp: addedBy.timestamp || new Date().toISOString(),
    };
  }

  if (latestInventoryDoc) {
    await latestInventoryDoc.ref.set(payload, { merge: true });

    const duplicateDocs = await db
      .collection(INVENTORY_COLLECTION)
      .where("zone", "==", zone)
      .where("date", "==", date)
      .get();

    const duplicates = duplicateDocs.docs
      .map((doc) => ({ ref: doc.ref, id: doc.id, ...doc.data() }))
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt || b.date) - toMillis(a.updatedAt || a.createdAt || a.date));

    for (const duplicate of duplicates.slice(1)) {
      await duplicate.ref.delete();
    }
  } else {
    await db.collection(INVENTORY_COLLECTION).add({
      ...payload,
      openingStock: 0,
      salesQty: 0,
      damagesQty: 0,
      closingStock: toNumber(stockIn),
      createdAt: new Date(),
      inv_remark: "",
      remarks: "",
    });
  }

  await recalculateZoneStockFromDate(zone, date);
};

const normalizeRows = (rows) => {
  return (rows || [])
    .map((row) => {
      const zone = normalizeZoneLabel(row?.zone);
      const date = normalizeDate(row?.date || row?.createdAt);
      if (!zone || !date) return null;
      return {
        ...row,
        zone,
        date,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateDiff = String(b.date).localeCompare(String(a.date));
      if (dateDiff !== 0) return dateDiff;
      return toMillis(b.updatedAt || b.createdAt || b.date) - toMillis(a.updatedAt || a.createdAt || a.date);
    });
};

const buildEntryPayload = (body = {}) => {
  const zone = normalizeZoneLabel(body.zone);
  const date = normalizeDate(body.date);

  if (!zone || !date) return null;

  const payload = {
    zone,
    date,
    stockQuantity: toNumber(body.stockQuantity),
    price: toNumber(body.price),
    invoiceAmount: toNumber(body.invoiceAmount ?? toNumber(body.stockQuantity) * toNumber(body.price)),
    farmName: String(body.farmName || "").trim().slice(0, 200),
    remarks: String(body.remarks || "").trim().slice(0, 500),
    updatedAt: new Date(),
  };

  if (body.addedBy && typeof body.addedBy === "object") {
    payload.addedBy = {
      username: body.addedBy.username || "unknown",
      role: body.addedBy.role || "unknown",
      zone: body.addedBy.zone || zone,
      timestamp: body.addedBy.timestamp || new Date().toISOString(),
    };
  }

  return payload;
};

export const createStockOptionEntry = async (req, res) => {
  try {
    const payload = buildEntryPayload(req.body || {});
    if (!payload) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const existingDocs = await getStockOptionDocsForZoneDate(payload.zone, payload.date);
    const existingTotal = existingDocs.reduce((sum, row) => sum + toNumber(row.stockQuantity), 0);
    const updatedQuantity = existingTotal + toNumber(payload.stockQuantity);
    const updatedInvoiceAmount = updatedQuantity * toNumber(payload.price);

    const canonicalDoc = existingDocs
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt || b.date) - toMillis(a.updatedAt || a.createdAt || a.date))[0] || null;

    const storedPayload = {
      ...payload,
      stockQuantity: updatedQuantity,
      invoiceAmount: updatedInvoiceAmount,
      updatedAt: new Date(),
    };

    let docRef = canonicalDoc?.ref || null;
    if (docRef) {
      await docRef.set(storedPayload, { merge: true });
      for (const duplicate of existingDocs.slice(1)) {
        await duplicate.ref.delete();
      }
    } else {
      docRef = await db.collection(COLLECTION).add({
        ...storedPayload,
        createdAt: new Date(),
      });
    }

    await syncInventoryStockIn(payload.zone, payload.date, updatedQuantity, payload.addedBy);

    const createdDoc = await docRef.get();
    return res.status(existingDocs.length ? 200 : 201).json({ id: createdDoc.id, ...createdDoc.data() });
  } catch (error) {
    return res.status(500).json({ message: "Error saving stock entry", error: error.message });
  }
};

export const getAllStockOptionEntries = async (_req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    const rows = aggregateRowsByZoneDate(normalizeRows(snapshot.docs.map(mapDoc)));
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching stock entries", error: error.message });
  }
};

export const getStockOptionEntriesByDate = async (req, res) => {
  try {
    const normalizedDate = normalizeDate(req.params.date);
    if (!normalizedDate) {
      return res.status(400).json({ message: "date is required" });
    }

    const snapshot = await db.collection(COLLECTION).where("date", "==", normalizedDate).get();
    const rows = aggregateRowsByZoneDate(normalizeRows(snapshot.docs.map(mapDoc))).filter((row) => row.date === normalizedDate);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching stock entries by date", error: error.message });
  }
};

export const getStockOptionEntriesByZone = async (req, res) => {
  try {
    const normalizedZone = normalizeZoneLabel(req.params.zone);
    if (!normalizedZone) {
      return res.status(400).json({ message: "zone is required" });
    }

    const snapshot = await db.collection(COLLECTION).where("zone", "==", normalizedZone).get();
    const rows = aggregateRowsByZoneDate(normalizeRows(snapshot.docs.map(mapDoc))).filter((row) => row.zone === normalizedZone);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching stock entries by zone", error: error.message });
  }
};

export const getStockOptionEntriesByZoneAndDate = async (req, res) => {
  try {
    const normalizedZone = normalizeZoneLabel(req.params.zone);
    const normalizedDate = normalizeDate(req.params.date);
    if (!normalizedZone || !normalizedDate) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const snapshot = await db
      .collection(COLLECTION)
      .where("zone", "==", normalizedZone)
      .where("date", "==", normalizedDate)
      .get();

    const rows = aggregateRowsByZoneDate(normalizeRows(snapshot.docs.map(mapDoc))).filter((row) => row.zone === normalizedZone && row.date === normalizedDate);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching stock entries by zone and date", error: error.message });
  }
};
