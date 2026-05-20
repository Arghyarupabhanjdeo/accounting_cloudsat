import express from "express";
import { getProfitLoss } from "../controllers/profitLossController.js";

const router = express.Router();

router.get("/profit-loss/:companyId", getProfitLoss);

export default router;
