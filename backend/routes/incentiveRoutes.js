import express from "express";
import { verifyAdmin } from "../middleware/authMiddleware.js";
import {
  addIncentive,
  getAllIncentives,
  updateIncentive,
  deleteIncentiveByOutletAndDate,
  deleteIncentivesByDate
} from "../controllers/incentiveController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteIncentiveByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteIncentivesByDate);
router.post("/add", addIncentive);
router.get("/all", getAllIncentives);
router.patch("/:id", updateIncentive);

export default router;