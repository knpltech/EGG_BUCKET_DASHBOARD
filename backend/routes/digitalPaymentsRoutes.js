
import express from "express";
import { addDigitalPayment, getAllDigitalPayments, updateDigitalPayment, deleteDigitalPaymentsByDate } from "../controllers/digitalPaymentsController.js";

const router = express.Router();

// More specific routes MUST come before generic :id routes
// Delete all digital payment entries for a specific date (admin only)
router.delete("/date/:date", deleteDigitalPaymentsByDate);

// Get all digital payment entries
router.get("/all", getAllDigitalPayments);

// Add a new digital payment entry
router.post("/add", addDigitalPayment);

// Generic routes come last
// Update a digital payment entry by ID
router.patch("/:id", updateDigitalPayment);

export default router;
