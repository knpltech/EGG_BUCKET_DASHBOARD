import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dailyDamageRoutes from "./routes/dailyDamageRoutes.js";
import neccrateRoutes from "./routes/neccrateRoutes.js";
import dailysalesRoutes from "./routes/dailysalesRoutes.js";
import distributorRoutes from "./routes/distributorRoutes.js";
import digitalPaymentsRoutes from "./routes/digitalPaymentsRoutes.js";
import cashPaymentsRoutes from "./routes/cashPaymentsRoutes.js";
import outletRoutes from "./routes/outletRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// ✅ API health check
app.get("/api", (req, res) => {
  res.json({ success: true, message: "EggBucket Backend Running 🚀" });
});

// ✅ API routes ONLY
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/daily-damage", dailyDamageRoutes);
app.use("/api/neccrate", neccrateRoutes);
app.use("/api/dailysales", dailysalesRoutes);
app.use("/api/distributor", distributorRoutes);
app.use("/api/cash-payments", cashPaymentsRoutes);
app.use("/api/digital-payments", digitalPaymentsRoutes);
app.use("/api/outlets", outletRoutes);

// Serve frontend static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../dist");
app.use(express.static(frontendPath));

// Fallback: serve index.html for any non-API route (SPA support)
app.get("/", (req, res) => {
  // If the request starts with /api, skip to next middleware
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
  res.sendFile(path.join(frontendPath, "index.html"));
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
