import express from "express";
import {
  addDailyDamage,
  updateDailyDamage,
  deleteDailyDamagesByDate,
  deleteDailyDamageByOutletAndDate
} from "../controllers/dailyDamageController.js";
import { getAllDailyDamages, getDailyDamageByDate } from "../controllers/dailyDamageGetController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteDailyDamageByOutletAndDate);
router.delete("/date/:date", deleteDailyDamagesByDate);
router.get("/date/:date", getDailyDamageByDate);
router.get("/all", getAllDailyDamages);
router.post("/add-daily-damage", addDailyDamage);
router.patch("/:id", updateDailyDamage);

export default router;