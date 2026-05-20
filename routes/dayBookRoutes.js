import express from "express";
import { getDayBook } from "../controllers/daybookController.js";

const router = express.Router();

router.get("/:companyId", getDayBook);

export default router;
