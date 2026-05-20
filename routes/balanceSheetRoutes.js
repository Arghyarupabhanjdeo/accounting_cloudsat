import express from "express";
import { getBalanceSheet } from "../controllers/balanceSheetController.js";

const router = express.Router();

router.get("/:companyId", getBalanceSheet);

export default router;
