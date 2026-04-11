import express from "express";
import {
  addCashPayment,
  getAllCashPayments,
  updateCashPayment,
  deleteCashPaymentsByDate,
  deleteCashPaymentByOutletAndDate
} from "../controllers/cashPaymentsController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteCashPaymentByOutletAndDate);
router.delete("/date/:date", deleteCashPaymentsByDate);
router.get("/all", getAllCashPayments);
router.post("/add", addCashPayment);
router.patch("/:id", updateCashPayment);

export default router;