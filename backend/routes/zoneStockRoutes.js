import express from "express";
import {
  deleteZoneStockEntryByZoneAndDate,
  getAllZoneStockEntries,
  getZoneStockEntriesByZone,
  upsertZoneStockEntry,
} from "../controllers/zoneStockController.js";

const router = express.Router();

router.get("/all", getAllZoneStockEntries);
router.get("/zone/:zone", getZoneStockEntriesByZone);
router.post("/upsert", upsertZoneStockEntry);
router.delete("/zone/:zone/date/:date", deleteZoneStockEntryByZoneAndDate);

export default router;
