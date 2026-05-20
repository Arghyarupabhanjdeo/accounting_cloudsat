import express from "express";
import {
  createBankAccount,
  getBankAccounts,
  updateBankAccount,
  deleteBankAccount
} from "../controllers/bankAccountController.js";

const router = express.Router();

router.post("/:companyId/create", createBankAccount);
router.get("/:companyId/all", getBankAccounts);
router.put("/:id/update", updateBankAccount);
router.delete("/:id/delete", deleteBankAccount);

export default router;

//http://localhost:3000/api/v1/bank/:companyId/all
