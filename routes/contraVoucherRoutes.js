import express from "express";
import {
  createContraVoucher,
  getContraVouchers,
  getContraVoucherById,
  deleteContraVoucher,
  bulkCreateContraVoucher,
  updateContraVoucher,
  downloadContraVoucherPDF
} from "../controllers/contraVoucherController.js";

const router = express.Router();

router.post("/:companyId/create", createContraVoucher);
router.get("/:companyId/all", getContraVouchers);
router.get("/voucher/:id", getContraVoucherById);
router.delete("/delete/:id", deleteContraVoucher);
router.put("/update/:id", updateContraVoucher);
router.post("/bulk-create", bulkCreateContraVoucher);
router.get("/download/:id", downloadContraVoucherPDF);

export default router;
