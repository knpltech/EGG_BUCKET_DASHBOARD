import express from "express";
import { addNeccRate, getAllNeccRates, updateNeccRate, deleteNeccRatesByDate } from "../controllers/neccrateController.js";

const router = express.Router();

// More specific routes MUST come before generic :id routes
// DELETE /api/neccrate/date/:date - Delete all NECC rate entries for a specific date (admin only)
router.delete("/date/:date", deleteNeccRatesByDate);

// GET /api/neccrate/all - Get all NECC rate entries
router.get("/all", getAllNeccRates);

// POST /api/neccrate/add - Add a new NECC rate entry
router.post("/add", addNeccRate);

// Generic routes come last
// PATCH /api/neccrate/:id - Update a NECC rate entry by ID
router.patch("/:id", updateNeccRate);

export default router;
