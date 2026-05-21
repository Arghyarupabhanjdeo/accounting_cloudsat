import express from "express";
import {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
} from "../controllers/bankTransactionController.js";

const router = express.Router();

router.post("/:companyId/create", createTransaction);
router.get("/:accountId/all", getTransactions);
router.put("/:id/update", updateTransaction);
router.delete("/:id/delete", deleteTransaction);

export default router;

// http://localhost:3000/api/v1/bank-transaction