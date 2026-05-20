import express from "express";
import {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyByEmail,
} from "../controllers/companyControllers.js";

const router = express.Router();

router.get("/:userId", getCompanies);
router.get("/single/:id", getCompanyById);
router.post("/create", createCompany);
router.get("/getByEmail/:email", getCompanyByEmail);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);

export default router;
