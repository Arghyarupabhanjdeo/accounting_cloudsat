import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

/* =========================
   DASHBOARD SUMMARY
========================= */
export const getSummary = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        COUNT(*) AS totalChallans,
        COALESCE(SUM(amount),0) AS totalAmount,
        SUM(status = 'Matched') AS matchedChallans,
        SUM(status != 'Matched') AS pendingReconciliation,
        COALESCE(SUM(CASE WHEN status != 'Matched' THEN amount ELSE 0 END),0) AS unmatchedAmount
      FROM challans
      WHERE companyId = ?
      `,
      [companyId]
    );

    const summary = rows[0];

    summary.matchedPercentage = summary.totalChallans
      ? Math.round((summary.matchedChallans / summary.totalChallans) * 100)
      : 0;

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   LIST / FILTER CHALLANS
========================= */
export const getChallans = async (req, res) => {
  const { companyId } = req.params;
  const { status, payment_mode, q } = req.query;

  let sql = `
    SELECT *
    FROM challans
    WHERE companyId = ?
  `;
  const params = [companyId];

  if (status && status !== "all") {
    sql += " AND status = ?";
    params.push(status);
  }

  if (payment_mode && payment_mode !== "all") {
    sql += " AND payment_mode = ?";
    params.push(payment_mode);
  }

  if (q) {
    sql += `
      AND (
        cpn LIKE ?
        OR reference_no LIKE ?
        OR bank_name LIKE ?
      )
    `;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += " ORDER BY payment_date DESC";

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   GET SINGLE CHALLAN
========================= */
export const getChallanById = async (req, res) => {
  const { companyId, id } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM challans
      WHERE id = ? AND companyId = ?
      `,
      [id, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Challan not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   ADD CHALLAN
========================= */
export const addChallan = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);

  try {
    await ensureCreatorColumns(pool, "challans");
    const {
      challan_no,
      cpn,
      payment_date,
      payment_mode,
      bank_name,
      reference_no,
      transaction_id,
      amount,
      tax_period,
      return_type,
      section,
      gstin,
      remarks
    } = req.body;

    await pool.query(
      `
      INSERT INTO challans
      (
        companyId,
        challan_no,
        cpn,
        payment_date,
        payment_mode,
        bank_name,
        reference_no,
        transaction_id,
        amount,
        tax_period,
        return_type,
        section,
        gstin,
        remarks,
        created_by_user_id,
        created_by_employee_id
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        companyId,
        challan_no,
        cpn,
        payment_date,
        payment_mode,
        bank_name,
        reference_no,
        transaction_id,
        amount,
        tax_period,
        return_type,
        section,
        gstin,
        remarks,
        creator.userId,
        creator.employeeId
      ]
    );

    res.json({ message: "Challan added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   RECONCILE CHALLAN
========================= */
export const reconcileChallan = async (req, res) => {
  const { companyId, id } = req.params;
  const { status, reconciliation_status, remarks } = req.body;

  try {
    const [result] = await pool.query(
      `
      UPDATE challans
      SET status = ?, reconciliation_status = ?, remarks = ?
      WHERE id = ? AND companyId = ?
      `,
      [status, reconciliation_status, remarks, id, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Challan not found" });
    }

    await pool.query(
      `
      INSERT INTO challan_match_logs
      (companyId, challan_id, action, remarks)
      VALUES (?, ?, 'MANUAL_MATCH', ?)
      `,
      [companyId, id, remarks]
    );

    res.json({ message: "Challan reconciled successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

