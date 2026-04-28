import express from "express";
import {
  addRemarks,
  getAllRemarks,
  updateRemarks,
  deleteRemarksByOutletAndDate,
  deleteRemarksByDate,
} from "../controllers/remarksController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteRemarksByOutletAndDate);
router.delete("/date/:date", deleteRemarksByDate);
router.post("/add", addRemarks);
router.get("/all", getAllRemarks);
router.patch("/:id", updateRemarks);

export default router;
