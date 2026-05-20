import express from "express";
import { createManufacturingJournal, getManufacturedItems } from "../controllers/manufacturingController.js";

const router = express.Router();

router.post("/create/:companyId", createManufacturingJournal);
router.get("/getItems/:companyId",getManufacturedItems)

export default router;
