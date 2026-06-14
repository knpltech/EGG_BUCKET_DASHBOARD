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

const normalizeTextKey = (value) => {
  if (value == null) return "";
  return String(value).trim().toLowerCase();
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
    const outletRef = {
      id: outlet?.id,
      area: outlet?.area,
      name: outlet?.name,
    };
    if (outletRef.id || outletRef.area || outletRef.name) {
      map.get(zone).push(outletRef);
    }
  }
  for (const zone of map.keys()) {
    const uniqueById = new Map();
    for (const outletRef of map.get(zone)) {
      const uniqueKey = normalizeTextKey(outletRef.id || outletRef.area || outletRef.name);
      if (!uniqueKey || uniqueById.has(uniqueKey)) continue;
      uniqueById.set(uniqueKey, outletRef);
    }
    map.set(zone, Array.from(uniqueById.values()));
  }
  return map;
};

const getValueForOutletRef = (values, outletRef, normalizedValueMap) => {
  const directKeys = [outletRef?.id, outletRef?.area, outletRef?.name].filter(Boolean);
  for (const key of directKeys) {
    if (values[key] !== undefined) return toNumber(values[key]);
  }

  for (const key of directKeys) {
    const normalizedKey = normalizeTextKey(key);
    if (normalizedKey && normalizedValueMap.has(normalizedKey)) {
      return toNumber(normalizedValueMap.get(normalizedKey));
    }
  }

  return 0;
};

const sumValuesByOutletRefs = (values, outletRefs) => {
  if (!values || typeof values !== "object" || Array.isArray(values)) return 0;

  const normalizedValueMap = new Map();
  for (const [rawKey, rawValue] of Object.entries(values)) {
    const normalizedKey = normalizeTextKey(rawKey);
    if (!normalizedKey) continue;
    normalizedValueMap.set(normalizedKey, toNumber(rawValue));
  }

  return (outletRefs || []).reduce((sum, outletRef) => {
    return sum + getValueForOutletRef(values, outletRef, normalizedValueMap);
  }, 0);
};

const getLatestRowsByDate = (rows, valueKey) => {
  const byDate = new Map();
  for (const row of rows || []) {
    const date = normalizeDate(row?.date || row?.createdAt);
    if (!date) continue;
    const existing = byDate.get(date);
    const currentTs = toMillis(row?.updatedAt || row?.createdAt || row?.date);
    const existingTs = existing ? toMillis(existing?.updatedAt || existing?.createdAt || existing?.date) : -1;
    if (!existing || currentTs >= existingTs) {
      byDate.set(date, row?.[valueKey]);
    }
  }
  return byDate;
};

const computeZoneDayTotals = async (zone, dateIso) => {
  const [outletsSnap, salesSnap, damagesSnap] = await Promise.all([
    db.collection(OUTLETS_COLLECTION).get(),
    db.collection(DAILY_SALES_COLLECTION).where("date", "==", dateIso).get(),
    db.collection(DAILY_DAMAGES_COLLECTION).where("date", "==", dateIso).get(),
  ]);

  const outletRows = outletsSnap.docs.map(mapDoc);
  const zoneOutletsMap = getZoneOutletMap(outletRows);
  const outletKeys = zoneOutletsMap.get(zone) || [];

  const salesRows = salesSnap.docs.map(mapDoc);
  const damageRows = damagesSnap.docs.map(mapDoc);

  const salesDoc = getLatestDocByDate(salesRows, dateIso);
  const damagesDoc = getLatestDocByDate(damageRows, dateIso);

  return {
    salesQty: sumValuesByOutletRefs(salesDoc?.outlets, outletKeys),
    damagesQty: sumValuesByOutletRefs(damagesDoc?.damages, outletKeys),
  };
};

const getPreviousClosingStock = async (zone, dateIso) => {
  const snap = await db.collection(COLLECTION).where("zone", "==", zone).get();
  if (snap.empty) return 0;
  const previous = snap.docs
    .map(mapDoc)
    .map((row) => ({
      ...row,
      normalizedDate: normalizeDate(row?.date || row?.createdAt),
    }))
    // ignore auto-default rows when computing previous closing
    .filter((row) => !row.isAutoDefault)
    .filter((row) => row.normalizedDate && String(row.normalizedDate).localeCompare(String(dateIso)) < 0)
    .sort((a, b) => String(b.normalizedDate).localeCompare(String(a.normalizedDate)))[0];

  return previous ? toNumber(previous.closingStock) : 0;
};

export const recalculateZoneStockFromDate = async (zone, startDate) => {
  const normalizedZone = normalizeZoneLabel(zone);
  const normalizedStartDate = normalizeDate(startDate);
  if (!normalizedZone || !normalizedStartDate) return 0;

  const [zoneSnap, outletsSnap, salesSnap, damagesSnap] = await Promise.all([
    db.collection(COLLECTION).where("zone", "==", normalizedZone).get(),
    db.collection(OUTLETS_COLLECTION).get(),
    db.collection(DAILY_SALES_COLLECTION).get(),
    db.collection(DAILY_DAMAGES_COLLECTION).get(),
  ]);

  if (zoneSnap.empty) return 0;

  const zoneRowsRaw = zoneSnap.docs
    .map((doc) => ({ ref: doc.ref, id: doc.id, ...doc.data() }))
    .map((row) => ({
      ...row,
      normalizedDate: normalizeDate(row?.date || row?.createdAt),
    }))
    // Exclude auto-default rows from recalculation seed data
    .filter((row) => row.normalizedDate && !row.isAutoDefault);

  const latestByDate = new Map();
  for (const row of zoneRowsRaw) {
    const existing = latestByDate.get(row.normalizedDate);
    const rowTs = toMillis(row.updatedAt || row.createdAt || row.date);
    const existingTs = existing ? toMillis(existing.updatedAt || existing.createdAt || existing.date) : -1;
    if (!existing || rowTs >= existingTs) {
      latestByDate.set(row.normalizedDate, row);
    }
  }

  const zoneRows = Array.from(latestByDate.values()).sort((a, b) => String(a.normalizedDate).localeCompare(String(b.normalizedDate)));

  const previousRow = zoneRows
    .filter((row) => String(row.normalizedDate).localeCompare(String(normalizedStartDate)) < 0)
    .sort((a, b) => String(b.normalizedDate).localeCompare(String(a.normalizedDate)))[0];

  let previousClosing = previousRow ? toNumber(previousRow.closingStock) : 0;
  const rowsToRecalculate = zoneRows.filter((row) => String(row.normalizedDate).localeCompare(String(normalizedStartDate)) >= 0);
  if (!rowsToRecalculate.length) return 0;

  const outletRows = outletsSnap.docs.map(mapDoc);
  const zoneOutletsMap = getZoneOutletMap(outletRows);
  const outletKeys = zoneOutletsMap.get(normalizedZone) || [];

  const salesRows = salesSnap.docs.map(mapDoc);
  const damagesRows = damagesSnap.docs.map(mapDoc);
  const latestSalesByDate = getLatestRowsByDate(salesRows, "outlets");
  const latestDamagesByDate = getLatestRowsByDate(damagesRows, "damages");

  const writes = [];

  for (const row of rowsToRecalculate) {
    const rowDate = row.normalizedDate;
    const salesQty = sumValuesByOutletRefs(latestSalesByDate.get(rowDate), outletKeys);
    const damagesQty = sumValuesByOutletRefs(latestDamagesByDate.get(rowDate), outletKeys);
    const stockIn = toNumber(row.stockIn);
    const closingStock = previousClosing + stockIn - salesQty - damagesQty;

    writes.push({
      ref: row.ref,
      data: {
        openingStock: previousClosing,
        salesQty,
        damagesQty,
        closingStock,
        inv_remark: String(row.inv_remark ?? row.remarks ?? "").trim().slice(0, 500),
        remarks: String(row.inv_remark ?? row.remarks ?? "").trim().slice(0, 500),
        updatedAt: new Date(),
      },
    });

    previousClosing = closingStock;
  }

  return commitBatches(writes, { merge: true });
};

const commitBatches = async (refsAndData, options = {}) => {
  if (!refsAndData.length) return 0;
  const { merge = false } = options;
  let written = 0;
  for (let i = 0; i < refsAndData.length; i += 450) {
    const chunk = refsAndData.slice(i, i + 450);
    const batch = db.batch();
    for (const item of chunk) {
      if (merge) {
        batch.set(item.ref, item.data, { merge: true });
      } else {
        batch.set(item.ref, item.data);
      }
      written += 1;
    }
    await batch.commit();
  }
  return written;
};

const ensureZoneStockDefaults = async () => {
  // Historically this function auto-created default rows for missing dates.
  // To ensure only explicit user-entered inventory rows are stored and
  // returned by the API, skip creating any auto-default documents here.
  // This makes the endpoints return only manually created entries.
  return 0;
};

const mapDoc = (doc) => ({ id: doc.id, ...doc.data() });

const hasNonEmptyRemarks = (row) => String(row?.inv_remark ?? row?.remarks ?? "").trim().length > 0;

const selectPreferredRow = (current, candidate) => {
  if (!current) return candidate;
  const currentTs = toMillis(current?.updatedAt || current?.createdAt || current?.date);
  const candidateTs = toMillis(candidate?.updatedAt || candidate?.createdAt || candidate?.date);
  if (candidateTs > currentTs) return candidate;
  if (candidateTs < currentTs) return current;

  const currentHasRemarks = hasNonEmptyRemarks(current);
  const candidateHasRemarks = hasNonEmptyRemarks(candidate);
  if (candidateHasRemarks && !currentHasRemarks) return candidate;
  if (!candidateHasRemarks && currentHasRemarks) return current;

  return candidate;
};

const dedupeZoneStockRows = (rows) => {
  const byZoneDate = new Map();

  for (const row of rows || []) {
    const zone = normalizeZoneLabel(row?.zone);
    const date = normalizeDate(row?.date || row?.createdAt);
    if (!zone || !date) continue;

    const key = `${zone}__${date}`;
    const normalizedRow = {
      ...row,
      zone,
      date,
    };

    byZoneDate.set(key, selectPreferredRow(byZoneDate.get(key), normalizedRow));
  }

  return Array.from(byZoneDate.values());
};

const getEarliestDateByZone = (rows) => {
  const earliestByZone = new Map();

  for (const row of rows || []) {
    // Ignore auto-default rows when finding earliest manual date
    if (row?.isAutoDefault) continue;
    const zone = normalizeZoneLabel(row?.zone);
    const date = normalizeDate(row?.date || row?.createdAt);
    if (!zone || !date) continue;

    const existing = earliestByZone.get(zone);
    if (!existing || String(date).localeCompare(String(existing)) < 0) {
      earliestByZone.set(zone, date);
    }
  }

  return earliestByZone;
};

const recalculateAllZonesFromEarliestDate = async () => {
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) return;

  const rows = snapshot.docs.map(mapDoc);
  const earliestByZone = getEarliestDateByZone(rows);
  if (!earliestByZone.size) return;

  const tasks = [];
  for (const [zone, earliestDate] of earliestByZone.entries()) {
    tasks.push(recalculateZoneStockFromDate(zone, earliestDate));
  }

  await Promise.all(tasks);
};

export const upsertZoneStockEntry = async (req, res) => {
  try {
    const { zone, date, stockIn, inv_remark, remarks, addedBy } = req.body || {};

    const normalizedZone = normalizeZoneLabel(zone);
    const normalizedDate = normalizeDate(date);

    if (!normalizedZone || !normalizedDate) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const computedTotals = await computeZoneDayTotals(normalizedZone, normalizedDate);
    const normalizedOpeningStock = await getPreviousClosingStock(normalizedZone, normalizedDate);
    const normalizedStockIn = toNumber(stockIn);
    const normalizedRemark = String(inv_remark ?? remarks ?? "").trim().slice(0, 500);
    const computedClosingStock = normalizedOpeningStock + normalizedStockIn - computedTotals.salesQty - computedTotals.damagesQty;

    const payload = {
      zone: normalizedZone,
      date: normalizedDate,
      openingStock: normalizedOpeningStock,
      stockIn: normalizedStockIn,
      inv_remark: normalizedRemark,
      remarks: normalizedRemark,
      salesQty: computedTotals.salesQty,
      damagesQty: computedTotals.damagesQty,
      closingStock: computedClosingStock,
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

    const zoneSnap = await db.collection(COLLECTION).where("zone", "==", normalizedZone).get();

    const matchingDocs = zoneSnap.docs
      .map((doc) => ({
        id: doc.id,
        ref: doc.ref,
        ...doc.data(),
        normalizedDate: normalizeDate(doc.data()?.date || doc.data()?.createdAt),
      }))
      .filter((row) => row.normalizedDate === normalizedDate)
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt || b.date) - toMillis(a.updatedAt || a.createdAt || a.date));

    const requesterRole = String(addedBy?.role || "").trim().toLowerCase();
    if (requesterRole === "supervisor" && matchingDocs.length) {
      return res.status(409).json({
        message: "Inventory entry locked. Supervisors can submit zone stock only once per day.",
      });
    }

    if (matchingDocs.length) {
      const primaryDoc = matchingDocs[0];
      const duplicateDocs = matchingDocs.slice(1);
      const finalRemarks = normalizedRemark;

      const updatePayload = {
        ...payload,
        inv_remark: finalRemarks,
        remarks: finalRemarks,
        date: normalizedDate,
      };

      await primaryDoc.ref.set(updatePayload, { merge: true });

      for (const duplicate of duplicateDocs) {
        await duplicate.ref.delete();
      }

      const recalculated = await recalculateZoneStockFromDate(normalizedZone, normalizedDate);
      
      const updatedDoc = await primaryDoc.ref.get();
      const returnData = { id: updatedDoc.id, ...updatedDoc.data() };
      return res.status(200).json({
        ...returnData,
        merged: true,
        recalculated,
        message: "Zone stock entry updated and future days recalculated",
      });
    }

    const docRef = await db.collection(COLLECTION).add({
      ...payload,
      createdAt: new Date(),
    });

    const recalculated = await recalculateZoneStockFromDate(normalizedZone, normalizedDate);

    const createdDoc = await docRef.get();
    const returnData = { id: createdDoc.id, ...createdDoc.data() };

    return res.status(201).json({
      ...returnData,
      merged: false,
      recalculated,
      message: "Zone stock entry created and future days recalculated",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error saving zone stock entry", error: error.message });
  }
};

export const getAllZoneStockEntries = async (_req, res) => {
  try {
    // Do not auto-create defaults. Recalculate if needed but return only
    // explicit (non-auto-default) rows to the client.
    await recalculateAllZonesFromEarliestDate();
    const snapshot = await db.collection(COLLECTION).get();
    const allRows = dedupeZoneStockRows(snapshot.docs.map(mapDoc));
    const data = allRows
      .filter((r) => !r.isAutoDefault)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    return res.status(200).json(data);
  } catch (error) {
    console.error("[zoneStockController] getZoneStockEntriesByZone error:", error);
    return res.status(500).json({ message: "Error fetching zone stock entries", error: error.message });
  }
};

export const getZoneStockEntriesByDate = async (req, res) => {
  try {
    const date = normalizeDate(req.params.date);
    if (!date) return res.status(400).json({ message: "date is required" });

    const snapshot = await db.collection(COLLECTION).where("date", "==", date).get();
    const rows = dedupeZoneStockRows(snapshot.docs.map(mapDoc))
      .filter((r) => !r.isAutoDefault)
      .sort((a, b) => String(a.zone || "").localeCompare(String(b.zone || "")));
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching zone stock entries by date", error: error.message });
  }
};

export const getZoneStockEntriesByZone = async (req, res) => {
  try {
    // Do not create defaults; return only user-entered rows below.
    const zone = normalizeZoneLabel(req.params.zone);
    if (!zone) return res.status(400).json({ message: "zone is required" });
    // Recalculate from earliest manual date (fetch earliest only for efficiency)
    try {
      const earliestSnap = await db.collection(COLLECTION).where("zone", "==", zone).orderBy("date", "asc").limit(1).get();
      if (!earliestSnap.empty) {
        const first = earliestSnap.docs[0];
        const earliestDate = normalizeDate(mapDoc(first)?.date || first?.data()?.createdAt);
        if (earliestDate) await recalculateZoneStockFromDate(zone, earliestDate);
      }
    } catch (err) {
      // If ordering by date fails (no index), fall back to conservative full recalculation
      try {
        const zoneSnapshot = await db.collection(COLLECTION).where("zone", "==", zone).get();
        if (!zoneSnapshot.empty) {
          const earliestDate = zoneSnapshot.docs
            .map(mapDoc)
            .map((row) => normalizeDate(row?.date || row?.createdAt))
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b)))[0];
          if (earliestDate) await recalculateZoneStockFromDate(zone, earliestDate);
        }
      } catch (__) {}
    }

    // Support optional ?days= parameter. If days is provided and not 'all', return only last N days.
    const daysParam = String(req.query.days || "").trim().toLowerCase();
    let query = db.collection(COLLECTION).where("zone", "==", zone);
    if (daysParam && daysParam !== "all") {
      const daysNum = Number.parseInt(daysParam, 10) || 30;
      const fromIso = addDays(getIsoToday(), -(daysNum - 1));
      if (fromIso) {
        try {
          query = query.where("date", ">=", fromIso).orderBy("date", "desc");
        } catch (err) {
          // If Firestore index not available for range query, fall back to client-side filter below
        }
      }
    }

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (err) {
      console.warn("[zoneStockController] Query with date filter failed, falling back to zone-only fetch:", err.message);
      // Fall back to fetching by zone only and apply client-side filtering below
      snapshot = await db.collection(COLLECTION).where("zone", "==", zone).get();
    }

    let rows = snapshot.docs.map(mapDoc);

    // If we couldn't apply server-side date filter (or index missing) apply client-side filter.
    if (daysParam && daysParam !== "all") {
      const daysNum = Number.parseInt(daysParam, 10) || 30;
      const fromIso = addDays(getIsoToday(), -(daysNum - 1));
      if (fromIso) {
        rows = rows.filter((r) => {
          const d = normalizeDate(r?.date || r?.createdAt);
          return d && String(d).localeCompare(String(fromIso)) >= 0;
        });
      }
    }

    const data = dedupeZoneStockRows(rows).filter((r) => !r.isAutoDefault).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching zone stock entries", error: error.message });
  }
};

export const getZoneStockEntriesByZoneAndDate = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    const date = normalizeDate(req.params.date);
    if (!zone || !date) return res.status(400).json({ message: "zone and date are required" });
    const snapshot = await db.collection(COLLECTION)
      .where("zone", "==", zone)
      .where("date", "==", date)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(200).json({});

    const row = mapDoc(snapshot.docs[0]);
    if (row.isAutoDefault) return res.status(200).json({});

    return res.status(200).json(row);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching zone stock entry by zone and date", error: error.message });
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

