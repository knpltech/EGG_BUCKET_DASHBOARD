import express from "express";
import { verifyAdmin } from "../middleware/authMiddleware.js";
import {
  addDigitalPayment,
  getAllDigitalPayments,
  updateDigitalPayment,
  deleteDigitalPaymentsByDate,
  deleteDigitalPaymentByOutletAndDate
} from "../controllers/digitalPaymentsController.js";

const router = express.Router();

router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteDigitalPaymentByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteDigitalPaymentsByDate);
router.get("/all", getAllDigitalPayments);
router.post("/add", addDigitalPayment);
router.patch("/:id", updateDigitalPayment);

export default router;