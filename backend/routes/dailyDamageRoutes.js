import express from "express";
import {
  addDailyDamage,
  updateDailyDamage,
  deleteDailyDamagesByDate,
  deleteDailyDamageByOutletAndDate
} from "../controllers/dailyDamageController.js";
import { getAllDailyDamages } from "../controllers/dailyDamageGetController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Admin-only delete routes (specific before generic) ──────────────────────
router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteDailyDamageByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteDailyDamagesByDate);

// ── Public / authenticated routes ───────────────────────────────────────────
router.get("/all", getAllDailyDamages);
router.post("/add-daily-damage", addDailyDamage);
router.patch("/:id", updateDailyDamage);

export default router;