import express from "express";
import {
  getGSTR1,
  getGSTR1Summary,
  getGSTR1HSN,
  getGSTR1DocSummary,
} from "../controllers/gstr1Controller.js";

const router = express.Router();

router.get("/:companyId",              getGSTR1);
router.get("/summary/:companyId",      getGSTR1Summary);
router.get("/hsn/:companyId",          getGSTR1HSN);
router.get("/doc-summary/:companyId",  getGSTR1DocSummary);

export default router;
