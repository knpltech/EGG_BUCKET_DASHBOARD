import express from "express";
import {
  createStockOptionEntry,
  getAllStockOptionEntries,
  getStockOptionEntriesByDate,
  getStockOptionEntriesByZone,
  getStockOptionEntriesByZoneAndDate,
  updateStockOptionEntryById,
  updateStockOptionEntryByZoneAndDate,
} from "../controllers/stockOptionsController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/all", getAllStockOptionEntries);
router.get("/date/:date", getStockOptionEntriesByDate);
router.get("/zone/:zone", getStockOptionEntriesByZone);
router.get("/zone/:zone/date/:date", getStockOptionEntriesByZoneAndDate);
router.post("/create", verifyAdmin, createStockOptionEntry);
router.patch("/:id", verifyAdmin, updateStockOptionEntryById);
router.patch("/zone/:zone/date/:date", verifyAdmin, updateStockOptionEntryByZoneAndDate);

export default router;
