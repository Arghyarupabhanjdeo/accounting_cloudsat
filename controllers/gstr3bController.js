import pool from "../db.js";

/* ══════════════════════════════════════════════════════════════════
   GSTR-3B Controller
   Auto-calculated from sales_vouchers + purchase_vouchers
   NO manual entry tables — pure dynamic computation
══════════════════════════════════════════════════════════════════ */

/* ── GET /api/gstr3b/:companyId ── Full GSTR-3B auto-summary */
export const getGSTR3B = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, fy } = req.query;

    let saleDateWhere = "";
    let purDateWhere  = "";
    const sParams = [companyId];
    const pParams = [companyId];

    if (month) {
      saleDateWhere = " AND DATE_FORMAT(date, '%Y-%m') = ?";
      purDateWhere  = " AND DATE_FORMAT(date, '%Y-%m') = ?";
      sParams.push(month);
      pParams.push(month);
    } else if (fy) {
      const startYear = parseInt(fy.split("-")[0]);
      saleDateWhere = " AND date >= ? AND date < ?";
      purDateWhere  = " AND date >= ? AND date < ?";
      sParams.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
      pParams.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    // ── Section 3.1 – Outward Supplies (from sales_vouchers) ──
    const [[sales]] = await pool.query(
      `SELECT
         COUNT(*)                        AS totalInvoices,
         SUM(subtotal)                   AS taxableValue,
         SUM(COALESCE(cgst,0))           AS cgst,
         SUM(COALESCE(sgst,0))           AS sgst,
         SUM(COALESCE(igst,0))           AS igst,
         SUM(COALESCE(gst_amount,0))     AS totalOutputTax,
         SUM(grand_total)                AS grandTotal,
         -- interstate (IGST > 0)
         SUM(CASE WHEN COALESCE(igst,0)>0 THEN subtotal ELSE 0 END) AS interstateTaxable,
         SUM(CASE WHEN COALESCE(igst,0)>0 THEN COALESCE(igst,0) ELSE 0 END) AS igstOnInterstate,
         -- nil rated (gst_amount = 0 but subtotal > 0)
         SUM(CASE WHEN COALESCE(gst_amount,0)=0 AND subtotal>0 THEN subtotal ELSE 0 END) AS nilRatedValue
       FROM sales_vouchers
       WHERE companyId = ? ${saleDateWhere}`,
      sParams
    );

    // ── Section 4 – ITC (from purchase_vouchers) ──
    const [[purchases]] = await pool.query(
      `SELECT
         COUNT(*)                              AS totalPurchases,
         SUM(subtotal)                         AS purchaseTaxableValue,
         SUM(COALESCE(cgst,0))                 AS itcCGST,
         SUM(COALESCE(sgst,0))                 AS itcSGST,
         SUM(COALESCE(igst,0))                 AS itcIGST,
         SUM(COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)) AS totalEligibleITC,
         -- Eligible (has GSTIN)
         SUM(CASE WHEN LENGTH(COALESCE(gstin,''))=15
                  THEN COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)
                  ELSE 0 END) AS eligibleITC,
         -- Ineligible (no GSTIN)
         SUM(CASE WHEN LENGTH(COALESCE(gstin,''))<>15
                  THEN COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)
                  ELSE 0 END) AS reversedITC
       FROM purchase_vouchers
       WHERE companyId = ? ${purDateWhere}`,
      pParams
    );

    // ── Net Tax Calculations ──
    const outputCGST  = parseFloat(sales.cgst || 0);
    const outputSGST  = parseFloat(sales.sgst || 0);
    const outputIGST  = parseFloat(sales.igst || 0);
    const outputTotal = outputCGST + outputSGST + outputIGST;

    const itcCGST     = parseFloat(purchases.itcCGST || 0);
    const itcSGST     = parseFloat(purchases.itcSGST || 0);
    const itcIGST     = parseFloat(purchases.itcIGST || 0);
    const eligibleITC = parseFloat(purchases.eligibleITC || 0);
    const reversedITC = parseFloat(purchases.reversedITC || 0);
    const netITC      = eligibleITC - reversedITC;

    const netTaxCGST  = Math.max(0, outputCGST - itcCGST);
    const netTaxSGST  = Math.max(0, outputSGST - itcSGST);
    const netTaxIGST  = Math.max(0, outputIGST - itcIGST);
    const netTaxTotal = netTaxCGST + netTaxSGST + netTaxIGST;

    // Carry-forward credit (ITC > output)
    const carryForwardCGST = Math.max(0, itcCGST - outputCGST);
    const carryForwardSGST = Math.max(0, itcSGST - outputSGST);
    const carryForwardIGST = Math.max(0, itcIGST - outputIGST);

    res.json({
      success: true,
      data: {
        period: month || fy || "All",
        // 3.1 Outward Supplies
        outward: {
          totalInvoices:    parseInt(sales.totalInvoices || 0),
          taxableValue:     parseFloat(sales.taxableValue || 0),
          cgst:             outputCGST,
          sgst:             outputSGST,
          igst:             outputIGST,
          totalOutputTax:   outputTotal,
          grandTotal:       parseFloat(sales.grandTotal || 0),
          nilRatedValue:    parseFloat(sales.nilRatedValue || 0),
          interstateTaxable:parseFloat(sales.interstateTaxable || 0),
          igstOnInterstate: parseFloat(sales.igstOnInterstate || 0),
        },
        // 4. ITC Summary
        itc: {
          totalPurchases:       parseInt(purchases.totalPurchases || 0),
          purchaseTaxableValue: parseFloat(purchases.purchaseTaxableValue || 0),
          itcCGST,
          itcSGST,
          itcIGST,
          totalEligibleITC:     parseFloat(purchases.totalEligibleITC || 0),
          eligibleITC,
          reversedITC,
          netITC,
        },
        // 6. Tax Payment
        payment: {
          outputCGST, outputSGST, outputIGST,
          itcCGST, itcSGST, itcIGST,
          netTaxCGST, netTaxSGST, netTaxIGST,
          netTaxTotal,
          carryForwardCGST, carryForwardSGST, carryForwardIGST,
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── GET /api/gstr3b/monthly/:companyId ── Month-over-month comparison */
export const getGSTR3BMonthly = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { fy } = req.query;

    let dateWhere = "";
    const sParams = [companyId];
    const pParams = [companyId];

    if (fy) {
      const startYear = parseInt(fy.split("-")[0]);
      dateWhere = " AND date >= ? AND date < ?";
      sParams.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
      pParams.push(`${startYear}-04-01`, `${startYear + 1}-04-01`);
    }

    const [salesMonthly] = await pool.query(
      `SELECT DATE_FORMAT(date,'%Y-%m') AS month,
              SUM(subtotal) AS taxable,
              SUM(COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)) AS outputTax,
              SUM(grand_total) AS total
       FROM sales_vouchers WHERE companyId = ? ${dateWhere}
       GROUP BY month ORDER BY month`,
      sParams
    );

    const [purchaseMonthly] = await pool.query(
      `SELECT DATE_FORMAT(date,'%Y-%m') AS month,
              SUM(COALESCE(cgst,0)+COALESCE(sgst,0)+COALESCE(igst,0)) AS itc
       FROM purchase_vouchers WHERE companyId = ? ${dateWhere}
       GROUP BY month ORDER BY month`,
      pParams
    );

    // Merge
    const merged = salesMonthly.map(s => {
      const p = purchaseMonthly.find(p => p.month === s.month) || {};
      const outputTax = parseFloat(s.outputTax || 0);
      const itc       = parseFloat(p.itc || 0);
      return {
        month:     s.month,
        taxable:   parseFloat(s.taxable || 0),
        outputTax,
        itc,
        netTax:    Math.max(0, outputTax - itc),
        total:     parseFloat(s.total || 0),
      };
    });

    res.json({ success: true, data: merged });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};





