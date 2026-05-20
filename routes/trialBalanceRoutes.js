import express from "express";
import {
  addLedger,
  getAllLedgers,
  deleteLedger,
  trial_balance,
} from "../controllers/trialBalanceController.js";

const router = express.Router();

// ➜ Add new ledger
router.post("/add/:companyId", addLedger);

// ➜ Get all ledger entries
router.get("/all/:companyId", getAllLedgers);

// ➜ Delete ledger
router.delete("/delete/:id", deleteLedger);

router.get("/get-Trail-balance/:companyId",trial_balance)

export default router;
