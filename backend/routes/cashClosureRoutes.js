import express from "express";
import {
  deleteCashClosuresByZone,
  deleteCashClosuresByZoneAndDate,
  getAllCashClosures,
  getCashClosuresByZone,
  getCashClosuresByZoneAndDate,
  resetAllCashClosures,
  upsertCashClosure,
} from "../controllers/cashClosureController.js";

const router = express.Router();

router.get("/all", getAllCashClosures);
router.get("/zone/:zone", getCashClosuresByZone);
router.get("/zone/:zone/date/:date", getCashClosuresByZoneAndDate);
router.post("/upsert", upsertCashClosure);
router.delete("/zone/:zone", deleteCashClosuresByZone);
router.delete("/zone/:zone/date/:date", deleteCashClosuresByZoneAndDate);
router.delete("/reset/all", resetAllCashClosures);

export default router;