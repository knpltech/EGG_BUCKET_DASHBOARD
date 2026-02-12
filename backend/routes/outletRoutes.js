import express from "express";
import { addOutlet, getAllOutlets, deleteOutlet, getZoneOutlets } from "../controllers/outletController.js";

const router = express.Router();


router.post("/add", addOutlet);
router.get("/all", getAllOutlets);
router.get("/zone/:zoneId", getZoneOutlets);
router.delete("/delete/:id", deleteOutlet);

export default router;
