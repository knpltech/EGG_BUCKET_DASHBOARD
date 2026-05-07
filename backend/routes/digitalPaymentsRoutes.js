import express from "express";
import {
  addDigitalPayment,
  getAllDigitalPayments,
  getDigitalPaymentsByDate,
  updateDigitalPayment,
  deleteDigitalPaymentsByDate,
  deleteDigitalPaymentByOutletAndDate
} from "../controllers/digitalPaymentsController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteDigitalPaymentByOutletAndDate);
router.delete("/date/:date", deleteDigitalPaymentsByDate);
router.get("/date/:date", getDigitalPaymentsByDate);
router.get("/all", getAllDigitalPayments);
router.post("/add", addDigitalPayment);
router.patch("/:id", updateDigitalPayment);

export default router;