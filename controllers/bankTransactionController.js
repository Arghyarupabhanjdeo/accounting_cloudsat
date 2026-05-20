import pool from "../db.js";

// ➕ Create Transaction
export const createTransaction = async (req, res) => {
  const { companyId } = req.params;
  const data = req.body;

  try {
    // Insert transaction
    const q = `
      INSERT INTO bank_transactions
      (companyId, accountId, date, description, transactionType, amount, category, referenceNumber, balanceAfter)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      companyId,
      data.accountId,
      data.date,
      data.description,
      data.transactionType,
      data.amount,
      data.category,
      data.referenceNumber,
      data.balanceAfter,
    ];

    await pool.query(q, values);

    // Update account balance
    if (data.transactionType === "credit") {
      await pool.query(
        `UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`,
        [data.amount, data.accountId]
      );
    } else {
      await pool.query(
        `UPDATE bank_accounts SET currentBalance = currentBalance - ? WHERE id = ?`,
        [data.amount, data.accountId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err });
  }
};

// 📌 Get Transactions by Account
export const getTransactions = async (req, res) => {
  const { accountId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM bank_transactions WHERE accountId = ? ORDER BY date DESC`,
      [accountId]
    );

    res.json({ success: true, transactions: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err });
  }
};

// ✏️ Edit Transaction
export const updateTransaction = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(`UPDATE bank_transactions SET ? WHERE id = ?`, [req.body, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err });
  }
};

// ❌ Delete Transaction
export const deleteTransaction = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(`DELETE FROM bank_transactions WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err });
  }
};
