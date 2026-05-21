import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";





// export const createVoucherTRANSACTION = async (req, res) => {
//   const {
//     companyId,
//     voucherId,
//     voucherno,
//     voucherType,
//     ledgerId,
//     debit,
//     credit,
//     fromLedger,
//     toLedger,
//     amount,
//     gst,
//     date,
//     narration,
//     invoiceNo,
//      transactions,
//     items
//   } = req.body;

//   console.log("Received:", req.body);

//   if (!Array.isArray(items) || items.length === 0) {
//     return res.status(400).json({
//       success: false,
//       message: "Items array is required"
//     });
//   }

//   try {
//     let insertedRows = 0;
//      if (voucherType === "journal") {
//   for (const item of transactions) {
//     let fromLedger = null;
//     let toLedger = null;
//     let amount = 0;

//     if (item.debit > 0) {
//       fromLedger = item.ledgerId;
//       amount = item.debit;
//     }

//     if (item.credit > 0) {
//       toLedger = item.ledgerId;
//       amount = item.credit;
//     }

//     // Validate both sides
//     if (!fromLedger || !toLedger) {
//       return res.status(400).json({
//         message: "Journal voucher must have both debit and credit ledgers."
//       });
//     }

//     query = `
//       INSERT INTO voucher_transactions
//       (companyId, voucherId, voucherType, fromLedger, toLedger, amount, \`date\`, narration)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//     `;

//     params = [
//       companyId,
//       voucherId,
//       voucherType,
//       fromLedger,
//       toLedger,
//       amount,
//       date,
//       narration || ""
//     ];

//     await pool.query(query, params);
//   }
// }

//     for (const item of items) {
//       let query = "";
//       let params = [];


//       if (voucherType === "Contra") {
//         query = `
//           INSERT INTO voucher_transactions
//           (companyId, voucherId, voucherType, fromLedger, toLedger, amount, \`date\`, narration)
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//         `;

//         params = [
//           companyId,
//           voucherId,
//           voucherType,
//           item.fromAccount,
//           item.toAccount,
//           item.amount,
//           date,
//           narration || ""
//         ];
//       }
    

//       else {
//         const { itemName, itemQuantity, rate } = item;

//         query = `
//           INSERT INTO voucher_transactions
//           (companyId, voucherId, voucherType, ledgerId, debit, credit, amount, itemName, itemQuantity, gst, \`date\`, narration, invoiceNo)
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `;

//         params = [
//           companyId,
//           voucherId||voucherno,
//           voucherType,
//           ledgerId,
//           debit,
//           credit,
//           item.amount || amount,
//           itemName || "",
//           itemQuantity || 0,
//           gst || 0,
//           date,
//           narration || "",
//           invoiceNo || null
//         ];
//       }

//       await pool.query(query, params);
//       insertedRows++;
//     }

//     return res.json({
//       success: true,
//       message: "Voucher transaction inserted successfully",
//       rowsInserted: insertedRows
//     });

//   } catch (error) {
//     console.error("Voucher Transaction Insert Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while inserting voucher transaction",
//       error: error.message,
//     });
//   }
// };



export const createVoucherTRANSACTION = async (req, res) => {
  const {
    companyId,
    voucherId,
    voucherno,
    voucherNo,
    voucherType,
    ledgerId,
    debit,
    credit,
    fromLedger,
    toLedger,
    amount,
    gst,
    date,
    narration,
    invoiceNo,
    transactions,
    items
  } = req.body;
  const creator = getCreatorFromRequest(req);

  console.log("Received:", req.body);
 

  try {
    await ensureCreatorColumns(pool, "voucher_transactions");
    let insertedRows = 0;


  if (voucherType === "journal") {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Journal voucher requires transactions"
    });
  }

  let debitEntry = transactions.find(t => t.debit > 0);
  let creditEntry = transactions.find(t => t.credit > 0);

  // Auto-balance ONLY IF NEEDED
  if (!debitEntry && !creditEntry) {
    return res.status(400).json({
      success: false,
      message: "Journal voucher must have debit or credit"
    });
  }

  // If only debit exists → create credit automatically
  if (debitEntry && !creditEntry) {
    creditEntry = {
      ledgerId: 9999, // Suspense Ledger
      debit: 0,
      credit: debitEntry.debit,
    };
  }

  // If only credit exists → create debit automatically
  if (creditEntry && !debitEntry) {
    debitEntry = {
      ledgerId: 9999,
      debit: creditEntry.credit,
      credit: 0,
    };
  }

  // Now insert exactly 2 rows: one debit, one credit
  const finalTransactions = [debitEntry, creditEntry];

  for (const item of finalTransactions) {
    let fromLedger = item.debit > 0 ? item.ledgerId : null;
    let toLedger = item.credit > 0 ? item.ledgerId : null;
    let amount = item.debit > 0 ? item.debit : item.credit;
    let ledgerId = item.ledgerId
    const query = `
      INSERT INTO voucher_transactions
      (companyId, voucherId, voucherType,ledgerId, fromLedger, toLedger, amount, \`date\`, narration, created_by_user_id, created_by_employee_id)
      VALUES (?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      companyId,
      voucherId || voucherno,
      "journal",
      ledgerId,
      fromLedger,
      toLedger,
      amount,
      date,
      narration || "",
      creator.userId,
      creator.employeeId
    ];

    await pool.query(query, params);
    insertedRows++;
  }

  return res.json({
    success: true,
    message: "Journal voucher inserted successfully",
    rowsInserted: insertedRows
  });
}
  
    // ===================================================
    // OTHER VOUCHERS REQUIRE ITEMS[]
    // ===================================================
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items array is required"
      });
    }

    // CONTRA + GENERAL VOUCHERS
    for (const item of items) {
      let query = "";
      let params = [];

      if (voucherType === "Contra") {
        query = `
          INSERT INTO voucher_transactions
          (companyId, voucherId, voucherType, fromLedger, toLedger, amount, \`date\`,invoiceNo, narration, created_by_user_id, created_by_employee_id)
          VALUES (?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?)
        `;
        params = [
          companyId,
          voucherId || voucherNo,
          voucherType,
          item.fromAccount,
          item.toAccount,
          item.amount,
          date,
          voucherNo,
          narration || "",
          creator.userId,
          creator.employeeId
        ];
      } else {
        const { itemName, itemQuantity } = item;

        // Use item-level fields; fall back to request-level when appropriate
        const ledgerIdRow = item.ledgerId ?? item.account ?? ledgerId ?? null;
        const debitRow = Number(item.debit ?? item.dr ?? debit ?? 0) || 0;
        const creditRow = Number(item.credit ?? item.cr ?? credit ?? 0) || 0;
        const amountRow = Number(item.amount ?? (debitRow || creditRow) ?? amount ?? 0) || 0;
        const gstRow = Number(item.gst ?? gst ?? 0) || 0;

        query = `
          INSERT INTO voucher_transactions
          (companyId, voucherId, voucherType, ledgerId, debit, credit, amount, itemName, itemQuantity, gst, \`date\`, narration, invoiceNo, created_by_user_id, created_by_employee_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        params = [
          companyId,
          voucherId || voucherno || voucherNo || invoiceNo,
          voucherType,
          ledgerIdRow,
          debitRow > 0 ? debitRow : null,
          creditRow > 0 ? creditRow : null,
          amountRow || null,
          itemName || "",
          itemQuantity || 0,
          gstRow,
          date,
          narration || "",
          invoiceNo || null,
          creator.userId,
          creator.employeeId
        ];
      }

      await pool.query(query, params);
      insertedRows++;
    }

    return res.json({
      success: true,
      message: "Voucher transaction inserted successfully",
      rowsInserted: insertedRows
    });

  } catch (error) {
    console.error("Voucher Transaction Insert Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while inserting voucher transaction",
      error: error.message,
    });
  }
};

