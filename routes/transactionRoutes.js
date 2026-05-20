import express from "express";
import { getAllTransactions } from "../controllers/transactionController.js";

const router = express.Router();

router.get("/all/:companyId", getAllTransactions);

export default router;
