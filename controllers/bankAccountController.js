import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

// ➕ Create Bank Account
export const createBankAccount = async (req, res) => {
  const { companyId } = req.params;
  const data = req.body;
  const creator = getCreatorFromRequest(req);

  try {
    await ensureCreatorColumns(pool, "bank_accounts");
    const q = `
      INSERT INTO bank_accounts
      (companyId, accountName, bankName, accountNumber, ifscCode, branchName, openingDate, accountType, currentBalance, created_by_user_id, created_by_employee_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      companyId,
      data.accountName,
      data.bankName,
      data.accountNumber,
      data.ifscCode,
      data.branchName,
      data.openingDate,
      data.accountType,
      data.currentBalance,
      creator.userId,
      creator.employeeId,
    ];

    const [result] = await pool.query(q, values);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err });
  }
};

// 📌 Get All Bank Accounts
export const getBankAccounts = async (req, res) => {
  const { companyId } = req.params;
    
  try {
    const [rows] = await pool.query(
      `SELECT * FROM bank_accounts WHERE companyId = ? ORDER BY id DESC`, 
      [companyId]
    );
  console.log(rows);
  
    res.json({ success: true, accounts: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err });
  }
};

// ✏️ Edit Account
export const updateBankAccount = async (req, res) => {
  const { id } = req.params;
  const {
    accountName,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
    openingDate,
    accountType,
    currentBalance
  } = req.body;

  try {
    const q = `
      UPDATE bank_accounts 
      SET accountName = ?, bankName = ?, accountNumber = ?, ifscCode = ?, branchName = ?, openingDate = ?, accountType = ?, currentBalance = ?
      WHERE id = ?
    `;
    const values = [
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      openingDate,
      accountType,
      currentBalance,
      id
    ];

    await pool.query(q, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || err });
  }
};

// ❌ Delete Account
export const deleteBankAccount = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(`DELETE FROM bank_accounts WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err });
  }
};
