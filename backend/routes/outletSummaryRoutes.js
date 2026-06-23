import express from "express";
import { getOutletSummary } from "../controllers/outletSummaryController.js";

const router = express.Router();

router.get("/", getOutletSummary);

export default router;
