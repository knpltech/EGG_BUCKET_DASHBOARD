import express from "express";
import { verifyAdmin } from "../middleware/authMiddleware.js";
import {
  addCashPayment,
  getAllCashPayments,
  updateCashPayment,
  deleteCashPaymentsByDate,
  deleteCashPaymentByOutletAndDate
} from "../controllers/cashPaymentsController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteCashPaymentByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteCashPaymentsByDate);
router.get("/all", getAllCashPayments);
router.post("/add", addCashPayment);
router.patch("/:id", updateCashPayment);

export default router;