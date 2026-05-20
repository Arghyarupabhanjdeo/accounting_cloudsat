import express from "express";
import {
  getGSTR2B,
  getGSTR2BSummary,
  getGSTR2BSupplierWise,
  getGSTR2BHSN,
} from "../controllers/gstr2bController.js";

const router = express.Router();

// Define more specific sub-paths first to prevent parameter routing conflict
router.get("/summary/:companyId",   getGSTR2BSummary);
router.get("/supplier/:companyId",  getGSTR2BSupplierWise);
router.get("/hsn/:companyId",       getGSTR2BHSN);
router.get("/:companyId",           getGSTR2B);

export default router;
