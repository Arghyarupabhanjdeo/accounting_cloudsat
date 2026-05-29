import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";
//  Get all companies
export const getCompanies = async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM companies WHERE userId = ? AND id = 14 ORDER BY id DESC",
      [userId]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};


// Get company by ID
export const getCompanyById = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM companies WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "Company not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

//  Create new company
export const createCompany = async (req, res) => {
  // const { userId } = req.params;

  try {
    const { name, email, gstRegistered, gstin } = req.body;
    const creator = getCreatorFromRequest(req);
    await ensureCreatorColumns(pool, "companies");

    // Build final data object
    const finalData = {
      name,
      email,
      gstRegistered,
      gstin,
      userId: req.body.userId || 0
    };

    console.log(finalData);

    const sql = `
      INSERT INTO companies 
      (name, email, gstRegistered, gstin, userId, created_by_user_id, created_by_employee_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      finalData.name,
      finalData.email,
      finalData.gstRegistered,
      finalData.gstin,
      finalData.userId,
      creator.userId,
      creator.employeeId
    ];

    const [result] = await pool.query(sql, values);

    res.json({
      message: "Company created successfully",
      id: result.insertId,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};



// Update company
export const updateCompany = async (req, res) => {
  try {
    const data = req.body;
    await pool.query("UPDATE companies SET ? WHERE id = ?", [
      data,
      req.params.id,
    ]);
    res.json({ message: "Company updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

// Delete company
export const deleteCompany = async (req, res) => {
  try {
    await pool.query("DELETE FROM companies WHERE id = ?", [req.params.id]);
    res.json({ message: "Company deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

export const getCompanyByEmail = async (req, res) => {
  const { email } = req.params;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const [rows] = await pool.query("SELECT * FROM companies WHERE email = ?", [
      email,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};
