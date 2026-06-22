import express from "express";
import { addUser, addPaymentAuditor, getAllUsers, deleteUser, getAllDistributors, getAllDataAgents, getAllViewers, getAllSupervisors, getAllPaymentAuditors, getRetailCollectionSummary } from "../controllers/adminController.js";

const router = express.Router();



router.post("/add-user", addUser);
router.post("/add-payment-auditor", addPaymentAuditor);
router.get("/all-users", getAllUsers);
router.get("/all-distributors", getAllDistributors);
router.get("/all-dataagents", getAllDataAgents);
router.get("/all-viewers", getAllViewers);
router.get("/all-supervisors", getAllSupervisors);
router.get("/all-payment-auditors", getAllPaymentAuditors);
router.get("/retail-collection-summary", getRetailCollectionSummary);
router.post("/delete-user", deleteUser);

export default router;
