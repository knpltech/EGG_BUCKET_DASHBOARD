import express from "express";
import {
  addIncentive,
  getAllIncentives,
  updateIncentive,
  deleteIncentiveByOutletAndDate,
  deleteIncentivesByDate
} from "../controllers/incentiveController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteIncentiveByOutletAndDate);
router.delete("/date/:date", deleteIncentivesByDate);
router.post("/add", addIncentive);
router.get("/all", getAllIncentives);
router.patch("/:id", updateIncentive);

export default router;