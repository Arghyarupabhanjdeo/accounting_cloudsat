// import express from "express";
// import {
//   createLedger,
//   getLedgers,
//   getLedgerById,
//   deleteLedger,
// } from "../controllers/ledgerController.js";

// const router = express.Router();

// router.post("/create", createLedger);
// router.get("/all", getLedgers);
// router.get("/:id", getLedgerById);
// router.delete("/:id", deleteLedger);

// export default router;



import express from "express";
import {
  createLedger,
  getLedgers,
  getLedgerById,
  deleteLedger,
  updateLedger,
  updateLedgerHistory,
} from "../controllers/ledgerController.js";

const router = express.Router();

// All routes now include companyId
router.post("/:companyId/create", createLedger);
router.get("/:companyId/all", getLedgers);
router.get("/:companyId/:id", getLedgerById);
router.get("/getUpdateHistory/:companyId",updateLedgerHistory)
router.put("/update/:companyId/:id",updateLedger)
router.delete("/:companyId/:id", deleteLedger);

export default router;
