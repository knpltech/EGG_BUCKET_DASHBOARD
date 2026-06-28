const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 100;

const responseCache = new Map();

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildCacheKey = (req, namespace) => {
  const params = new URLSearchParams();
  Object.entries(req.query || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, String(item)));
      } else if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });

  const query = params.toString();
  return `${namespace || "default"}:${req.baseUrl}${req.path}${query ? `?${query}` : ""}`;
};

const pruneCache = (maxEntries) => {
  if (responseCache.size <= maxEntries) return;

  const entriesToRemove = responseCache.size - maxEntries;
  const keys = responseCache.keys();
  for (let index = 0; index < entriesToRemove; index += 1) {
    const next = keys.next();
    if (next.done) break;
    responseCache.delete(next.value);
  }
};

export const cacheJsonResponse = ({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  namespace = "api",
  shouldCache = null,
} = {}) => {
  const cacheTtlMs = toPositiveNumber(ttlMs, DEFAULT_TTL_MS);
  const cacheMaxEntries = toPositiveNumber(maxEntries, DEFAULT_MAX_ENTRIES);

  return (req, res, next) => {
    if (req.method !== "GET") return next();
    if (typeof shouldCache === "function" && !shouldCache(req)) return next();

    const key = buildCacheKey(req, namespace);
    const now = Date.now();
    const cached = responseCache.get(key);

    if (cached && now - cached.storedAt < cacheTtlMs) {
      res.set("X-Cache", "HIT");
      res.set("X-Cache-Age", String(Math.floor((now - cached.storedAt) / 1000)));
      return res.status(cached.statusCode).json(cached.body);
    }

    if (cached) responseCache.delete(key);

    const originalJson = res.json.bind(res);
    res.set("X-Cache", "MISS");

    res.json = (body) => {
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 300) {
        responseCache.set(key, {
          body,
          statusCode,
          storedAt: Date.now(),
        });
        pruneCache(cacheMaxEntries);
      }

      return originalJson(body);
    };

    return next();
  };
};

export const clearResponseCache = (namespace = "") => {
  if (!namespace) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.startsWith(`${namespace}:`)) responseCache.delete(key);
  }
};
