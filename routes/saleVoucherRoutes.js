import express from "express";
import { createSalesVoucher, ewaybill, getSaleVoucher, bulkCreateSalesVoucher, updateSaleVoucher, deleteSalesVoucher, getSaleVoucherById, downloadSaleVoucherPDF, getSaleVoucherItems } from "../controllers/saleVoucherController.js";

const router = express.Router();

router.post("/", createSalesVoucher);
router.get('/:companyId/all', getSaleVoucher);
router.get("/single/:id", getSaleVoucherById);
router.get("/getItems/:voucherId", getSaleVoucherItems);
router.put("/:id", updateSaleVoucher);
router.delete("/:id", deleteSalesVoucher);
router.get("/download/:id", downloadSaleVoucherPDF);
router.get("/getEwaybill/:companyId", ewaybill)
router.post("/bulk-create", bulkCreateSalesVoucher);

export default router;
