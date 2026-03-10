import express from "express";
import {
  addIncentive,
  getAllIncentives,
  updateIncentive
} from "../controllers/incentiveController.js";

const router = express.Router();

router.post("/add", addIncentive);
router.get("/all", getAllIncentives);
router.patch("/:id",updateIncentive);

export default router;