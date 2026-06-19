import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

// ➕ Create Transaction
export const createTransaction = async (req, res) => {
  const { companyId } = req.params;
  const data = req.body;
  const creator = getCreatorFromRequest(req);

  try {
    await ensureCreatorColumns(pool, "bank_transactions");
    const q = `
      INSERT INTO bank_transactions
      (companyId, accountId, date, description, transactionType, amount, category, referenceNumber, balanceAfter, created_by_user_id, created_by_employee_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      creator.userId,
      creator.employeeId,
    ];

    const [result] = await pool.query(q, values);

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

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Create Transaction Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📌 Get Transactions by Account — includes manual + voucher-generated
export const getTransactions = async (req, res) => {
  const { accountId } = req.params;

  try {
    const bankIdStr = `bank_${accountId}`;
    const numericAccountId = parseInt(accountId, 10);

    const [rows] = await pool.query(
      `SELECT 
        id, 
        date, 
        description, 
        transactionType, 
        amount, 
        category, 
        referenceNumber, 
        balanceAfter,
        'manual' AS source
       FROM bank_transactions 
       WHERE accountId = ?
       
       UNION ALL
       
       SELECT 
        id, 
        date, 
        CONCAT('Payment Voucher: ', IFNULL(narration, '')) AS description, 
        'debit' AS transactionType, 
        amount, 
        'Payment' AS category, 
        voucherNo AS referenceNumber, 
        0 AS balanceAfter,
        'voucher' AS source
       FROM payment_vouchers 
       WHERE accountType = ? OR accountType = ?
       
       UNION ALL
       
       SELECT 
        id, 
        date, 
        CONCAT('Receipt Voucher: ', IFNULL(narration, '')) AS description, 
        'credit' AS transactionType, 
        amount, 
        'Receipt' AS category, 
        voucherId AS referenceNumber, 
        0 AS balanceAfter,
        'voucher' AS source
       FROM receive_vouchers 
       WHERE receiptAccountId = ? OR receiptAccountId = ?

       UNION ALL

       SELECT 
        ct.id,
        cv.date,
        CONCAT('Contra Voucher (To Cash/Bank): ', IFNULL(ct.narration, IFNULL(cv.narration, ''))) AS description,
        'debit' AS transactionType,
        ct.amount,
        'Contra' AS category,
        cv.voucherNo AS referenceNumber,
        0 AS balanceAfter,
        'voucher' AS source
       FROM contra_transactions ct
       JOIN contra_vouchers cv ON ct.voucherId = cv.id
       WHERE ct.fromAccount = ? OR ct.fromAccount = ?

       UNION ALL

       SELECT 
        ct.id,
        cv.date,
        CONCAT('Contra Voucher (From Cash/Bank): ', IFNULL(ct.narration, IFNULL(cv.narration, ''))) AS description,
        'credit' AS transactionType,
        ct.amount,
        'Contra' AS category,
        cv.voucherNo AS referenceNumber,
        0 AS balanceAfter,
        'voucher' AS source
       FROM contra_transactions ct
       JOIN contra_vouchers cv ON ct.voucherId = cv.id
       WHERE ct.toAccount = ? OR ct.toAccount = ?
       
       ORDER BY date DESC`,
      [
        accountId,
        bankIdStr,
        accountId,
        bankIdStr,
        accountId,
        bankIdStr,
        numericAccountId,
        bankIdStr,
        numericAccountId
      ]
    );

    res.json({ success: true, transactions: rows });
  } catch (err) {
    console.error("Get Transactions Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ✏️ Update Transaction
export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const {
    date,
    description,
    transactionType,
    amount,
    category,
    referenceNumber,
    balanceAfter,
  } = req.body;

  try {
    const q = `
      UPDATE bank_transactions 
      SET date = ?, description = ?, transactionType = ?, amount = ?, category = ?, referenceNumber = ?, balanceAfter = ?
      WHERE id = ?
    `;
    const values = [
      date,
      description,
      transactionType,
      amount,
      category,
      referenceNumber,
      balanceAfter,
      id,
    ];

    await pool.query(q, values);
    res.json({ success: true });
  } catch (err) {
    console.error("Update Transaction Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ❌ Delete Transaction
export const deleteTransaction = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(`DELETE FROM bank_transactions WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete Transaction Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
