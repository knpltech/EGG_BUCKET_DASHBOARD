import express from "express";
import {
  addDigitalPayment,
  getAllDigitalPayments,
  updateDigitalPayment,
  deleteDigitalPaymentsByDate,
  deleteDigitalPaymentByOutletAndDate
} from "../controllers/digitalPaymentsController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Admin-only delete routes (specific before generic) ──────────────────────
router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteDigitalPaymentByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteDigitalPaymentsByDate);

// ── Public / authenticated routes ───────────────────────────────────────────
router.get("/all", getAllDigitalPayments);
router.post("/add", addDigitalPayment);
router.patch("/:id", updateDigitalPayment);

export default router;