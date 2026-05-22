import pool from "../db.js";

export const getAllTransactions = async (req, res) => {
  const { companyId } = req.params;

  try {
    // 1️⃣ CONTRA VOUCHERS
    const [contra] = await pool.query(
      `SELECT 
          cv.id AS voucherId,
          'Contra' AS voucherType,
          cv.date,
          ct.fromAccount AS ledger,
          ct.amount,
          cv.narration
       FROM contra_vouchers cv
       JOIN contra_transactions ct ON cv.id = ct.voucherId
       WHERE cv.companyId = ?
      `,
      [companyId]
    );

    // 2️⃣ JOURNAL VOUCHERS
    const [journal] = await pool.query(
      `SELECT 
          jv.id AS voucherId,
          'Journal' AS voucherType,
          jv.date,
          jt.particulars AS ledger,
          (jt.debit + jt.credit) AS amount,
          jv.narration
       FROM journal_vouchers jv
       JOIN journal_transactions jt ON jv.id = jt.voucherId
       WHERE jv.companyId = ?
      `,
      [companyId]
    );

    // 3️⃣ PAYMENT VOUCHERS
    const [payment] = await pool.query(
      `SELECT 
          pv.id AS voucherId,
          'Payment' AS voucherType,
          pv.date,
          pve.ledger,
          (pve.debit + pve.credit) AS amount,
          pv.narration
       FROM payment_vouchers pv
       JOIN payment_voucher_entries pve ON pv.id = pve.voucherId
       WHERE pv.companyId = ?
      `,
      [companyId]
    );

    // 4️⃣ PURCHASE VOUCHERS
    const [purchase] = await pool.query(
      `SELECT 
          pv.id AS voucherId,
          'Purchase' AS voucherType,
          pv.date,
          pv.ledger AS ledger,
          pv.grand_total AS amount,
          pv.narration
       FROM purchase_vouchers pv
       WHERE pv.companyId = ?
      `,
      [companyId]
    );


    // 5️⃣ SALES VOUCHERS
    const [sales] = await pool.query(
      `SELECT 
          sv.id AS voucherId,
          'Sales' AS voucherType,
          sv.date,
          sv.ledgerId AS ledger,
          sv.grand_total AS amount,
          sv.narration
       FROM sales_vouchers sv
       WHERE sv.companyId = ?
      `,
      [companyId]
    );

    // 6️⃣ MERGE ALL INTO ONE ARRAY
    const allTransactions = [
      ...contra,
      ...journal,
      ...payment,
      ...purchase,
      ...sales
    ];

     console.log("all :::;",allTransactions);
     
    // 7️⃣ SORT BY DATE (latest first)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({
      message: "All Transactions Fetched",
     
      data: allTransactions
    });

  } catch (error) {
    console.error("TRANSACTION FETCH ERROR:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 💰 Get Cash Ledger Transactions (by companyId and ledgerId)
export const getCashTransactions = async (req, res) => {
  const { companyId, ledgerId } = req.params;

  try {
    // Fetch transactions from voucher_transactions for the specific cash ledger
    const [rows] = await pool.query(
      `SELECT 
        vt.id, 
        vt.date, 
        CONCAT(vt.voucherType, ' Voucher: ', IFNULL(v.narration, '')) as description, 
        CASE WHEN vt.debit > 0 THEN 'credit' ELSE 'debit' END as transactionType, 
        CASE WHEN vt.debit > 0 THEN vt.debit ELSE vt.credit END as amount, 
        vt.voucherType,
        vt.voucherId,
        v.narration,
        'voucher' as source
       FROM voucher_transactions vt
       LEFT JOIN journal_vouchers v ON vt.voucherId = v.id AND vt.voucherType = 'Journal'
       WHERE vt.ledgerId = ? AND vt.companyId = ?
       UNION ALL
       SELECT 
        vt.id, 
        vt.date, 
        CONCAT(vt.voucherType, ' Voucher') as description, 
        CASE WHEN vt.debit > 0 THEN 'credit' ELSE 'debit' END as transactionType, 
        CASE WHEN vt.debit > 0 THEN vt.debit ELSE vt.credit END as amount, 
        vt.voucherType,
        vt.voucherId,
        NULL as narration,
        'voucher' as source
       FROM voucher_transactions vt
       WHERE vt.ledgerId = ? AND vt.companyId = ? AND vt.voucherType != 'Journal'
       ORDER BY date DESC`,
      [ledgerId, companyId, ledgerId, companyId]
    );

    res.json({ success: true, transactions: rows });
  } catch (err) {
    console.error("Get Cash Transactions Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
