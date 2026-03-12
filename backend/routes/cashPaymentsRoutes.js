import express from "express";
import { addCashPayment, getAllCashPayments, updateCashPayment, deleteCashPaymentsByDate } from "../controllers/cashPaymentsController.js";

const router = express.Router();

// More specific routes MUST come before generic :id routes
// Delete all cash payment entries for a specific date (admin only)
router.delete("/date/:date", deleteCashPaymentsByDate);

// Get all cash payment entries
router.get("/all", getAllCashPayments);

// Add a new cash payment entry
router.post("/add", addCashPayment);

// Generic routes come last
// Route to update a cash payment entry by ID
router.patch("/:id", updateCashPayment);

export default router;
