import express from "express";
import {
  createJournalVoucher,
  getJournalVouchers,
  getJournalVoucherById,
  bulkCreateJournalVoucher,
  updateJournalVoucher,
  deleteJournalVoucher,
  downloadJournalVoucherPDF,
  getNextJournalVoucherNumber
} from "../controllers/journalVoucherController.js";

const router = express.Router();

router.post("/create/:companyId", createJournalVoucher);
router.get("/next-voucher-no", getNextJournalVoucherNumber);
router.get("/all/:companyId", getJournalVouchers);
router.get("/:id", getJournalVoucherById);
router.post("/bulk-create", bulkCreateJournalVoucher);
router.put("/update/:id", updateJournalVoucher);
router.delete("/delete/:id", deleteJournalVoucher);
router.get("/download/:id", downloadJournalVoucherPDF);

export default router;
