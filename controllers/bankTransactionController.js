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
        pv.id, 
        pv.date, 
        CONCAT('Payment to: ', IFNULL(l.name, 'Unknown'), ' (Vch: ', pv.voucherNo, ')') AS description, 
        'debit' AS transactionType, 
        pv.amount, 
        'Payment' AS category, 
        pv.voucherNo AS referenceNumber, 
        0 AS balanceAfter,
        'voucher' AS source
       FROM payment_vouchers pv
       LEFT JOIN ledgers l ON pv.ledgerId = l.id
       WHERE pv.accountType = ? OR pv.accountType = ?
       
       UNION ALL
       
       SELECT 
        rv.id, 
        rv.date, 
        CONCAT('Receipt from: ', IFNULL(l.name, 'Unknown'), ' (Vch: ', rv.voucherId, ')') AS description, 
        'credit' AS transactionType, 
        rv.amount, 
        'Receipt' AS category, 
        rv.voucherId AS referenceNumber, 
        0 AS balanceAfter,
        'voucher' AS source
       FROM receive_vouchers rv
       LEFT JOIN ledgers l ON rv.customer = l.id
       WHERE rv.receiptAccountId = ? OR rv.receiptAccountId = ?

       UNION ALL

       SELECT 
        ct.id,
        cv.date,
        CONCAT('Contra Transfer to: ', IF(ct.toAccount = 0, 'Cash', IFNULL(ba.accountName, 'Unknown Bank')), ' (Vch: ', cv.voucherNo, ')') AS description,
        'debit' AS transactionType,
        ct.amount,
        'Contra' AS category,
        cv.voucherNo AS referenceNumber,
        0 AS balanceAfter,
        'voucher' AS source
       FROM contra_transactions ct
       JOIN contra_vouchers cv ON ct.voucherId = cv.id
       LEFT JOIN bank_accounts ba ON ct.toAccount = ba.id
       WHERE ct.fromAccount = ? OR ct.fromAccount = ?

       UNION ALL

       SELECT 
        ct.id,
        cv.date,
        CONCAT('Contra Transfer from: ', IF(ct.fromAccount = 0, 'Cash', IFNULL(ba.accountName, 'Unknown Bank')), ' (Vch: ', cv.voucherNo, ')') AS description,
        'credit' AS transactionType,
        ct.amount,
        'Contra' AS category,
        cv.voucherNo AS referenceNumber,
        0 AS balanceAfter,
        'voucher' AS source
       FROM contra_transactions ct
       JOIN contra_vouchers cv ON ct.voucherId = cv.id
       LEFT JOIN bank_accounts ba ON ct.fromAccount = ba.id
       WHERE ct.toAccount = ? OR ct.toAccount = ?
       
       ORDER BY date DESC`,
      [
        accountId,
        bankIdStr,
        numericAccountId,
        bankIdStr,
        numericAccountId,
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
