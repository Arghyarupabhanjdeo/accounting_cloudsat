import pool from "../db.js";

// ── Classification helper (pure JS, mirrors frontend logic) ───────
const classifyVoucher = (v) => {
  const gstin   = (v.gstin || "").trim();
  const compState = (v.companyState || "").trim().toLowerCase();
  const posState  = (v.placeOfSupply || "").trim().toLowerCase();
  const isInterstate = compState && posState && compState !== posState;
  const taxable = parseFloat(v.subtotal || 0);

  if (gstin.length === 15) return "B2B";
  if (isInterstate && taxable > 250000) return "B2CL";
  return "B2CS";
};

/* ── GET /api/gstr1/:companyId ── Full classified invoice list */
export const getGSTR1 = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy } = req.query;  // optional filters e.g. month=2024-04

    let dateWhere = "";
    const params  = [companyId];

    if (month) {
      dateWhere = " AND DATE_FORMAT(sv.date, '%Y-%m') = ?";
      params.push(month);
    } else if (fy) {
      // Indian FY: April of startYear → March of endYear
      const startYear = parseInt(fy.split("-")[0]);
      dateWhere = " AND sv.date >= ? AND sv.date < ?";
      params.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    const [rows] = await pool.query(
      `SELECT sv.*,
              c.state AS companyState
       FROM sales_vouchers sv
       LEFT JOIN companies c ON c.id = sv.companyId
       WHERE sv.companyId = ? ${dateWhere}
       ORDER BY sv.date DESC`,
      params
    );

    // Classify each voucher
    const classified = rows.map(v => ({
      ...v,
      invoiceType: classifyVoucher(v),
    }));

    res.json({ success: true, data: classified });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET /api/gstr1/summary/:companyId ── Aggregate totals */
export const getGSTR1Summary = async (req, res) => {
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
         COUNT(*)               AS totalInvoices,
         SUM(subtotal)          AS taxableValue,
         SUM(cgst)              AS totalCGST,
         SUM(sgst)              AS totalSGST,
         SUM(igst)              AS totalIGST,
         SUM(gst_amount)        AS totalGST,
         SUM(grand_total)       AS grandTotal
       FROM sales_vouchers
       WHERE companyId = ? ${dateWhere}`,
      params
    );

    // B2B / B2CL / B2CS breakdown
    const [allRows] = await pool.query(
      `SELECT sv.subtotal, sv.gstin, sv.placeOfSupply, sv.grand_total, sv.cgst, sv.sgst, sv.igst,
              c.state AS companyState
       FROM sales_vouchers sv
       LEFT JOIN companies c ON c.id = sv.companyId
       WHERE sv.companyId = ? ${dateWhere}`,
      params
    );

    let b2bCount = 0, b2clCount = 0, b2csCount = 0;
    allRows.forEach(v => {
      const t = classifyVoucher(v);
      if (t === "B2B")  b2bCount++;
      else if (t === "B2CL") b2clCount++;
      else b2csCount++;
    });

    res.json({
      success: true,
      data: {
        ...totals,
        b2bCount,
        b2clCount,
        b2csCount,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET /api/gstr1/hsn/:companyId ── HSN Summary from sales_items */
export const getGSTR1HSN = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy } = req.query;

    let dateWhere = "";
    const params  = [companyId];

    if (month) {
      dateWhere = " AND DATE_FORMAT(sv.date, '%Y-%m') = ?";
      params.push(month);
    } else if (fy) {
      const startYear = parseInt(fy.split("-")[0]);
      dateWhere = " AND sv.date >= ? AND sv.date < ?";
      params.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    const [rows] = await pool.query(
      `SELECT
         si.hsn_code,
         sv.gst_percentage       AS gstRate,
         COUNT(DISTINCT sv.id)   AS invoiceCount,
         SUM(si.qty)             AS totalQty,
         SUM(si.amount)          AS taxableValue,
         SUM(sv.cgst / (SELECT COUNT(*) FROM sales_items WHERE voucherId = sv.id)) AS cgst,
         SUM(sv.sgst / (SELECT COUNT(*) FROM sales_items WHERE voucherId = sv.id)) AS sgst,
         SUM(sv.igst / (SELECT COUNT(*) FROM sales_items WHERE voucherId = sv.id)) AS igst
       FROM sales_items si
       JOIN sales_vouchers sv ON sv.id = si.voucherId
       WHERE sv.companyId = ? ${dateWhere}
       GROUP BY si.hsn_code, sv.gst_percentage
       ORDER BY si.hsn_code`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET /api/gstr1/doc-summary/:companyId ── Document Summary */
export const getGSTR1DocSummary = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy }  = req.query;

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

    const [[counts]] = await pool.query(
      `SELECT
         COUNT(*)            AS totalInvoices,
         MIN(invoiceNo)      AS fromInvoice,
         MAX(invoiceNo)      AS toInvoice,
         0                   AS cancelledInvoices,
         0                   AS debitNotes,
         0                   AS creditNotes
       FROM sales_vouchers
       WHERE companyId = ? ${dateWhere}`,
      params
    );

    res.json({ success: true, data: counts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
