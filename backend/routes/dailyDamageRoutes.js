import express from "express";
import { verifyAdmin } from "../middleware/authMiddleware.js";
import {
  addDailyDamage,
  updateDailyDamage,
  deleteDailyDamagesByDate,
  deleteDailyDamageByOutletAndDate
} from "../controllers/dailyDamageController.js";
import { getAllDailyDamages } from "../controllers/dailyDamageGetController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteDailyDamageByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteDailyDamagesByDate);
router.get("/all", getAllDailyDamages);
router.post("/add-daily-damage", addDailyDamage);
router.patch("/:id", updateDailyDamage);

export default router;