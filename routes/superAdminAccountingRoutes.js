import express from "express";
import { getSuperAdminAccountingActivity } from "../controllers/superAdminAccountingController.js";

const router = express.Router();

router.get("/activity", getSuperAdminAccountingActivity);

export default router;
