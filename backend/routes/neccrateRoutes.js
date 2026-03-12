import express from "express";
import {
  addNeccRate,
  getAllNeccRates,
  updateNeccRate,
  deleteNeccRatesByDate,
  deleteNeccRateByOutletAndDate
} from "../controllers/neccrateController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Admin-only delete routes (specific before generic) ──────────────────────
router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteNeccRateByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteNeccRatesByDate);

// ── Public / authenticated routes ───────────────────────────────────────────
router.get("/all", getAllNeccRates);
router.post("/add", addNeccRate);
router.patch("/:id", updateNeccRate);

export default router;