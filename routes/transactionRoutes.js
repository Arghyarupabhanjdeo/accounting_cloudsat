import express from "express";
import { getAllTransactions, getCashTransactions } from "../controllers/transactionController.js";

const router = express.Router();

router.get("/all/:companyId", getAllTransactions);
router.get("/ledger/:companyId/:ledgerId", getCashTransactions);

export default router;
