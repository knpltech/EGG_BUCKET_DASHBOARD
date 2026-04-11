import express from "express";
import {
  deleteZoneStockEntryByZoneAndDate,
  deleteZoneStockEntriesByZone,
  getAllZoneStockEntries,
  getZoneStockEntriesByZone,
  resetAllZoneStockEntries,
  upsertZoneStockEntry,
} from "../controllers/zoneStockController.js";

const router = express.Router();

router.get("/all", getAllZoneStockEntries);
router.get("/zone/:zone", getZoneStockEntriesByZone);
router.post("/upsert", upsertZoneStockEntry);
router.delete("/zone/:zone", deleteZoneStockEntriesByZone);
router.delete("/zone/:zone/date/:date", deleteZoneStockEntryByZoneAndDate);
router.delete("/reset/all", resetAllZoneStockEntries);

export default router;
