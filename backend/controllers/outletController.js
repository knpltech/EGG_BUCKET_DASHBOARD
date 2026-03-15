import { db } from "../config/firebase.js";

const OUTLETS_CACHE_TTL_MS = Number(process.env.OUTLETS_CACHE_TTL_MS || 60_000);
const OUTLETS_STALE_MAX_MS = Number(process.env.OUTLETS_STALE_MAX_MS || 300_000);
const OUTLETS_QUOTA_COOLDOWN_MS = Number(process.env.OUTLETS_QUOTA_COOLDOWN_MS || 60_000);

let outletsCache = {
  data: null,
  fetchedAt: 0,
};
let outletsInFlightPromise = null;
let outletsQuotaBlockedUntil = 0;

const isFirestoreQuotaError = (err) =>
  err?.code === 8 || err?.details === "Quota exceeded.";

const getQuotaRetryAfterSeconds = () => {
  const remainingMs = outletsQuotaBlockedUntil - Date.now();
  if (remainingMs <= 0) return 60;
  return Math.max(1, Math.ceil(remainingMs / 1000));
};

const getCachedOutlets = async ({ allowStaleOnError = true } = {}) => {
  const now = Date.now();
  const hasFreshCache =
    Array.isArray(outletsCache.data) && now - outletsCache.fetchedAt < OUTLETS_CACHE_TTL_MS;

  const hasStaleCache =
    allowStaleOnError &&
    Array.isArray(outletsCache.data) &&
    now - outletsCache.fetchedAt < OUTLETS_STALE_MAX_MS;

  if (hasFreshCache) {
    return { outlets: outletsCache.data, source: "memory-cache" };
  }

  if (outletsQuotaBlockedUntil > now) {
    if (hasStaleCache) {
      return { outlets: outletsCache.data, source: "stale-cache", stale: true };
    }
    const err = new Error("Quota exceeded.");
    err.code = 8;
    err.details = "Quota exceeded.";
    throw err;
  }

  if (outletsInFlightPromise) {
    return outletsInFlightPromise;
  }

  outletsInFlightPromise = (async () => {
    try {
      const snapshot = await db.collection("outlets").get();
      const outlets = Array.isArray(snapshot.docs) ? snapshot.docs.map((doc) => doc.data()) : [];
      outletsCache = { data: outlets, fetchedAt: Date.now() };
      outletsQuotaBlockedUntil = 0;
      return { outlets, source: "firestore" };
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        outletsQuotaBlockedUntil = Date.now() + OUTLETS_QUOTA_COOLDOWN_MS;
      }

      if (hasStaleCache) {
        console.warn("Using stale outlets cache due to Firestore read failure:", err.message);
        return { outlets: outletsCache.data, source: "stale-cache", stale: true, error: err };
      }
      throw err;
    } finally {
      outletsInFlightPromise = null;
    }
  })();

  return outletsInFlightPromise;
};

const upsertOutletInCache = (outlet) => {
  if (!Array.isArray(outletsCache.data) || !outlet?.id) return;
  const existingIndex = outletsCache.data.findIndex((item) => item?.id === outlet.id);
  if (existingIndex >= 0) {
    outletsCache.data[existingIndex] = outlet;
  } else {
    outletsCache.data.push(outlet);
  }
};

const removeOutletFromCache = (id) => {
  if (!Array.isArray(outletsCache.data) || !id) return;
  outletsCache.data = outletsCache.data.filter((item) => item?.id !== id);
};

// Add a new outlet
export const addOutlet = async (req, res) => {
  try {
    console.log('=== ADD OUTLET REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { id, name, area, contact, phone, status, reviewStatus, zoneId, createdBy } = req.body;
    
    console.log('Extracted zoneId:', zoneId);
    
    if (!id || !name || !area || !zoneId) {
      console.log('Missing required fields - id:', id, 'name:', name, 'area:', area, 'zoneId:', zoneId);
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const outletPayload = {
      id,
      name,
      area,
      contact,
      phone,
      status,
      reviewStatus,
      zoneId,
      createdBy: createdBy || null,
      createdAt: new Date()
    };
    await db.collection("outlets").doc(id).set(outletPayload);
    upsertOutletInCache(outletPayload);
    console.log('Outlet saved successfully with zoneId:', zoneId);
    return res.json({ success: true, message: "Outlet added successfully" });
  } catch (err) {
    console.error('Add outlet error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
// Normalize zone for comparison (handles "2" vs "Zone 2" mismatch)
const normalizeZone = (z) => {
  if (!z) return null;
  const str = String(z).toLowerCase().replace('zone', '').trim();
  return str;
};

// Get outlets for a specific zone
export const getZoneOutlets = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { createdBy } = req.query;
    if (!zoneId) {
      return res.status(400).json({ success: false, error: "Missing zoneId" });
    }
    // If Authorization header is present, verify token and ensure a supervisor cannot request other zones
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not set');
        const decoded = jwt.verify(token, secret);
        const requester = decoded?.username;
        if (requester) {
          // If requester exists in supervisors collection, enforce zone match
          const supSnap = await db.collection('supervisors').doc(requester).get();
          if (supSnap.exists) {
            const sup = supSnap.data();
            const userZone = sup.zone || sup.zoneId || sup.zoneNumber || null;
            const normalizeZone = (z) => z ? String(z).toLowerCase().replace('zone', '').trim() : null;
            if (userZone && normalizeZone(userZone) !== normalizeZone(zoneId)) {
              return res.status(403).json({ success: false, error: 'Forbidden: not allowed to access outlets for this zone' });
            }
          }
        }
      } catch (err) {
        // If token invalid, proceed without enforcement (anonymous access still allowed)
        console.warn('Zone access token verification failed:', err.message);
      }
    }

    // Read through shared cache to avoid repeated full collection reads.
    const { outlets: allOutlets, source, stale } = await getCachedOutlets({ allowStaleOnError: true });
    let outlets = Array.isArray(allOutlets) ? allOutlets : [];
    
    // Filter by zone (normalized comparison)
    const normalizedRequestZone = normalizeZone(zoneId);
    outlets = outlets.filter(outlet => normalizeZone(outlet.zoneId) === normalizedRequestZone);
    
    // Filter by createdBy if provided
    if (createdBy) {
      outlets = outlets.filter(outlet => outlet.createdBy === createdBy);
    }
    
    if (source) {
      res.set("X-Outlets-Source", source);
    }
    if (stale) {
      res.set("X-Outlets-Stale", "true");
    }
    console.log('getZoneOutlets - requested zone:', zoneId, '| normalized:', normalizedRequestZone, '| found:', outlets.length, '| source:', source || 'unknown');
    return res.json(outlets);
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      const retryAfter = getQuotaRetryAfterSeconds();
      res.set("Retry-After", String(retryAfter));
      console.warn("getZoneOutlets quota exceeded. Cooling down for", retryAfter, "seconds");
      return res.status(429).json({
        success: false,
        error: "Firestore quota exceeded. Please retry shortly.",
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Get all outlets
export const getAllOutlets = async (req, res) => {
  try {
    const { outlets, source, stale } = await getCachedOutlets({ allowStaleOnError: true });
    if (source) {
      res.set("X-Outlets-Source", source);
    }
    if (stale) {
      res.set("X-Outlets-Stale", "true");
    }
    console.log("getAllOutlets: returned", outlets.length, "outlets | source:", source || "unknown");
    return res.json(Array.isArray(outlets) ? outlets : []);
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      const retryAfter = getQuotaRetryAfterSeconds();
      res.set("Retry-After", String(retryAfter));
      console.warn("getAllOutlets quota exceeded. Cooling down for", retryAfter, "seconds");
      return res.status(429).json({
        success: false,
        error: "Firestore quota exceeded. Please retry shortly.",
      });
    }
    console.error("getAllOutlets error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Delete an outlet by ID
export const deleteOutlet = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Missing outlet ID" });
    }
    await db.collection("outlets").doc(id).delete();
    removeOutletFromCache(id);
    return res.json({ success: true, message: "Outlet deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
