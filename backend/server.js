import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./config/firebase.js";
import { cacheJsonResponse } from "./middleware/responseCache.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import incentiveRoutes from "./routes/incentiveRoutes.js";
import advanceRoutes from "./routes/advanceRoutes.js";
import foodAllowanceRoutes from "./routes/foodAllowanceRoutes.js";
import dailyDamageRoutes from "./routes/dailyDamageRoutes.js";
import neccrateRoutes from "./routes/neccrateRoutes.js";
import dailysalesRoutes from "./routes/dailysalesRoutes.js";
import distributorRoutes from "./routes/distributorRoutes.js";
import digitalPaymentsRoutes from "./routes/digitalPaymentsRoutes.js";
import cashPaymentsRoutes from "./routes/cashPaymentsRoutes.js";
import outletRoutes from "./routes/outletRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js"; // ← ADD THIS LINE
import supervisorRoutes from "./routes/supervisorRoutes.js";
import dataEntryRoutes from "./routes/dataEntryRoutes.js";
import zoneStockRoutes from "./routes/zoneStockRoutes.js";
import stockOptionsRoutes from "./routes/stockOptionsRoutes.js";
import cashClosureRoutes from "./routes/cashClosureRoutes.js";
import remarksRoutes from "./routes/remarksRoutes.js";
import outletSummaryRoutes from "./routes/outletSummaryRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const env = globalThis.process?.env || {};
const HEAVY_GET_CACHE_TTL_MS = Number(env.HEAVY_GET_CACHE_TTL_MS || 30_000);
const HEAVY_GET_CACHE_PATHS = new Set([
  "/api/dailysales/all",
  "/api/daily-damage/all",
  "/api/cash-payments/all",
  "/api/digital-payments/all",
  "/api/neccrate/all",
  "/api/incentive/all",
  "/api/advance/all",
  "/api/food-allowance/all",
  "/api/remarks/all",
  "/api/cash-closure/all",
  "/api/zone-stock/all",
  "/api/stock-options/all",
]);

app.use(cors());
app.use(express.json());
app.use(cacheJsonResponse({
  ttlMs: HEAVY_GET_CACHE_TTL_MS,
  maxEntries: 200,
  namespace: "heavy-get",
  shouldCache: (req) => HEAVY_GET_CACHE_PATHS.has(req.path),
}));

// Optional Firestore warmup. Keep disabled by default to avoid an extra read on startup.
if (String(env.ENABLE_FIRESTORE_WARMUP || "").toLowerCase() === "true") {
  (async () => {
    try {
      await db.collection("admin").limit(1).get();
      console.log("✅ Firestore connection warmed up");
    } catch (err) {
      console.log("⚠️ Firestore warmup failed:", err.message);
    }
  })();
}

// ✅ API health check
app.get("/api", (req, res) => {
  res.json({ success: true, message: "EggBucket Backend Running 🚀" });
});

// ✅ API routes ONLY
app.use("/api/auth", authRoutes);
app.use("/api/incentive", incentiveRoutes);
app.use("/api/advance", advanceRoutes);
app.use("/api/food-allowance", foodAllowanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/daily-damage", dailyDamageRoutes);
app.use("/api/neccrate", neccrateRoutes);
app.use("/api/dailysales", dailysalesRoutes);
app.use("/api/distributor", distributorRoutes);
app.use("/api/cash-payments", cashPaymentsRoutes);
app.use("/api/digital-payments", digitalPaymentsRoutes);
app.use("/api/outlets", outletRoutes);
app.use("/api/reports", reportsRoutes); // ← ADD THIS LINE
app.use("/api/supervisor", supervisorRoutes);
app.use("/api/data-entry", dataEntryRoutes);
app.use("/api/zone-stock", zoneStockRoutes);
app.use("/api/stock-options", stockOptionsRoutes);
app.use("/api/cash-closure", cashClosureRoutes);
app.use("/api/remarks", remarksRoutes);
app.use("/api/outlet-summary", outletSummaryRoutes);

const PORT = env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Backend running at http://localhost:${PORT}`)
);

// Serve frontend static files
const frontendPath = path.join(__dirname, "../dist");
app.use(express.static(frontendPath));

// Fallback: serve index.html for any non-API route (SPA support)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});
