import express from "express";
import {
  addDailySales,
  getAllDailySales,
  updateDailySales,
  deleteDailySalesByDate,
  deleteDailySalesByOutletAndDate
} from "../controllers/dailysalesController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteDailySalesByOutletAndDate);
router.delete("/date/:date", deleteDailySalesByDate);
router.get("/all", getAllDailySales);
router.post("/add", addDailySales);
router.patch("/:id", updateDailySales);

export default router;