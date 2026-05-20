import express from "express";
import {
  getGstr2BEntries,
  createGstr2BEntry,
  deleteGstr2BEntry,
  getGstr2BSummary
} from "../controllers/gstr2bController.js";

const router = express.Router();

/* Entries */
router.get("/:companyId", getGstr2BEntries);
router.post("/:companyId", createGstr2BEntry);
router.delete("/:id", deleteGstr2BEntry);

/* Return View */
router.get("/summary/view/:companyId", getGstr2BSummary);

export default router;
