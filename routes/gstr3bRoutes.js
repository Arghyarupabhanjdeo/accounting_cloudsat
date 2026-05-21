
import express from "express";
import {
  getGSTR3B,
  getGSTR3BMonthly,
} from "../controllers/gstr3bController.js";

const router = express.Router();

router.get("/:companyId",         getGSTR3B);
router.get("/monthly/:companyId", getGSTR3BMonthly);

export default router;