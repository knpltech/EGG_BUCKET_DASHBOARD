import "dotenv/config";
import express from "express";
import cors from "cors";

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



const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Backend running at http://localhost:${PORT}`)
);
