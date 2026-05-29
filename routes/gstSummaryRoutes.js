import express from "express";
import { getGstSummary } from "../controllers/gstSummaryController.js";

const router = express.Router();

router.get("/:companyId", getGstSummary);

export default router;
