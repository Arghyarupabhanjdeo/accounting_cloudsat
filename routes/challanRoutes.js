// const express = require("express");
// const router = express.Router();
// const challan = require("../controllers/challan.controller");

// router.get("/summary", challan.getSummary);
// router.get("/", challan.getChallans);
// router.get("/:id", challan.getChallanById);
// router.post("/", challan.addChallan);
// router.post("/:id/reconcile", challan.reconcileChallan);

// module.exports = router;

import express from "express"
import { addChallan, getChallanById, getChallans, getSummary, reconcileChallan }from "../controllers/challanController.js"
const router = express.Router()

router.get("/:companyId/summary", getSummary);
router.get("/:companyId", getChallans);
router.get("/:companyId/:id", getChallanById);
router.post("/:companyId", addChallan);
router.post("/:companyId/:id/reconcile", reconcileChallan);

export default router ;