import express from "express";
import { createVoucherTRANSACTION } from "../controllers/voucherController.js";

const router = express.Router()

router.post("/createVoucher",createVoucherTRANSACTION)

export default router ;