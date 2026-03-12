import express from "express";
import { addDailySales, getAllDailySales, updateDailySales, deleteDailySalesByDate } from "../controllers/dailysalesController.js";

const router = express.Router();

// More specific routes MUST come before generic :id routes
// Delete all daily sales entries for a specific date (admin only)
router.delete("/date/:date", deleteDailySalesByDate);

// Get all daily sales entries
router.get("/all", getAllDailySales);

// Add a new daily sales entry
router.post("/add", addDailySales);

// Generic routes come last
// Route to update a daily sales entry by ID
router.patch("/:id", updateDailySales);

export default router;
