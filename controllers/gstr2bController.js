import pool from "../db.js";

/* ══════════════════════════════════════════════════════════════════
   GSTR-2B Controller
   Source tables: purchase_vouchers, purchase_voucher_items
   Dynamically derives ITC — NO manual entry tables used
══════════════════════════════════════════════════════════════════ */

/* ── GET /api/gstr2b/:companyId ── All purchase vouchers with ITC status */
export const getGSTR2B = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy } = req.query;

    let dateWhere = "";
    const params  = [companyId];

    if (month) {
      dateWhere = " AND DATE_FORMAT(pv.date, '%Y-%m') = ?";
      params.push(month);
    } else if (fy) {
      const startYear = parseInt(fy.split("-")[0]);
      dateWhere = " AND pv.date >= ? AND pv.date < ?";
      params.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    const [rows] = await pool.query(
      `SELECT
         pv.id,
         pv.date,
         pv.customer           AS supplierName,
         pv.gstin              AS supplierGSTIN,
         pv.supplierInvoiceNo,
         pv.supplierInvoiceDate,
         pv.placeOfSupply,
         pv.subtotal,
         pv.gst_percentage,
         pv.gst_amount,
         pv.cgst,
         pv.sgst,
         pv.igst,
         pv.grand_total,
         pv.gstRegistrationType,
         pv.state,
         COALESCE(pv.cgst, 0) + COALESCE(pv.sgst, 0) + COALESCE(pv.igst, 0) AS eligibleITC
       FROM purchase_vouchers pv
       WHERE pv.companyId = ? ${dateWhere}
       ORDER BY pv.date DESC`,
      params
    );

    // Derive match status (books vs portal):
    // Since we have no portal data, mark based on GSTIN presence
    const enriched = rows.map(v => {
      const hasGSTIN = (v.supplierGSTIN || "").length === 15;
      const itcVal   = parseFloat(v.eligibleITC || 0);
      let matchStatus = "MATCHED";
      if (!hasGSTIN) matchStatus = "MISSING_IN_PORTAL";
      else if (!v.supplierInvoiceNo) matchStatus = "PARTIAL";

      return {
        ...v,
        matchStatus,
        itcAvailable: hasGSTIN ? itcVal : 0,
        itcUnavailable: !hasGSTIN ? itcVal : 0,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET /api/gstr2b/summary/:companyId ── ITC summary totals */
export const getGSTR2BSummary = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy } = req.query;

    let dateWhere = "";
    const params  = [companyId];

    if (month) {
      dateWhere = " AND DATE_FORMAT(date, '%Y-%m') = ?";
      params.push(month);
    } else if (fy) {
      const startYear = parseInt(fy.split("-")[0]);
      dateWhere = " AND date >= ? AND date < ?";
      params.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    const [[totals]] = await pool.query(
      `SELECT
         COUNT(*)                                    AS totalInvoices,
         SUM(subtotal)                               AS taxableValue,
         SUM(COALESCE(cgst,0))                       AS totalCGST,
         SUM(COALESCE(sgst,0))                       AS totalSGST,
         SUM(COALESCE(igst,0))                       AS totalIGST,
         SUM(COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)) AS totalITC,
         SUM(CASE WHEN LENGTH(COALESCE(gstin,''))=15
                  THEN COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)
                  ELSE 0 END)                        AS eligibleITC,
         SUM(CASE WHEN LENGTH(COALESCE(gstin,''))<>15
                  THEN COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)
                  ELSE 0 END)                        AS ineligibleITC,
         SUM(grand_total)                            AS grandTotal,
         COUNT(CASE WHEN LENGTH(COALESCE(gstin,''))=15 THEN 1 END) AS matchedCount,
         COUNT(CASE WHEN LENGTH(COALESCE(gstin,''))<>15 THEN 1 END) AS mismatchCount
       FROM purchase_vouchers
       WHERE companyId = ? ${dateWhere}`,
      params
    );

    res.json({ success: true, data: totals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET /api/gstr2b/supplier/:companyId ── Supplier-wise ITC */
export const getGSTR2BSupplierWise = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy } = req.query;

    let dateWhere = "";
    const params  = [companyId];

    if (month) {
      dateWhere = " AND DATE_FORMAT(date, '%Y-%m') = ?";
      params.push(month);
    } else if (fy) {
      const startYear = parseInt(fy.split("-")[0]);
      dateWhere = " AND date >= ? AND date < ?";
      params.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    const [rows] = await pool.query(
      `SELECT
         customer                AS supplierName,
         gstin                   AS supplierGSTIN,
         COUNT(*)                AS invoiceCount,
         SUM(subtotal)           AS taxableValue,
         SUM(COALESCE(cgst,0))   AS cgst,
         SUM(COALESCE(sgst,0))   AS sgst,
         SUM(COALESCE(igst,0))   AS igst,
         SUM(COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)) AS totalITC,
         SUM(grand_total)        AS grandTotal
       FROM purchase_vouchers
       WHERE companyId = ? ${dateWhere}
       GROUP BY customer, gstin
       ORDER BY totalITC DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET /api/gstr2b/hsn/:companyId ── HSN-wise ITC from purchase_voucher_items */
export const getGSTR2BHSN = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy } = req.query;

    let dateWhere = "";
    const params  = [companyId];

    if (month) {
      dateWhere = " AND DATE_FORMAT(pv.date, '%Y-%m') = ?";
      params.push(month);
    } else if (fy) {
      const startYear = parseInt(fy.split("-")[0]);
      dateWhere = " AND pv.date >= ? AND pv.date < ?";
      params.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    const [rows] = await pool.query(
      `SELECT
         pi.hsn_code,
         pv.gst_percentage      AS gstRate,
         SUM(pi.qty)            AS totalQty,
         SUM(pi.amount)         AS taxableValue,
         SUM(pv.grand_total)    AS grandTotal
       FROM purchase_voucher_items pi
       JOIN purchase_vouchers pv ON pv.id = pi.voucher_id
       WHERE pv.companyId = ? ${dateWhere}
       GROUP BY pi.hsn_code, pv.gst_percentage
       ORDER BY pi.hsn_code`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
