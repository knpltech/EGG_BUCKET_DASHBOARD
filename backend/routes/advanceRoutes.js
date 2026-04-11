import express from "express";
import {
  addAdvance,
  getAllAdvances,
  updateAdvance,
  deleteAdvanceByOutletAndDate,
  deleteAdvancesByDate,
} from "../controllers/advanceController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteAdvanceByOutletAndDate);
router.delete("/date/:date", deleteAdvancesByDate);
router.post("/add", addAdvance);
router.get("/all", getAllAdvances);
router.patch("/:id", updateAdvance);

export default router;
