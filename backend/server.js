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


// Serve static frontend files
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendPath = path.resolve(__dirname, "../dist");
app.use(express.static(frontendPath));

// API health check
app.get("/api", (req, res) => res.send("EggBucket Backend Running 🚀"));


// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/daily-damage", dailyDamageRoutes);
app.use("/api/neccrate", neccrateRoutes);
app.use("/api/dailysales", dailysalesRoutes);
app.use("/api/distributor", distributorRoutes);
app.use("/api/cash-payments", cashPaymentsRoutes);
app.use("/api/digital-payments", digitalPaymentsRoutes);
app.use("/api/outlets", outletRoutes);

// Serve React app for all other routes (client-side routing)
app.use((req, res) => {
	res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
