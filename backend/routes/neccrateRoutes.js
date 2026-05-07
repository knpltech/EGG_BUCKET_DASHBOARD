import express from "express";
import {
  addNeccRate,
  getAllNeccRates,
  getNeccRatesByDate,
  updateNeccRate,
  deleteNeccRatesByDate,
  deleteNeccRateByOutletAndDate
} from "../controllers/neccrateController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteNeccRateByOutletAndDate);
router.delete("/date/:date", deleteNeccRatesByDate);
router.get("/date/:date", getNeccRatesByDate);
router.get("/all", getAllNeccRates);
router.post("/add", addNeccRate);
router.patch("/:id", updateNeccRate);

export default router;