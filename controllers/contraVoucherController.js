import pool from "../db.js";
import fs from "fs";
import path from "path";
import { generateContraVoucherPDF } from "../utils/contraVoucherPdfUtils.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";
import { checkVoucherNumberExists } from "../utils/voucherValidation.js";
const normalizeLedgerId = (id) => {

  if (
    id === null ||
    id === undefined ||
    id === ""
  ) {
    return null;
  }

  // CASH
  if (
    id === "cash" ||
    id === 0 ||
    id === "0"
  ) {
    return 0;
  }

  // BANK ACCOUNT
  if (
    typeof id === "string" &&
    id.startsWith("bank_")
  ) {

    return parseInt(
      id.split("_")[1],
      10
    );
  }

  // NORMAL LEDGER
  return parseInt(id, 10);
};


const getAccountName = async (ledgerId, companyId) => {
  if (!ledgerId) return "N/A";
  if (ledgerId === "cash") return "Cash";
  if (typeof ledgerId === "string" && ledgerId.startsWith("bank_")) {
    try {
      const bankId = parseInt(ledgerId.split("_")[1], 10);
      if (!isNaN(bankId)) {
        const [[bank]] = await pool.query(
          "SELECT accountName, bankName FROM bank_accounts WHERE id = ? AND companyId = ?",
          [bankId, companyId]
        );
        return bank ? `${bank.accountName} (${bank.bankName})` : "N/A";
      }
    } catch (err) {
      console.error("Error in getAccountName for bank:", err);
      return "N/A";
    }
  }
  try {
    const [[ledger]] = await pool.query("SELECT name FROM ledgers WHERE id = ? AND companyId = ?", [ledgerId, companyId]);
    return ledger ? ledger.name : "N/A";
  } catch (err) {
    console.error("Error in getAccountName:", err);
    return "N/A";
  }
};

const buildCompanyLocation = (company = {}) => {
  const parts = [
    company.address,
    company.city,
    company.state,
    company.pinCode || company.pincode,
    company.country,
  ].filter(Boolean);

  return parts.join(", ");
};

const updateAccountBalance = async (connOrPool, accountId, companyId, amount, isAddition) => {
  if (!accountId) return;
  const numericAmount = parseFloat(amount) || 0;
  const factor = isAddition ? 1 : -1;
  const change = numericAmount * factor;

  if (accountId === "cash") {
    // Update the Cash ledger closing balance
    await connOrPool.query(
      `UPDATE ledgers 
       SET closingBalance = closingBalance + ?
       WHERE name = 'Cash' AND companyId = ?`,
      [change, companyId]
    );
  } else if (typeof accountId === "string" && accountId.startsWith("bank_")) {
    const bankId = parseInt(accountId.split("_")[1], 10);
    if (!isNaN(bankId)) {
      await connOrPool.query(
        `UPDATE bank_accounts 
         SET currentBalance = currentBalance + ?
         WHERE id = ? AND companyId = ?`,
        [change, bankId, companyId]
      );
    }
  } else {
    // Fallback: update ledgers table directly
    await connOrPool.query(
      `UPDATE ledgers 
       SET closingBalance = closingBalance + ?
       WHERE id = ? AND companyId = ?`,
      [change, accountId, companyId]
    );
  }
};

// CREATE Contra Voucher


// export const createContraVoucher = async (req, res) => {
//   const { companyId } = req.params;
//   console.log("contra Receving Body",req.body);

//   const {
//     date,
//     narration,
//     gstType,
//     gstRate,
//     transactions,
//     ledgerId 
//   } = req.body;

//   try {
//     const totalAmount = transactions.reduce(
//       (sum, t) => sum + (parseFloat(t.amount) || 0),
//       0
//     );

//     const ledgerId =2
//     const gstAmount = (totalAmount * (gstRate || 0)) / 100;
//     const grandTotal = totalAmount + gstAmount;

//     // Insert Voucher (header)
//     const [voucherResult] = await pool.query(
//       `INSERT INTO contra_vouchers 
//        (companyId, date, narration, gstType, gstRate, gstAmount, totalAmount, grandTotal)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         companyId,
//         date,
//         narration,
//         gstType,
//         gstRate,
//         gstAmount,
//         totalAmount,
//         grandTotal,
//       ]
//     );

//     const voucherId = voucherResult.insertId;

//     // Insert Transactions
//     for (let t of transactions) {
//       await pool.query(
//         `INSERT INTO contra_transactions 
//          (voucherId, fromAccount, toAccount, amount, narration)
//          VALUES (?, ?, ?, ?, ?)`,
//         [voucherId, t.fromAccount, t.toAccount, t.amount, t.narration]
//       );
//     }

//     res.status(201).json({
//       success: true,
//       message: "Contra Voucher Created Successfully",
//       voucherId,
//     });

//   } catch (error) {
//     console.error("CREATE CONTRA ERROR:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
export const createContraVoucher = async (req, res) => {
  const { companyId } = req.params;
  console.log("contra Receving Body", req.body);
  const creator = getCreatorFromRequest(req);

  const {
    voucherNo,
    date,
    narration,
    gstType,
    gstRate,
    transactions,
  } = req.body;
// Check duplicate voucher number
const isDuplicate = await checkVoucherNumberExists(companyId, "contra_vouchers", "voucherNo", voucherNo, creator);

if (isDuplicate) {
  return res.status(400).json({
    success: false,
    message: `Voucher No ${voucherNo} already exists`
  });
}
  try {
    const totalAmount = transactions.reduce(
      (sum, t) => sum + (parseFloat(t.amount) || 0),
      0
    );

    const gstAmount = (totalAmount * (gstRate || 0)) / 100;
    const grandTotal = totalAmount + gstAmount;
    await ensureCreatorColumns(pool, "contra_vouchers");

    // Insert voucher header
    const [voucherResult] = await pool.query(
      `INSERT INTO contra_vouchers 
        (companyId, voucherNo, date, narration, gstType, gstRate, gstAmount, totalAmount, grandTotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        voucherNo,
        date,
        narration,
        gstType,
        gstRate,
        gstAmount,
        totalAmount,
        grandTotal,
      ]
    );

    const voucherId = voucherResult.insertId;
    await pool.query(
      `UPDATE contra_vouchers SET created_by_user_id = ?, created_by_employee_id = ? WHERE id = ?`,
      [creator.userId, creator.employeeId, voucherId]
    );
    // const normalizeLedgerId = (id) => {
    //   if (!id) return null;

    //   if (id === "cash") return 0;

    //   if (typeof id === "string" && id.startsWith("bank_")) {
    //     return parseInt(id.split("_")[1], 10);
    //   }

    //   return parseInt(id, 10) || id;
    // };
    // Process each transaction
    for (let t of transactions) {

      // 1️⃣ INSERT transaction row
      await pool.query(
        `INSERT INTO contra_transactions 
           (voucherId, fromAccount, toAccount, amount, narration)
         VALUES (?, ?, ?, ?, ?)`,
        [
          voucherId,
          normalizeLedgerId(t.fromAccount),
          normalizeLedgerId(t.toAccount),
          t.amount,
          t.narration
        ]
      );

      // 2️⃣ UPDATE ledger balances
      await updateAccountBalance(pool, t.fromAccount, companyId, t.amount, false);
      await updateAccountBalance(pool, t.toAccount, companyId, t.amount, true);
    }

    // Generate and save PDF on create
    let pdfPath = "";
    try {
      const pdfTransactions = [];
      for (let t of transactions) {
        pdfTransactions.push({
          fromAccountName: await getAccountName(t.fromAccount, companyId),
          toAccountName: await getAccountName(t.toAccount, companyId),
          amount: t.amount
        });
      }

      const [companyRows] = await pool.query(`SELECT name FROM companies WHERE id = ?`, [companyId]);
      let companyName = companyRows.length > 0 ? companyRows[0].name : "Cloudsat Private Limited";
      if (!companyName || companyName === "Company Name" || companyName === "Ashwashana Private Limited") {
        companyName = "Cloudsat Private Limited";
      }

      pdfPath = `uploads/contra/Contra_${voucherNo || voucherId}_${Date.now()}.pdf`;

      await generateContraVoucherPDF({ companyName, voucherNo: voucherNo || voucherId, date, transactions: pdfTransactions, total: totalAmount, narration }, pdfPath);
      await pool.query(`UPDATE contra_vouchers SET pdf_path = ? WHERE id = ?`, [pdfPath, voucherId]);
    } catch (pdfErr) {
      console.error("Error generating PDF on create:", pdfErr);
    }

    res.status(201).json({
      success: true,
      message: "Contra Voucher Created Successfully",
      voucherId,
      pdf_path: pdfPath,
    });

  } catch (error) {
    console.error("CREATE CONTRA ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET All Contra Vouchers (for a company)
// export const getContraVouchers = async (req, res) => {
//   const { companyId } = req.params;
//   try {
//     const [rows] = await pool.query(
//       `SELECT * FROM contra_vouchers WHERE companyId = ? ORDER BY id DESC`,
//       [companyId]
//     );

//     res.status(200).json({
//       message: "Contra Vouchers Fetched",
//       data: rows,
//     });
//   } catch (error) {
//     console.error("FETCH ERROR:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };
export const getContraVouchers = async (req, res) => {
  const { companyId } = req.params;

  try {

    const [vouchers] = await pool.query(
      `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS formattedDate FROM contra_vouchers WHERE companyId = ? ORDER BY id DESC`,
      [companyId]
    );

    if (vouchers.length === 0) {
      return res.status(200).json({
        message: "No Contra Vouchers Found",
        data: [],
      });
    }

    // 2️⃣ Fetch ALL Contra Transactions for these vouchers
    const voucherIds = vouchers.map((v) => v.id);

    const [transactions] = await pool.query(
      `SELECT * FROM contra_transactions WHERE voucherId IN (?)`,
      [voucherIds]
    );

    const [[company]] = await pool.query(
      `SELECT * FROM companies WHERE id = ?`,
      [companyId]
    );

    // 3️⃣ Merge transactions into each voucher
    const finalData = vouchers.map((voucher) => ({
      ...voucher,
      date: voucher.formattedDate || voucher.date,
      companyName: company?.name || "",
      companyLocation: buildCompanyLocation(company),
      transactions: transactions.filter(
        (t) => t.voucherId === voucher.id
      ),
    }));

    console.log(finalData);

    // 4️⃣ Send Response
    res.status(200).json({
      message: "Contra vouchers with transactions fetched!",
      data: finalData,
    });

  } catch (error) {
    console.error("FETCH ERROR:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET Single Voucher (with all transactions)
export const getContraVoucherById = async (req, res) => {
  const { id } = req.params;

  try {
    const [[voucher]] = await pool.query(
      `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS formattedDate FROM contra_vouchers WHERE id = ?`,
      [id]
    );

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    voucher.date = voucher.formattedDate || voucher.date;
    delete voucher.formattedDate;

    const [transactions] = await pool.query(
      `SELECT * FROM contra_transactions WHERE voucherId = ?  ORDER BY id DESC`,
      [id]
    );

    const formattedTransactions =
      transactions.map((t) => ({

        ...t,

        fromAccount:
          t.fromAccount === 0 ||
            t.fromAccount === "0"
            ? "cash"
            : `bank_${t.fromAccount}`,

        toAccount:
          t.toAccount === 0 ||
            t.toAccount === "0"
            ? "cash"
            : `bank_${t.toAccount}`,
      }));


    res.status(200).json({
      message: "Voucher Fetched",
      voucher,
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error("FETCH SINGLE ERROR:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// DELETE voucher
export const deleteContraVoucher = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Fetch voucher details & transactions to revert balances
    const [[voucher]] = await conn.query(
      `SELECT * FROM contra_vouchers WHERE id = ?`,
      [id]
    );

    if (!voucher) {
      conn.release();
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const [transactions] = await conn.query(
      `SELECT * FROM contra_transactions WHERE voucherId = ?`,
      [id]
    );

    const companyId = voucher.companyId;

    // Revert ledger balances
    for (const t of transactions) {
      // Add back to FROM account
      await updateAccountBalance(conn, t.fromAccount, companyId, t.amount, true);
      // Subtract from TO account
      await updateAccountBalance(conn, t.toAccount, companyId, t.amount, false);
    }

    // Delete child transactions
    await conn.query(
      `DELETE FROM contra_transactions WHERE voucherId = ?`,
      [id]
    );

    // Delete voucher
    await conn.query(
      `DELETE FROM contra_vouchers WHERE id = ?`,
      [id]
    );

    await conn.commit();
    res.status(200).json({
      success: true,
      message: "Contra Voucher deleted successfully and balances reverted",
    });

  } catch (error) {
    await conn.rollback();
    console.error("DELETE CONTRA ERROR:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error });
  } finally {
    conn.release();
  }
};



// UPDATE Contra Voucher
export const updateContraVoucher = async (req, res) => {
  const { id } = req.params;
  const creator = getCreatorFromRequest(req);
  const {
    voucherNo,
    date,
    narration,
    gstType,
    gstRate,
    transactions,
    companyId
  } = req.body;

  if (!transactions || transactions.length === 0) {
    return res.status(400).json({ success: false, message: "Transactions are required" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ Fetch old voucher & transactions to revert old ledger balances
    const [[oldVoucher]] = await conn.query(
      `SELECT * FROM contra_vouchers WHERE id = ?`,
      [id]
    );

    if (!oldVoucher) {
      conn.release();
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const [oldTransactions] = await conn.query(
      `SELECT * FROM contra_transactions WHERE voucherId = ?`,
      [id]
    );

    const activeCompanyId = companyId || oldVoucher.companyId;

    // Check duplicate voucher number
const isDuplicate = await checkVoucherNumberExists(activeCompanyId, "contra_vouchers", "voucherNo", voucherNo, creator, id);

if (isDuplicate) {
  await conn.rollback();

  return res.status(400).json({
    success: false,
    message: `Voucher No ${voucherNo} already exists`,
  });
}

    // Revert old ledger balances
    for (const oldT of oldTransactions) {
      // Add back to FROM account
      await updateAccountBalance(conn, oldT.fromAccount, activeCompanyId, oldT.amount, true);
      // Subtract from TO account
      await updateAccountBalance(conn, oldT.toAccount, activeCompanyId, oldT.amount, false);
    }

    // 2️⃣ Delete old transaction rows
    await conn.query(
      `DELETE FROM contra_transactions WHERE voucherId = ?`,
      [id]
    );

    // 3️⃣ Compute new totals
    const totalAmount = transactions.reduce(
      (sum, t) => sum + (parseFloat(t.amount) || 0),
      0
    );

    const gstAmount = (totalAmount * (gstRate || 0)) / 100;
    const grandTotal = totalAmount + gstAmount;

    // 4️⃣ Update header table
    await conn.query(
      `UPDATE contra_vouchers 
       SET voucherNo = ?, date = ?, narration = ?, gstType = ?, gstRate = ?, gstAmount = ?, totalAmount = ?, grandTotal = ?
       WHERE id = ?`,
      [
        voucherNo,
        date,
        narration,
        gstType,
        gstRate,
        gstAmount,
        totalAmount,
        grandTotal,
        id
      ]
    );

    // 5️⃣ Insert new transactions and apply new balance updates
    for (let t of transactions) {
      // Insert row
      await conn.query(
        `INSERT INTO contra_transactions 
           (voucherId, fromAccount, toAccount, amount, narration)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,

          normalizeLedgerId(
            t.fromAccount
          ),

          normalizeLedgerId(
            t.toAccount
          ),

          t.amount,

          t.narration
        ]
      );

      // Reduce FROM account
      await updateAccountBalance(conn, t.fromAccount, activeCompanyId, t.amount, false);
      // Increase TO account
      await updateAccountBalance(conn, t.toAccount, activeCompanyId, t.amount, true);
    }

    await conn.commit();

    // Generate and save PDF on update
    let pdfPath = "";
    try {
      const pdfTransactions = [];
      for (let t of transactions) {
        pdfTransactions.push({
          fromAccountName: await getAccountName(t.fromAccount, activeCompanyId),
          toAccountName: await getAccountName(t.toAccount, activeCompanyId),
          amount: t.amount
        });
      }

      const [companyRows] = await pool.query(`SELECT name FROM companies WHERE id = ?`, [activeCompanyId]);
      let companyName = companyRows.length > 0 ? companyRows[0].name : "Cloudsat Private Limited";
      if (!companyName || companyName === "Company Name" || companyName === "Ashwashana Private Limited") {
        companyName = "Cloudsat Private Limited";
      }

      pdfPath = `uploads/contra/Contra_${voucherNo || id}_${Date.now()}.pdf`;

      await generateContraVoucherPDF({ companyName, voucherNo: voucherNo || id, date, transactions: pdfTransactions, total: totalAmount, narration }, pdfPath);
      await pool.query(`UPDATE contra_vouchers SET pdf_path = ? WHERE id = ?`, [pdfPath, id]);
    } catch (pdfErr) {
      console.error("Error generating PDF on update:", pdfErr);
    }

    res.status(200).json({
      success: true,
      message: "Contra Voucher Updated Successfully",
      pdf_path: pdfPath,
    });

  } catch (error) {
    await conn.rollback();
    console.error("UPDATE CONTRA ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

export const bulkCreateContraVoucher = async (req, res) => {
  const { companyId, vouchers } = req.body;
  const creator = getCreatorFromRequest(req);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await ensureCreatorColumns(conn, "contra_vouchers");

    for (const voucher of vouchers) {
      const {
        voucherNo,
        date,
        narration,
        gstType,
        gstRate,
        transactions,
      } = voucher;

      const totalAmount = transactions.reduce(
        (sum, t) => sum + (parseFloat(t.amount) || 0),
        0
      );

      const gstAmount = (totalAmount * (gstRate || 0)) / 100;
      const grandTotal = totalAmount + gstAmount;

      // Insert voucher header
      const [voucherResult] = await conn.query(
        `INSERT INTO contra_vouchers 
          (companyId, voucherNo, date, narration, gstType, gstRate, gstAmount, totalAmount, grandTotal, created_by_user_id, created_by_employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          voucherNo,
          date,
          narration,
          gstType,
          gstRate,
          gstAmount,
          totalAmount,
          grandTotal,
          creator.userId,
          creator.employeeId,
        ]
      );

      const voucherId = voucherResult.insertId;

      // Process each transaction
      for (let t of transactions) {

        // 1️⃣ INSERT transaction row
        await conn.query(
          `INSERT INTO contra_transactions 
             (voucherId, fromAccount, toAccount, amount, narration)
           VALUES (?, ?, ?, ?, ?)`,
          [voucherId, t.fromAccount, t.toAccount, t.amount, t.narration]
        );

        // 2️⃣ UPDATE ledger balances
        await updateAccountBalance(conn, t.fromAccount, companyId, t.amount, false);
        await updateAccountBalance(conn, t.toAccount, companyId, t.amount, true);
      }
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Bulk Contra Vouchers Created Successfully",
    });

  } catch (error) {
    await conn.rollback();
    console.error("BULK CONTRA ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};


export const downloadContraVoucherPDF = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(`SELECT * FROM contra_vouchers WHERE id = ?`, [id]);
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });

    // ALWAYS regenerate the PDF to ensure correct layout and company branding
    const [transactions] = await pool.query(`SELECT * FROM contra_transactions WHERE voucherId = ?`, [id]);
    const pdfTransactions = [];
    for (let t of transactions) {
      pdfTransactions.push({
        fromAccountName: await getAccountName(t.fromAccount, voucher.companyId),
        toAccountName: await getAccountName(t.toAccount, voucher.companyId),
        amount: t.amount
      });
    }

    const [companyRows] = await pool.query(`SELECT name FROM companies WHERE id = ?`, [voucher.companyId]);
    let companyName = companyRows.length > 0 ? companyRows[0].name : "Cloudsat Private Limited";
    if (!companyName || companyName === "Company Name" || companyName === "Ashwashana Private Limited") {
      companyName = "Cloudsat Private Limited";
    }

    const pdfPath = `uploads/contra/Contra_${voucher.voucherNo || id}_${Date.now()}.pdf`;

    await generateContraVoucherPDF({ companyName, voucherNo: voucher.voucherNo || id, date: voucher.date, transactions: pdfTransactions, total: voucher.totalAmount, narration: voucher.narration }, pdfPath);
    await pool.query(`UPDATE contra_vouchers SET pdf_path = ? WHERE id = ?`, [pdfPath, id]);

    res.download(path.join(process.cwd(), pdfPath));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error generating PDF" });
  }
};



export const getNextContraVoucherNo = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [[row]] = await pool.query(
      `SELECT MAX(CAST(voucherNo AS UNSIGNED)) AS lastVoucher
       FROM contra_vouchers
       WHERE companyId = ?`,
      [companyId]
    );

    const nextVoucherNo = (row?.lastVoucher || 0) + 1;

    res.json({
      success: true,
      voucherNo: String(nextVoucherNo),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};