import express from "express"
import { createInvoice, deleteInvoice, getInvoiceById, getInvoices } from "../controllers/invoiceController.js";
const router = express.Router();

router.post("/create", createInvoice);
router.get("/", getInvoices);
router.get("/:id", getInvoiceById);
router.delete("/:id",deleteInvoice);

export default router ; 