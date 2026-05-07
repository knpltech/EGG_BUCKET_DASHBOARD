import express from "express";
import {
  deleteZoneStockEntryByZoneAndDate,
  deleteZoneStockEntriesByZone,
  getAllZoneStockEntries,
  getZoneStockEntriesByDate,
  getZoneStockEntriesByZoneAndDate,
  getZoneStockEntriesByZone,
  resetAllZoneStockEntries,
  upsertZoneStockEntry,
} from "../controllers/zoneStockController.js";

const router = express.Router();

router.get("/all", getAllZoneStockEntries);
router.get("/date/:date", getZoneStockEntriesByDate);
router.get("/zone/:zone/date/:date", getZoneStockEntriesByZoneAndDate);
router.get("/zone/:zone", getZoneStockEntriesByZone);
router.post("/upsert", upsertZoneStockEntry);
router.delete("/zone/:zone", deleteZoneStockEntriesByZone);
router.delete("/zone/:zone/date/:date", deleteZoneStockEntryByZoneAndDate);
router.delete("/reset/all", resetAllZoneStockEntries);

export default router;
