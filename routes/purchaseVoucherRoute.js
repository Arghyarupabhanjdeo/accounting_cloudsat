import express from "express";
import { 
  createPurchaseVoucher, 
  getAllVouchers, 
  getPurchaseVouchersAll,
  getPurchaseVoucherItems, 
  uploadFromExcel, 
  bulkCreatePurchaseVoucher,
  getPurchaseVoucherById,
  updatePurchaseVoucher,
  deletePurchaseVoucher,
  downloadPurchaseVoucherPDF
} from "../controllers/purchaseVoucherController.js";
import uploadMiddleware from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post("/", createPurchaseVoucher);
router.get("/:companyId", getAllVouchers);
router.get("/:companyId/all", getPurchaseVouchersAll);
router.get("/getItems/:voucherId", getPurchaseVoucherItems);
router.post("/upload/:companyId", uploadMiddleware.single("file"), uploadFromExcel)
router.post("/bulk-create", bulkCreatePurchaseVoucher);
router.get("/single/:id", getPurchaseVoucherById);
router.put("/:id", updatePurchaseVoucher);
router.delete("/:id", deletePurchaseVoucher);
router.get("/download/:id", downloadPurchaseVoucherPDF);

// router.get("/fetch-gst/:ledgerName", async (req, res) => {
//   const { ledgerName } = req.params;

//   try {
//     const [rows] = await pool.query(
//       "SELECT gst_tax_percentage FROM purchase_ledgers WHERE name = ?",
//       [ledgerName]
//     );

//     if (rows.length === 0) {
//       return res.json({ gst_percentage: 0 });
//     }

//     res.json({ gst_percentage: rows[0].gst_tax_percentage });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: "Error fetching GST" });
//   }
// });

export default router;
