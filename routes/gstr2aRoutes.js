import express from "express";
import {
  getB2BInvoices,
  createB2BInvoice,
  updateB2BStatus,
  getB2BAmendments,
  createB2BAmendment,
  getCreditDebitNotes,
  createCreditDebitNote,
  getCDNAmendments,
  createCDNAmendment
} from "../controllers/gstr2aController.js";

const router = express.Router();

/* B2B */
router.get("/b2b/:companyId", getB2BInvoices);
router.post("/b2b/:companyId", createB2BInvoice);
router.put("/b2b/:id/status", updateB2BStatus);

/* B2B Amendments */
router.get("/b2b-amendments/:companyId", getB2BAmendments);
router.post("/b2b-amendments/:companyId", createB2BAmendment);

/* Credit / Debit Notes */
router.get("/credit-debit-notes/:companyId", getCreditDebitNotes);
router.post("/credit-debit-notes/:companyId", createCreditDebitNote);

/* CDN Amendments */
router.get("/cdn-amendments/:companyId", getCDNAmendments);
router.post("/cdn-amendments/:companyId", createCDNAmendment);

export default router;
