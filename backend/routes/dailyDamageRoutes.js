
import express from "express";
import { addDailyDamage, updateDailyDamage, deleteDailyDamagesByDate } from "../controllers/dailyDamageController.js";
import { getAllDailyDamages } from "../controllers/dailyDamageGetController.js";

const router = express.Router();

// More specific routes MUST come before generic :id routes
// Route to delete all daily damages for a specific date
router.delete("/date/:date", deleteDailyDamagesByDate);

// Route to get all daily damages
router.get("/all", getAllDailyDamages);

// Route to add a daily damage entry
router.post("/add-daily-damage", addDailyDamage);

// Generic routes come last
// Route to update a daily damage entry by ID
router.patch("/:id", updateDailyDamage);

export default router;
