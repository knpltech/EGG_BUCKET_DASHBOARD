import express from "express";
import {
  addAdvance,
  getAllAdvances,
  getAdvanceByDate,
  updateAdvance,
  deleteAdvanceByOutletAndDate,
  deleteAdvancesByDate,
} from "../controllers/advanceController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteAdvanceByOutletAndDate);
router.delete("/date/:date", deleteAdvancesByDate);
router.get("/date/:date", getAdvanceByDate);
router.post("/add", addAdvance);
router.get("/all", getAllAdvances);
router.patch("/:id", updateAdvance);

export default router;
