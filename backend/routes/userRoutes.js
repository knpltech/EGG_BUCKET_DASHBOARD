import express from "express";
import { getUserData, updateUser } from "../controllers/userController.js";

const router = express.Router();

router.get("/:uid", getUserData);
router.put("/:uid", updateUser);

export default router;
