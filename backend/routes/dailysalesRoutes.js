import express from "express";
import { verifyAdmin } from "../middleware/authMiddleware.js";
import {
  addDailySales,
  getAllDailySales,
  updateDailySales,
  deleteDailySalesByDate,
  deleteDailySalesByOutletAndDate
} from "../controllers/dailysalesController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteDailySalesByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteDailySalesByDate);
router.get("/all", getAllDailySales);
router.post("/add", addDailySales);
router.patch("/:id", updateDailySales);

export default router;