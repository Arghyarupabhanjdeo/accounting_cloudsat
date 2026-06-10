import express from "express"
import { createStockList, deleteStock, getStocks, updateStocks, getAllStockNames, getAllHSN, getStockSummary } from "../controllers/stockController.js";

const router = express.Router();

router.post("/createStock/:companyId", createStockList)
router.get("/getStockData/:companyId", getStocks)
router.put("/updateStock/:companyId/:stockId", updateStocks)
router.delete("/deleteStock/:companyId/:stockId", deleteStock)
router.get("/getStockNames/:companyId", getAllStockNames);
router.get("/getStockHSN/:companyId", getAllHSN);
router.get("/getStockSummary/:companyId", getStockSummary);
export default router;