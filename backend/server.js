import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Main route
app.get("/", (req, res) => {
  res.send("EggBucket Backend Running 🚀");
});

// Auth Routes
app.use("/api/auth", authRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
