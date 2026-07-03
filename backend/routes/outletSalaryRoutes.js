import express from "express";
import {
  getOutletSalaryEntries,
  getOutletSalaryEntryByMonth,
  upsertOutletSalaryEntry,
} from "../controllers/outletSalaryController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/all", getOutletSalaryEntries);
router.get("/:year/:month", getOutletSalaryEntryByMonth);
router.post("/upsert", verifyAdmin, upsertOutletSalaryEntry);

export default router;
