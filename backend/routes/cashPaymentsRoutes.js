import express from "express";
import {
  addCashPayment,
  getAllCashPayments,
  updateCashPayment,
  deleteCashPaymentsByDate,
  deleteCashPaymentByOutletAndDate
} from "../controllers/cashPaymentsController.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Admin-only delete routes (specific before generic) ──────────────────────
router.delete("/date/:date/outlet/:outletId", verifyAdmin, deleteCashPaymentByOutletAndDate);
router.delete("/date/:date", verifyAdmin, deleteCashPaymentsByDate);

// ── Public / authenticated routes ───────────────────────────────────────────
router.get("/all", getAllCashPayments);
router.post("/add", addCashPayment);
router.patch("/:id", updateCashPayment);

export default router;