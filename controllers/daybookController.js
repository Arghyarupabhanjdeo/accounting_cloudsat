// import pool from "../db.js";

// export const getDayBook = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     // PURCHASE VOUCHERS
//     const [purchase] = await pool.query(
//       `SELECT id, date, 'Purchase' AS voucher, voucherNo AS number, ledger AS ledger,
//       narration, totalAmount AS debit, 0 AS credit
//       FROM purchase_vouchers WHERE companyId = ?`,
//       [companyId]
//     );
// console.log(purchase);

//     // SALES VOUCHERS
//     const [sales] = await pool.query(
//       `SELECT id, date, 'Sales' AS voucher, voucherNo AS number, ledgerName AS ledger,
//       narration, 0 AS debit, totalAmount AS credit
//       FROM sales WHERE companyId = ?`,
//       [companyId]
//     );

//     // PAYMENT VOUCHERS
//     const [payment] = await pool.query(
//       `SELECT id, date, 'Payment' AS voucher, voucherNo AS number, ledger AS ledger,
//       narration, 0 AS credit, amount AS debit
//       FROM payment_vouchers WHERE companyId = ?`,
//       [companyId]
//     );

//     // RECEIPTS (if exists)
//     const [receipt] = await pool.query(
//       `SELECT id, date, 'Receipt' AS voucher, voucherNo AS number, ledger AS ledger,
//       narration, amount AS credit, 0 AS debit
//       FROM receipt_vouchers WHERE companyId = ?`,
//       [companyId]
//     );

//     // CONTRA
//     const [contra] = await pool.query(
//       `SELECT id, date, 'Contra' AS voucher, voucherNo AS number, ledger AS ledger,
//       narration, debit, credit
//       FROM contra_vouchers WHERE companyId = ?`,
//       [companyId]
//     );

//     // JOURNAL
//     const [journal] = await pool.query(
//       `SELECT id, date, 'Journal' AS voucher, voucherNo AS number, ledger AS ledger,
//       narration, debit, credit
//       FROM journal_vouchers WHERE companyId = ?`,
//       [companyId]
//     );

//     // MERGE ALL
//     let result = [
//       ...purchase,
//       ...sales,
//       ...payment,
//       ...receipt,
//       ...contra,
//       ...journal,
//     ];

//     // SORT BY DATE
//     result.sort((a, b) => new Date(a.date) - new Date(b.date));

//     res.status(200).json(result);

//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "DayBook fetch failed", error });
//   }
// };




// import pool from "../db.js";

// export const getDayBook = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     // PURCHASE
//     const [purchase] = await pool.query(
//       `SELECT 
//           p.id,
//           p.date,
//           'Purchase' AS voucher,
//           p.id AS number,
//           l.name AS ledger,
//           p.narration,
//           p.grand_total AS debit,
//           0 AS credit
//        FROM purchase_vouchers p
//        LEFT JOIN ledgers l ON p.ledgerId = l.id
//        WHERE p.companyId = ?`,
//       [companyId]
//     );
//    // SALES
//     const [sales] = await pool.query(
//       `SELECT 
//           s.id,
//           s.date,
//           'Sales' AS voucher,
//           s.id AS number,
//           l.name AS ledger,
//           s.narration,
//           0 AS debit,
//           s.grand_total AS credit
//       FROM sales_vouchers s
//       LEFT JOIN ledgers l ON s.ledgerId = l.id
//       WHERE s.companyId = ?`,
//       [companyId]
//     );
//    // PAYMENT
//     const [payment] = await pool.query(
//       `SELECT
//           v.id,
//           v.date,
//           'Payment' AS voucher,
//           v.voucherNo AS number,
//           e.ledger AS ledger,
//           v.narration,
//           e.debit AS debit,
//           e.credit AS credit
//        FROM payment_vouchers v
//        LEFT JOIN payment_voucher_entries e ON v.id = e.voucherId
//        WHERE v.companyId = ?`,
//       [companyId]
//     );
//     // CONTRA
//     const [contra] = await pool.query(
//       `SELECT
//           id,
//           date,
//           'Contra' AS voucher,
//           id AS number,
//           '-' AS ledger,
//           narration,
//           totalAmount AS debit,
//           grandTotal AS credit
//        FROM contra_vouchers
//        WHERE companyId = ?`,
//       [companyId]
//     );
//     // JOURNAL
//     const [journal] = await pool.query(
//       `SELECT 
//           j.id,
//           j.date,
//           'Journal' AS voucher,
//           j.id AS number,
//           t.particulars AS ledger,
//           j.narration,
//           t.debit,
//           t.credit
//        FROM journal_vouchers j
//        LEFT JOIN journal_transactions t ON j.id = t.voucherId
//        WHERE j.companyId = ?`,
//       [companyId]
//     );

//     //receive

//     const [receipt] = await pool.query(
//   `SELECT
//       rv.id AS id,
//       rv.date,
//       'Receipt' AS voucher,
//       rv.id AS number,
//       rv.ledger AS ledger,
//       rv.narration,
//       0 AS debit,
//       rv.amount AS credit
//    FROM receive_vouchers rv
//    WHERE rv.companyId = ?`,
//   [companyId]
// );


//     // MERGE
//     let result = [
//       ...purchase,
//       ...sales,
//       ...payment,
//       ...contra,
//       ...journal,
//       ...receipt
//     ];

//     console.log(result);

//     // SORT BY DATE ASC
//     result.sort((a, b) => new Date(a.date) - new Date(b.date));

//     res.status(200).json(result);

//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "DayBook fetch failed", error });
//   }
// };

import pool from "../db.js";
import { getCreatorFromRequest } from "../utils/creatorTracking.js";

export const getDayBook = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);

  try {
    let extraCondition = "";
    const extraParams = [];

    if (creator.employeeId) {
      extraCondition = " AND created_by_employee_id = ?";
      extraParams.push(creator.employeeId);
    }

    // PURCHASE
    const [purchase] = await pool.query(
      `SELECT 
          p.id,
          p.date,
          'Purchase' AS voucher,
          IFNULL(p.invoiceNo, p.id) AS number,
          IFNULL(l.name, p.customer) AS ledger,
          p.narration,
          p.grand_total AS debit,
          0 AS credit
       FROM purchase_vouchers p
       LEFT JOIN ledgers l ON p.ledgerId = l.id
       WHERE p.companyId = ?` + extraCondition.replace(/created_by/g, 'p.created_by'),
      [companyId, ...extraParams]
    );

    // SALES
    const [sales] = await pool.query(
      `SELECT 
          s.id,
          s.date,
          'Sales' AS voucher,
          IFNULL(s.invoiceNo, s.id) AS number,
          IFNULL(l.name, s.customer) AS ledger,
          s.narration,
          0 AS debit,
          s.grand_total AS credit
      FROM sales_vouchers s
      LEFT JOIN ledgers l ON s.ledgerId = l.id
      WHERE s.companyId = ?` + extraCondition.replace(/created_by/g, 's.created_by'),
      [companyId, ...extraParams]
    );

    // PAYMENT
    const [payment] = await pool.query(
      `SELECT
          v.id,
          v.date,
          'Payment' AS voucher,
          v.voucherNo AS number,
          IFNULL(l.name, CONCAT('Ledger #', v.ledgerId)) AS ledger,
          v.narration,
          v.amount AS debit,
          0 AS credit
       FROM payment_vouchers v
       LEFT JOIN ledgers l ON v.ledgerId = l.id
       WHERE v.companyId = ?` + extraCondition.replace(/created_by/g, 'v.created_by'),
      [companyId, ...extraParams]
    );

    // CONTRA
    const [contra] = await pool.query(
      `SELECT
          c.id,
          c.date,
          'Contra' AS voucher,
          IFNULL(c.voucherNo, c.id) AS number,
          (SELECT 
             GROUP_CONCAT(
               CONCAT(
                 IF(ct.toAccount = '0' OR ct.toAccount = 'cash', 'Cash', 
                    COALESCE(
                      (SELECT accountName FROM bank_accounts WHERE id = ct.toAccount),
                      (SELECT name FROM ledgers WHERE id = ct.toAccount),
                      'Bank/Ledger'
                    )
                 ),
                 ' to ',
                 IF(ct.fromAccount = '0' OR ct.fromAccount = 'cash', 'Cash', 
                    COALESCE(
                      (SELECT accountName FROM bank_accounts WHERE id = ct.fromAccount),
                      (SELECT name FROM ledgers WHERE id = ct.fromAccount),
                      'Bank/Ledger'
                    )
                 )
               ) SEPARATOR ', '
             )
           FROM contra_transactions ct 
           WHERE ct.voucherId = c.id
          ) AS ledger,
          c.narration,
          c.grandTotal AS debit,
          0 AS credit
       FROM contra_vouchers c
       WHERE c.companyId = ?` + extraCondition.replace(/created_by/g, 'c.created_by'),
      [companyId, ...extraParams]
    );

    // JOURNAL
    const [journal] = await pool.query(
      `SELECT 
          j.id,
          j.date,
          'Journal' AS voucher,
          IFNULL(j.voucherNo, j.id) AS number,
          IFNULL(t.particulars, '-') AS ledger,
          j.narration,
          t.debit,
          t.credit
       FROM journal_vouchers j
       LEFT JOIN journal_transactions t ON j.id = t.voucherId
       WHERE j.companyId = ?` + extraCondition.replace(/created_by/g, 'j.created_by'),
      [companyId, ...extraParams]
    );

    // RECEIPT
    const [receipt] = await pool.query(
      `SELECT
          rv.id AS id,
          rv.date,
          'Receipt' AS voucher,
          IF(rv.voucherId IS NOT NULL AND rv.voucherId != '' AND rv.voucherId != '0', rv.voucherId, rv.id) AS number,
          IFNULL(l.name, IF(rv.ledger IS NOT NULL AND rv.ledger != '', rv.ledger, CONCAT('Ledger #', rv.customer))) AS ledger,
          rv.narration,
          0 AS debit,
          rv.amount AS credit
       FROM receive_vouchers rv
       LEFT JOIN ledgers l ON rv.customer = l.id
       WHERE rv.companyId = ?` + extraCondition.replace(/created_by/g, 'rv.created_by'),
      [companyId, ...extraParams]
    );

    // MERGE
    let result = [
      ...purchase,
      ...sales,
      ...payment,
      ...contra,
      ...journal,
      ...receipt
    ];

    // SORT BY DATE ASC
    result.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(result);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "DayBook fetch failed", error });
  }
};
