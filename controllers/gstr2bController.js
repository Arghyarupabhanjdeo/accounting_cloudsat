import pool from "../db.js";

/* ===================== GET ENTRIES ===================== */
export const getGstr2BEntries = async (req, res) => {
  try {
    const { companyId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT *,
      CASE 
        WHEN books_value = portal_value THEN 'Matched'
        ELSE 'Mismatch'
      END AS status
      FROM gstr2b_itc_entries
      WHERE company_id = ?
      ORDER BY itc_part, created_at DESC
      `,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ===================== CREATE ENTRY ===================== */
export const createGstr2BEntry = async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log(req.body);
    

    const {
      month,
      itc_category,   // AVAILABLE / UNAVAILABLE
      itc_part,       // PART_A / PART_B
      description,
      books_value,
      portal_value,
      notes
    } = req.body;

    if (
      !companyId ||
      !month ||
      !itc_category ||
      !itc_part ||
      !description
    ) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    await pool.query(
      `
      INSERT INTO gstr2b_itc_entries (
        company_id,
        month,
        itc_category,
        itc_part,
        description,
        books_value,
        portal_value,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        month,
        itc_category,
        itc_part,
        description,
        books_value || 0,
        portal_value || 0,
        notes || null
      ]
    );

    res.status(201).json({
      message: "GSTR-2B entry added successfully"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ===================== DELETE ENTRY ===================== */
export const deleteGstr2BEntry = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM gstr2b_itc_entries WHERE id = ?`,
      [id]
    );

    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ===================== RETURN VIEW SUMMARY ===================== */
export const getGstr2BSummary = async (req, res) => {
  try {
    const { companyId} = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        itc_category,
        itc_part,
        SUM(books_value) AS books_total,
        SUM(portal_value) AS portal_total,
        SUM(books_value - portal_value) AS difference
      FROM gstr2b_itc_entries
      WHERE company_id = ?
      GROUP BY itc_category, itc_part
      `,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

