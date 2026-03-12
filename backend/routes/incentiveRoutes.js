import express from "express";
import {
  addIncentive,
  getAllIncentives,
  updateIncentive,
  deleteIncentiveByOutletAndDate,
  deleteIncentivesByDate
} from "../controllers/incentiveController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Admin-only delete routes (specific before generic) ──────────────────────
router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteIncentiveByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteIncentivesByDate);

// ── Public / authenticated routes ───────────────────────────────────────────
router.post("/add", addIncentive);
router.get("/all", getAllIncentives);
router.patch("/:id", updateIncentive);

export default router;