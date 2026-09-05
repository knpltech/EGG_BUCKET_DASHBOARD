import { db } from "../config/firebase.js";

const COLLECTION = "cashClosures";
const OUTLETS_COLLECTION = "outlets";

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

const selectPreferredRow = (current, candidate) => {
  if (!current) return candidate;

  const currentTs = toMillis(current?.updatedAt || current?.createdAt || current?.date);
  const candidateTs = toMillis(candidate?.updatedAt || candidate?.createdAt || candidate?.date);

  if (candidateTs > currentTs) return candidate;
  if (candidateTs < currentTs) return current;

  return candidate;
};

const dedupeRows = (rows) => {
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

export const upsertCashClosure = async (req, res) => {
  try {
    const {
      zone,
      date,
      totalCashAmount,
      incentives,
      foodAllowance,
      advance,
      cashHandover,
      cashRemarks,
      addedBy,
    } = req.body || {};

    const normalizedZone = normalizeZoneLabel(zone);
    const normalizedDate = normalizeDate(date);

    if (!normalizedZone || !normalizedDate) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const payload = {
      zone: normalizedZone,
      date: normalizedDate,
      totalCashAmount: toNumber(totalCashAmount),
      incentives: toNumber(incentives),
      foodAllowance: toNumber(foodAllowance),
      advance: toNumber(advance),
      cashHandover: toNumber(cashHandover),
      cashRemarks: String(cashRemarks ?? "").trim().slice(0, 500),
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

    const zoneSnapshot = await db.collection(COLLECTION).where("zone", "==", normalizedZone).get();
    const matchingDocs = zoneSnapshot.docs
      .map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data(), normalizedDate: normalizeDate(doc.data()?.date || doc.data()?.createdAt) }))
      .filter((row) => row.normalizedDate === normalizedDate)
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt || b.date) - toMillis(a.updatedAt || a.createdAt || a.date));

    if (matchingDocs.length) {
      const primaryDoc = matchingDocs[0];
      const duplicateDocs = matchingDocs.slice(1);

      await primaryDoc.ref.set({ ...payload, date: normalizedDate }, { merge: true });

      for (const duplicate of duplicateDocs) {
        await duplicate.ref.delete();
      }

      const updatedDoc = await primaryDoc.ref.get();
      return res.status(200).json({
        id: updatedDoc.id,
        ...updatedDoc.data(),
        merged: true,
        message: "Cash closure entry updated",
      });
    }

    const docRef = await db.collection(COLLECTION).add({
      ...payload,
      createdAt: new Date(),
    });

    const createdDoc = await docRef.get();
    return res.status(201).json({
      id: createdDoc.id,
      ...createdDoc.data(),
      merged: false,
      message: "Cash closure entry created",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error saving cash closure entry", error: error.message });
  }
};

export const getAllCashClosures = async (_req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    const data = dedupeRows(snapshot.docs.map(mapDoc)).sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.zone || "").localeCompare(String(b.zone || ""));
    });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching cash closure entries", error: error.message });
  }
};

export const getCashClosuresByZone = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    if (!zone) {
      return res.status(400).json({ message: "zone is required" });
    }

    const snapshot = await db.collection(COLLECTION).where("zone", "==", zone).get();
    const data = dedupeRows(snapshot.docs.map(mapDoc)).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching cash closure entries by zone", error: error.message });
  }
};

export const getCashClosuresByZoneAndDate = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    const date = normalizeDate(req.params.date);

    if (!zone || !date) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const snapshot = await db.collection(COLLECTION).where("zone", "==", zone).get();
    const data = dedupeRows(snapshot.docs.map(mapDoc));
    const row = data.find((entry) => entry.zone === zone && normalizeDate(entry.date || entry.createdAt) === date) || null;
    return res.status(200).json(row || {});
  } catch (error) {
    return res.status(500).json({ message: "Error fetching cash closure entry by zone and date", error: error.message });
  }
};

export const deleteCashClosuresByZoneAndDate = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    const date = normalizeDate(req.params.date);

    if (!zone || !date) {
      return res.status(400).json({ message: "zone and date are required" });
    }

    const snapshot = await db.collection(COLLECTION).where("zone", "==", zone).get();
    const matchingDocs = snapshot.docs.filter((doc) => normalizeDate(doc.data()?.date || doc.data()?.createdAt) === date);

    if (!matchingDocs.length) {
      return res.status(404).json({ message: "Entry not found" });
    }

    for (const doc of matchingDocs) {
      await doc.ref.delete();
    }

    return res.status(200).json({ message: "Cash closure entry deleted", count: matchingDocs.length });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting cash closure entry", error: error.message });
  }
};

export const deleteCashClosuresByZone = async (req, res) => {
  try {
    const zone = normalizeZoneLabel(req.params.zone);
    if (!zone) {
      return res.status(400).json({ message: "zone is required" });
    }

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

    return res.status(200).json({ message: "Cash closure entries deleted", zone, count: deletedCount });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting cash closure entries", error: error.message });
  }
};

export const resetAllCashClosures = async (_req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    if (snapshot.empty) {
      return res.status(200).json({ message: "No cash closure entries to reset", count: 0 });
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

    return res.status(200).json({ message: "All cash closure entries reset", count: deletedCount });
  } catch (error) {
    return res.status(500).json({ message: "Error resetting cash closure entries", error: error.message });
  }
};

const normalizeTextKey = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const getZoneOutletAliasMap = (outlets, zone) => {
  const aliases = new Map();
  const normalizedZone = normalizeZoneLabel(zone);

  for (const outlet of outlets || []) {
    if (normalizeZoneLabel(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber) !== normalizedZone) continue;
    // Use the outlet document ID as the canonical key.  Data written by older
    // clients may instead use an area or outlet name, so map every alias to
    // that same physical outlet.
    const canonicalKey = String(outlet?.id || outlet?.area || outlet?.name || "").trim();
    if (!canonicalKey) continue;
    [outlet.id, outlet.name, outlet.area].forEach((key) => {
      const normalizedKey = normalizeTextKey(key);
      if (normalizedKey) aliases.set(normalizedKey, canonicalKey);
    });
  }

  return aliases;
};

const getMergedZoneScopedTotal = (docs, zone, outletAliasMap) => {
  const valuesByOutlet = new Map();
  const normalizedZone = normalizeZoneLabel(zone);

  (docs || []).forEach((doc) => {
    const entry = doc.data() || {};
    const values = entry.outlets && typeof entry.outlets === "object" ? entry.outlets : {};
    const addedByPerOutlet = entry.addedByPerOutlet && typeof entry.addedByPerOutlet === "object"
      ? entry.addedByPerOutlet
      : {};

    Object.entries(values).forEach(([outletKey, rawAmount]) => {
      const matchesUserZone = normalizeZoneLabel(addedByPerOutlet?.[outletKey]?.zone) === normalizedZone;
      const normalizedOutletKey = normalizeTextKey(outletKey);
      const canonicalOutletKey = outletAliasMap.get(normalizedOutletKey);
      const matchesOutlet = Boolean(canonicalOutletKey);
      if (!matchesUserZone && !matchesOutlet) return;

      // Do not count the same outlet twice when one document is keyed by its
      // ID and another by its area/name.  The existing non-zero merge rule is
      // retained so an automatic zero never erases a confirmed value.
      const storageKey = canonicalOutletKey || normalizedOutletKey;
      const nextAmount = toNumber(rawAmount);
      // Prefer an ID-keyed non-zero value over an area/name alias.  A zero ID
      // value deliberately falls back to a non-zero alias, matching the
      // payment/allowance tables in the UI.
      const candidatePriority = canonicalOutletKey
        && normalizedOutletKey === normalizeTextKey(canonicalOutletKey)
        && nextAmount !== 0
        ? 2
        : 1;
      const current = valuesByOutlet.get(storageKey);
      const currentAmount = Number(current?.amount) || 0;
      const shouldReplace = !current
        || candidatePriority > current.priority
        || (candidatePriority === current.priority && (nextAmount !== 0 || currentAmount === 0));
      if (shouldReplace) {
        valuesByOutlet.set(storageKey, { amount: nextAmount, priority: candidatePriority });
      }
    });
  });

  return Array.from(valuesByOutlet.values()).reduce((sum, value) => sum + value.amount, 0);
};

const getCashClosureAutofill = async (zone, date) => {
  const normalizedZone = normalizeZoneLabel(zone);
  const normalizedDate = normalizeDate(date);
  if (!normalizedZone || !normalizedDate) throw new Error("zone and date are required");

  const [outletsSnap, cashSnap, incentivesSnap, foodAllowanceSnap, advanceSnap, syncSnap] = await Promise.all([
    db.collection(OUTLETS_COLLECTION).get(),
    db.collection("cashPayments").where("date", "==", normalizedDate).get(),
    db.collection("incentive").where("date", "==", normalizedDate).get(),
    db.collection("foodAllowance").where("date", "==", normalizedDate).get(),
    db.collection("advance").where("date", "==", normalizedDate).get(),
    db.collection("dailyEntrySyncStatus").doc(normalizedDate).get(),
  ]);

  const outlets = outletsSnap.docs.map(mapDoc);
  const outletAliasMap = getZoneOutletAliasMap(outlets, normalizedZone);
  const zoneOutletIds = outlets
    .filter((outlet) => normalizeZoneLabel(outlet?.zoneId || outlet?.zone || outlet?.zoneNumber) === normalizedZone)
    .map((outlet) => String(outlet?.id || ""))
    .filter(Boolean);
  const syncOutlets = syncSnap.data()?.outlets || {};
  const requiredFields = new Set(["cash", "incentive", "foodAllowance", "advance"]);
  const pendingOutletIds = syncSnap.exists
    ? zoneOutletIds.filter((outletId) => {
      const status = syncOutlets[outletId];
      return !status || status.status === "pending" || (status.pendingFields || []).some((field) => requiredFields.has(field));
    })
    : zoneOutletIds;

  return {
    zone: normalizedZone,
    date: normalizedDate,
    totalCashAmount: getMergedZoneScopedTotal(cashSnap.docs, normalizedZone, outletAliasMap),
    incentives: getMergedZoneScopedTotal(incentivesSnap.docs, normalizedZone, outletAliasMap),
    foodAllowance: getMergedZoneScopedTotal(foodAllowanceSnap.docs, normalizedZone, outletAliasMap),
    advance: getMergedZoneScopedTotal(advanceSnap.docs, normalizedZone, outletAliasMap),
    ready: syncSnap.exists && pendingOutletIds.length === 0,
    pendingOutletIds,
    sourceSyncMissing: !syncSnap.exists,
  };
};

export const getCashClosureAutofillData = async (req, res) => {
  try {
    const data = await getCashClosureAutofill(req.params.zone, req.params.date);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching cash closure autofill data", error: error.message });
  }
};

export const ensureCashClosureEntry = async (zone, date) => {
  const normalizedZone = normalizeZoneLabel(zone);
  const normalizedDate = normalizeDate(date);
  if (!normalizedZone || !normalizedDate) return false;

  const snapshot = await db.collection(COLLECTION).where("zone", "==", normalizedZone).get();
  const hasEntry = snapshot.docs.some((doc) => normalizeDate(doc.data()?.date || doc.data()?.createdAt) === normalizedDate);
  if (hasEntry) return false;

  const autofill = await getCashClosureAutofill(normalizedZone, normalizedDate);
  if (!autofill.ready) {
    console.warn(`Cash closure auto-save skipped for ${normalizedZone} on ${normalizedDate}: ${autofill.sourceSyncMissing ? "Data Entry final sync is missing" : `${autofill.pendingOutletIds.length} outlet(s) are pending`}.`);
    return false;
  }

  await db.collection(COLLECTION).doc(`auto_${normalizedZone.replace(/\s+/g, "_")}_${normalizedDate}`).set({
    zone: normalizedZone,
    date: normalizedDate,
    totalCashAmount: autofill.totalCashAmount,
    incentives: autofill.incentives,
    foodAllowance: autofill.foodAllowance,
    advance: autofill.advance,
    cashHandover: 0,
    cashRemarks: "",
    autoGenerated: true,
    sourceSyncVerified: true,
    sourceSyncCompletedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return true;
};
