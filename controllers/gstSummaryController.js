import pool from "../db.js";

export const getGstSummary = async (req, res) => {
  const { companyId } = req.params;
  const { employeeId } = req.query; // optional

  try {
    let salesQuery = `SELECT 'Sales' as voucherType, invoiceNo as voucherNumber, igst, sgst, cgst, date FROM sales_vouchers WHERE companyId = ?`;
    let purchaseQuery = `SELECT 'Purchase' as voucherType, invoiceNo as voucherNumber, igst, sgst, cgst, date FROM purchase_vouchers WHERE companyId = ?`;
    const queryParams = [companyId];

    if (employeeId) {
      salesQuery += ` AND created_by_employee_id = ?`;
      purchaseQuery += ` AND created_by_employee_id = ?`;
      queryParams.push(employeeId);
    }

    const [salesRows] = await pool.query(salesQuery, queryParams);
    const [purchaseRows] = await pool.query(purchaseQuery, queryParams);

    const combined = [...salesRows, ...purchaseRows];

    // Sort by date descending
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      message: "GST Summary fetched successfully",
      data: combined
    });
  } catch (error) {
    console.error("GST Summary Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
