import express from "express";
import { getNextVoucherNumber } from "../controllers/voucherNumberController.js";

const router = express.Router();

router.get("/next", getNextVoucherNumber);

export default router;
