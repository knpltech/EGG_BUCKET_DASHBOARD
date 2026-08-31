import express from "express";
import {
  deleteCashClosuresByZone,
  deleteCashClosuresByZoneAndDate,
  getAllCashClosures,
  getCashClosuresByZone,
  getCashClosuresByZoneAndDate,
  getCashClosureAutofillData,
  resetAllCashClosures,
  upsertCashClosure,
} from "../controllers/cashClosureController.js";

const router = express.Router();

router.get("/all", getAllCashClosures);
router.get("/autofill/zone/:zone/date/:date", getCashClosureAutofillData);
router.get("/zone/:zone", getCashClosuresByZone);
router.get("/zone/:zone/date/:date", getCashClosuresByZoneAndDate);
router.post("/upsert", upsertCashClosure);
router.delete("/zone/:zone", deleteCashClosuresByZone);
router.delete("/zone/:zone/date/:date", deleteCashClosuresByZoneAndDate);
router.delete("/reset/all", resetAllCashClosures);

export default router;
