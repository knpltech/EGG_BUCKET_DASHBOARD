import express from "express";
import {
  addDailyDamage,
  updateDailyDamage,
  deleteDailyDamagesByDate,
  deleteDailyDamageByOutletAndDate
} from "../controllers/dailyDamageController.js";
import { getAllDailyDamages } from "../controllers/dailyDamageGetController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteDailyDamageByOutletAndDate);
router.delete("/date/:date", deleteDailyDamagesByDate);
router.get("/all", getAllDailyDamages);
router.post("/add-daily-damage", addDailyDamage);
router.patch("/:id", updateDailyDamage);

export default router;