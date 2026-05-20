import express from "express";
import {
  createPaymentVoucher,
  getAllPaymentVouchers,
  getPaymentVoucherById,
  bulkCreatePaymentVoucher,
  deletePaymentVoucher,
  bulkDeletePaymentVouchers,
  updatePaymentVoucher,
  downloadPaymentVoucherPDF
} from "../controllers/paymentVoucherController.js";

const router = express.Router();

router.post("/create/:companyId", createPaymentVoucher);
router.get("/all/:companyId", getAllPaymentVouchers);
router.get("/get/:voucherId", getPaymentVoucherById);
router.post("/bulk-create", bulkCreatePaymentVoucher);
router.put("/update/:id", updatePaymentVoucher);
router.delete("/delete/:id", deletePaymentVoucher);
router.post("/bulk-delete", bulkDeletePaymentVouchers);
router.get("/download/:id", downloadPaymentVoucherPDF);

export default router;
