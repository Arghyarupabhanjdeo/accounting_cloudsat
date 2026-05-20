import pool from "../db.js";

/* ===================== B2B ===================== */

export const getB2BInvoices = async (req, res) => {
  try {
    const { companyId } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM gstr2a_invoices
       WHERE company_id = ? 
       ORDER BY invoice_date DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createB2BInvoice = async (req, res) => {
  try {
    const { companyId } = req.params;

    const {
      supplier_gstin,
      supplier_name,
      invoice_no,
      invoice_date,
      month,
      invoice_value,
      taxable_value,
      cgst,
      sgst,
      igst
    } = req.body;

    // ✅ Basic validation
    if (!companyId || !supplier_gstin || !invoice_no || !invoice_date || !month) {
      return res.status(400).json({
        error: "Required fields missing"
      });
    }

    await pool.query(
      `
      INSERT INTO gstr2a_invoices (
        company_id,
        supplier_gstin,
        supplier_name,
        invoice_no,
        invoice_date,
        month,
        invoice_value,
        taxable_value,
        cgst,
        sgst,
        igst,
        status,
        match_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Unmatched')
      `,
      [
        companyId,
        supplier_gstin,
        supplier_name,
        invoice_no,
        invoice_date,
        month,
        invoice_value,
        taxable_value,
        cgst || 0,
        sgst || 0,
        igst || 0
      ]
    );

    res.status(201).json({
      message: "B2B Invoice added successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to create B2B invoice"
    });
  }
};

export const updateB2BStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, match_status } = req.body;

    await pool.query(
      `UPDATE gstr2a_invoices
       SET status = ?, match_status = ?
       WHERE id = ?`,
      [status, match_status, id]
    );

    res.json({ message: "Status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ===================== B2B AMENDMENTS ===================== */

export const getB2BAmendments = async (req, res) => {
  try {
    const { companyId } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM gstr2a_b2b_amendments
       WHERE company_id = ? `,
      [companyId]
    );


    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createB2BAmendment = async (req, res) => {
  try {
    const { companyId } = req.params;

    const {
      month,
      supplier_gstin,
      supplier_name,
      original_invoice_no,
      amendment_type,
      amendment_date,
      original_value,
      amended_value,
      action_note
    } = req.body;

    console.log(req.body);

    // ✅ Validation
    if (
      !companyId ||
      !month ||
      !supplier_gstin ||
      !original_invoice_no ||
      !amendment_type ||
      !amendment_date
    ) {
      return res.status(400).json({
        error: "Required fields missing"
      });
    }

    await pool.query(
      `
      INSERT INTO gstr2a_b2b_amendments (
        company_id,
        month,
        supplier_gstin,
        supplier_name,
        original_invoice_no,
        amendment_type,
        amendment_date,
        original_value,
        amended_value,
        status,
        action_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        month,
        supplier_gstin,
        supplier_name,
        original_invoice_no,
        amendment_type,
        amendment_date,
        original_value || 0,
        amended_value || 0,
        "Pending",
        action_note || null
      ]
    );

    res.status(201).json({
      message: "B2B Amendment added successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

/* ===================== CREDIT / DEBIT NOTES ===================== */

export const getCreditDebitNotes = async (req, res) => {
  try {
    const { companyId } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM gstr2a_credit_debit_notes
       WHERE company_id = ? `,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCreditDebitNote = async (req, res) => {
  try {
    const { companyId } = req.params;

    const {
      month,
      supplier_gstin,
      supplier_name,
      note_no,
      note_date,
      note_type,              // Credit / Debit
      original_invoice_no,
      note_value,
      taxable_value,
      cgst,
      sgst,
      igst,
      action_note
    } = req.body;

    console.log(req.body);

    // ✅ Validation
    if (
      !companyId ||
      !month ||
      !supplier_gstin ||
      !note_no ||
      !note_date ||
      !note_type
    ) {
      return res.status(400).json({
        error: "Required fields missing"
      });
    }

    await pool.query(
      `
      INSERT INTO gstr2a_credit_debit_notes (
        company_id,
        month,
        supplier_gstin,
        supplier_name,
        note_no,
        note_date,
        note_type,
        original_invoice_no,
        note_value,
        taxable_value,
        cgst,
        sgst,
        igst,
        status,
        action_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        month,
        supplier_gstin,
        supplier_name,
        note_no,
        note_date,
        note_type,
        original_invoice_no || null,
        note_value || 0,
        taxable_value || 0,
        cgst || 0,
        sgst || 0,
        igst || 0,
        "Pending",
        action_note || null
      ]
    );

    res.status(201).json({
      message: "Credit/Debit Note added successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

/* ===================== CDN AMENDMENTS ===================== */

export const getCDNAmendments = async (req, res) => {
  try {
    const { companyId} = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM gstr2a_cdn_amendments
       WHERE company_id = ? `,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCDNAmendment = async (req, res) => {
  try {
    const { companyId } = req.params;

    const {
      month,
      supplier_gstin,
      supplier_name,
      original_note_no,
      amendment_type,
      amendment_date,
      original_value,
      amended_value,
      action_note
    } = req.body;

    console.log(req.body);

    // ✅ Validation
    if (
      !companyId ||
      !month ||
      !supplier_gstin ||
      !original_note_no ||
      !amendment_type ||
      !amendment_date
    ) {
      return res.status(400).json({
        error: "Required fields missing"
      });
    }

    await pool.query(
      `
      INSERT INTO gstr2a_cdn_amendments (
        company_id,
        month,
        supplier_gstin,
        supplier_name,
        original_note_no,
        amendment_type,
        amendment_date,
        original_value,
        amended_value,
        status,
        action_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        month,
        supplier_gstin,
        supplier_name,
        original_note_no,
        amendment_type,
        amendment_date,
        original_value || 0,
        amended_value || 0,
        "Pending",
        action_note || null
      ]
    );

    res.status(201).json({
      message: "CDN Amendment added successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

