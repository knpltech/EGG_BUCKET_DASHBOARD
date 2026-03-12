import express from "express";
import {
  addDailySales,
  getAllDailySales,
  updateDailySales,
  deleteDailySalesByDate,
  deleteDailySalesByOutletAndDate
} from "../controllers/dailysalesController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js"; // adjust path if different

const router = express.Router();

// ── Admin-only delete routes (specific before generic) ──────────────────────
router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteDailySalesByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteDailySalesByDate);

// ── Public / authenticated routes ───────────────────────────────────────────
router.get("/all", getAllDailySales);
router.post("/add", addDailySales);
router.patch("/:id", updateDailySales);

export default router;