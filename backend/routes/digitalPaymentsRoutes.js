import express from "express";
import {
  addDigitalPayment,
  getAllDigitalPayments,
  getDigitalPaymentsByDate,
  updateDigitalPayment,
  updateDigitalPaymentAuditStatus,
  deleteDigitalPaymentsByDate,
  deleteDigitalPaymentByOutletAndDate
} from "../controllers/digitalPaymentsController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", deleteDigitalPaymentByOutletAndDate);
router.delete("/date/:date", deleteDigitalPaymentsByDate);
router.get("/date/:date", getDigitalPaymentsByDate);
router.get("/all", getAllDigitalPayments);
router.post("/add", addDigitalPayment);
router.patch("/:id/audit-status", updateDigitalPaymentAuditStatus);
router.patch("/:id", updateDigitalPayment);

export default router;
