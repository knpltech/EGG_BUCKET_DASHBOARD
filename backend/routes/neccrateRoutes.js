import express from "express";
import { verifyAdmin } from "../middleware/authMiddleware.js";
import {
  addNeccRate,
  getAllNeccRates,
  updateNeccRate,
  deleteNeccRatesByDate,
  deleteNeccRateByOutletAndDate
} from "../controllers/neccrateController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteNeccRateByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteNeccRatesByDate);
router.get("/all", getAllNeccRates);
router.post("/add", addNeccRate);
router.patch("/:id", updateNeccRate);

export default router;