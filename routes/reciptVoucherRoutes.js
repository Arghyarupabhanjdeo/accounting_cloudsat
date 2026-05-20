import express from "express"
import {
  createReceiveVoucher,
  getReceiveVoucher,
  bulkCreateReceiveVoucher,
  getReceiveVoucherById,
  deleteReceiveVoucher,
  updateReceiveVoucher,
  downloadReceiveVoucherPDF
} from "../controllers/receiveVoucherController.js";


const router = express.Router();

router.post("/createReciptVoucher/:companyId", createReceiveVoucher)
router.get("/getReceiptVoucher/:companyId", getReceiveVoucher)
router.post("/bulk-create", bulkCreateReceiveVoucher);

// Details, Edit & Delete routes
router.get("/:voucherId", getReceiveVoucherById);
router.put("/update/:voucherId", updateReceiveVoucher);
router.delete("/delete/:voucherId", deleteReceiveVoucher);
router.get("/download/:id", downloadReceiveVoucherPDF);

export default router;