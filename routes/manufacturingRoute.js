import express from "express";
import {
  createManufacturingJournal,
  getManufacturedItems,
  getManufacturingList,
  // getManufacturingById,
  // deleteManufacturingJournal,
  // updateManufacturingJournal,
  // generateManufacturingPDF_Doc,
} from "../controllers/manufacturingController.js";

const router = express.Router();

// Create a new manufacturing journal
router.post("/create/:companyId", createManufacturingJournal);
// Get raw manufactured items (for inventory view)
router.get("/getItems/:companyId", getManufacturedItems);
// List all manufacturing journals for a company
router.get("/list/:companyId", getManufacturingList);
// Get a specific journal by ID
// router.get("/get/:id", getManufacturingById);
// // Delete a journal (and reverse stock)
// router.delete("/delete/:id", deleteManufacturingJournal);
// // // Update a journal
// router.put("/update/:id", updateManufacturingJournal);
// // Generate PDF for a journal
// router.get("/download-pdf/:id", generateManufacturingPDF_Doc);

export default router;
