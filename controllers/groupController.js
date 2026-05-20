import pool from "../db.js";


// ✅ Create Group (company-wise)
export const createGroup = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { groupName, alias, under, nature, subLedger } = req.body;

    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    const sql = `
      INSERT INTO groups (groupName, companyId, aliasName, \`under\`, nature, subLedger)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(sql, [
      groupName,
      companyId,
      alias,
      under,
      nature,
      subLedger,
    ]);

    res.json({ message: "Group created successfully!" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};


// ✅ Get All Groups for a company
export const getGroups = async (req, res) => {
  try {
    const { companyId } = req.params;


    const [rows] = await pool.query(
      "SELECT * FROM groups WHERE companyId = ? OR  companyId IS NULL  ORDER BY id DESC",
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error fetching groups" });
  }
};


// ✅ Get Single Group (only if belongs to company or is default)
export const getGroupById = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const [rows] = await pool.query(
      "SELECT * FROM groups WHERE id = ? AND (companyId = ? OR companyId IS NULL)",
      [id, companyId]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Group not found" });

    res.json(rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error fetching group" });
  }
};


// ✅ Update Group (company or default restricted)
export const updateGroup = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { groupName, alias, under, nature, subLedger } = req.body;

    const sql = `
      UPDATE groups
      SET groupName=?, aliasName=?, \`under\`=?, nature=?, subLedger=?
      WHERE id=? AND (companyId=? OR companyId IS NULL)
    `;

    const [result] = await pool.execute(sql, [
      groupName,
      alias,
      under,
      nature,
      subLedger,
      id,
      companyId,
    ]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Group not found" });

    res.json({ message: "Group updated successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error updating group" });
  }
};


// ✅ Delete Group (company restricted)
export const deleteGroup = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const [result] = await pool.execute(
      "DELETE FROM groups WHERE id = ? AND companyId = ?",
      [id, companyId]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Group not found or not belongs to company" });

    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error deleting group" });
  }
};
