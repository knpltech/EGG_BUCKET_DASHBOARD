import express from "express";
import {
  getOutletSalaryEntries,
  getOutletSalaryEntryByMonth,
  upsertOutletSalaryEntry,
  getDailySalaryRates,
  getOutletSalesDays,
  saveDailySalaryRate,
} from "../controllers/outletSalaryController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/all", getOutletSalaryEntries);
router.get("/daily-rates", getDailySalaryRates);
router.get("/sales-days", getOutletSalesDays);
router.get("/:year/:month", getOutletSalaryEntryByMonth);
router.post("/upsert", verifyAdmin, upsertOutletSalaryEntry);
router.post("/daily-rates", verifyAdmin, saveDailySalaryRate);

export default router;
