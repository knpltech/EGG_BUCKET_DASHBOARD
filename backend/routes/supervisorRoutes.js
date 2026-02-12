import express from "express";
import { addSupervisor } from "../controllers/adminController.js";

const router = express.Router();

// Route to add supervisor
router.post("/add", addSupervisor);

export default router;
