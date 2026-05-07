import express from "express";
import {
  addFoodAllowance,
  getAllFoodAllowances,
  getFoodAllowanceByDate,
  updateFoodAllowance,
  deleteFoodAllowanceByOutletAndDate,
  deleteFoodAllowancesByDate,
} from "../controllers/foodAllowanceController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteFoodAllowanceByOutletAndDate);
router.delete("/date/:date", deleteFoodAllowancesByDate);
router.get("/date/:date", getFoodAllowanceByDate);
router.post("/add", addFoodAllowance);
router.get("/all", getAllFoodAllowances);
router.patch("/:id", updateFoodAllowance);

export default router;
