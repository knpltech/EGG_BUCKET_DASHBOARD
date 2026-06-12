import express from "express";
import {
  createStockOptionEntry,
  getAllStockOptionEntries,
  getStockOptionEntriesByDate,
  getStockOptionEntriesByZone,
  getStockOptionEntriesByZoneAndDate,
} from "../controllers/stockOptionsController.js";

const router = express.Router();

router.get("/all", getAllStockOptionEntries);
router.get("/date/:date", getStockOptionEntriesByDate);
router.get("/zone/:zone", getStockOptionEntriesByZone);
router.get("/zone/:zone/date/:date", getStockOptionEntriesByZoneAndDate);
router.post("/create", createStockOptionEntry);

export default router;
