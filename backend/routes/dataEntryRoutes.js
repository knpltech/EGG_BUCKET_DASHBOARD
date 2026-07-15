import express from "express";
import {
  addDataEntry,
  getAllDataEntries,
  getDataEntriesByOutlet,
  getDataEntriesByDate,
  deleteDataEntryByOutletAndDate,
} from "../controllers/dataEntryController.js";

const router = express.Router();

// POST /api/data-entry - Add a new data entry
router.post("/", addDataEntry);

// GET /api/data-entry/all - Get all data entries
router.get("/all", getAllDataEntries);

// GET /api/data-entry/outlet/:outletId - Get entries by outlet
router.get("/outlet/:outletId", getDataEntriesByOutlet);

// GET /api/data-entry/date/:date - Get entries by date
router.get("/date/:date", getDataEntriesByDate);

// DELETE /api/data-entry/date/:date/outlet/:outletId - Delete one outlet/date entry
router.delete("/date/:date/outlet/:outletId", deleteDataEntryByOutletAndDate);

export default router;
