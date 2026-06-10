import pool from "../db.js";
import fs from "fs";
import path from "path";
import { generateReceiptPDF } from "../utils/receiptPdfUtils.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";
import { checkVoucherNumberExists } from "../utils/voucherValidation.js";

const getAccountName = async (ledgerId, companyId) => {
  if (!ledgerId) return "N/A";
  if (ledgerId === "cash") return "Cash";
  if (typeof ledgerId === "string" && ledgerId.startsWith("bank_")) {
    const bankId = parseInt(ledgerId.split("_")[1], 10);
    if (!Number.isNaN(bankId)) {
      const [[bank]] = await pool.query(
        "SELECT accountName, bankName FROM bank_accounts WHERE id = ? AND companyId = ?",
        [bankId, companyId]
      );
      return bank ? `${bank.accountName}${bank.bankName ? ` (${bank.bankName})` : ""}` : ledgerId;
    }
  }
  if (typeof ledgerId === "string" && ledgerId.startsWith("ledger_")) {
    ledgerId = ledgerId.split("_")[1];
  }
  try {
    const isNumeric = !isNaN(Number(ledgerId));
    if (isNumeric) {
      const [[ledger]] = await pool.query("SELECT name FROM ledgers WHERE id = ? AND companyId = ?", [Number(ledgerId), companyId]);
      return ledger ? ledger.name : ledgerId;
    } else {
      const [[ledger]] = await pool.query("SELECT name FROM ledgers WHERE name = ? AND companyId = ?", [ledgerId, companyId]);
      return ledger ? ledger.name : ledgerId;
    }
  } catch (err) {
    console.error("Error in getAccountName:", err);
    return ledgerId;
  }
};

const normalizeReceiptAccountId = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const account = String(value);
  if (account === "cash" || account.startsWith("bank_") || account.startsWith("ledger_")) {
    return account;
  }
  return `bank_${account}`;
};

export const createReceiveVoucher = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);

  try {
    await ensureCreatorColumns(pool, "receive_vouchers");
    const {
      voucherNo,
      date,
      receiptAccountId,
      instrumentType,
      referenceNo,
      narration,
      items,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required" });
    }

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const finalVoucherNo = voucherNo || Date.now().toString();

    const isDuplicate = await checkVoucherNumberExists(companyId, "receive_vouchers", "voucherId", finalVoucherNo, creator);
    if (isDuplicate) {
      return res.status(400).json({ success: false, message: "Voucher number already exists" });
    }

    for (let i = 0; i < items.length; i++) {
      const { ledgerId, amount } = items[i];
      await pool.query(
        `INSERT INTO receive_vouchers 
        (voucherId, companyId, date, receiptAccountId, instrumentType, referenceNo, narration, customer, amount, totalAmount, created_by_user_id, created_by_employee_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [finalVoucherNo, companyId, date, receiptAccountId, instrumentType, referenceNo, narration, ledgerId, amount, i === 0 ? totalAmount : null, creator.userId, creator.employeeId]
      );

      await pool.query(
        `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) + ? WHERE id = ? AND companyId = ?`,
        [amount, ledgerId, companyId]
      );
    }

    let pdfPath = "";
    try {
      const pdfItems = [];
      for (let item of items) {
        pdfItems.push({
          description: await getAccountName(item.ledgerId, companyId),
          amount: item.amount
        });
      }

      pdfPath = `uploads/receipt/Receipt_${finalVoucherNo}_${Date.now()}.pdf`;
      const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [companyId]);
      
      await generateReceiptPDF({
        voucherNo: finalVoucherNo,
        date: date,
        total: totalAmount,
        items: pdfItems,
        narration: narration,
        customer: await getAccountName(receiptAccountId, companyId),
        company: company || {}
      }, pdfPath);

      await pool.query(`UPDATE receive_vouchers SET pdf_path = ? WHERE voucherId = ? AND companyId = ?`, [pdfPath, finalVoucherNo, companyId]);
    } catch (pdfErr) {
      console.error("PDF generation failed:", pdfErr);
    }

    return res.json({ success: true, message: "Receive voucher created", voucherId: finalVoucherNo, totalAmount, pdf_path: pdfPath });
  } catch (err) {
    console.error("Receive Voucher Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getReceiveVoucher = async (req, res) => {
  const { companyId } = req.params
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.voucherId, r.companyId, DATE_FORMAT(r.date, '%Y-%m-%d') AS date, r.receiptAccountId, r.instrumentType, r.referenceNo, r.narration, r.customer, SUM(r.amount) AS amount, r.totalAmount, r.pdf_path, MAX(r.created_by_user_id) AS created_by_user_id, MAX(r.created_by_employee_id) AS created_by_employee_id, MAX(u.name) AS creator_name, MAX(eu.name) AS employee_name
       FROM receive_vouchers r
       LEFT JOIN users u ON r.created_by_user_id = u.id
         LEFT JOIN users eu ON r.created_by_employee_id = eu.employee_id
       WHERE r.companyId = ?
       GROUP BY IFNULL(NULLIF(r.voucherId, ''), r.id)
       ORDER BY MAX(r.id) DESC`,
      [companyId]
    );
    const data = rows.map((row) => ({
      ...row,
      receiptAccountId: normalizeReceiptAccountId(row.receiptAccountId),
    }));

    res.status(200).json({
      message: "data fetched SuccessFully",
      data
    })
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to fetch receive vouchers", error });
  }
}

export const bulkCreateReceiveVoucher = async (req, res) => {
  const { companyId, vouchers } = req.body;
  const creator = getCreatorFromRequest(req);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await ensureCreatorColumns(conn, "receive_vouchers");

    for (const voucher of vouchers) {
      const {
        voucherNo,
        date,
        receiptAccountId,
        instrumentType,
        referenceNo,
        narration,
        items,
        totalAmount
      } = voucher;

      if (!items || items.length === 0) continue;

      for (let i = 0; i < items.length; i++) {
        const { ledgerId, amount } = items[i];

        if (!ledgerId || !amount) continue;

        // Insert row
        await conn.query(
          `INSERT INTO receive_vouchers 
          (
            voucherId,
            companyId,
            date,
            receiptAccountId,
            instrumentType,
            referenceNo,
            narration,
            customer,
            amount,
            totalAmount,
            created_by_user_id,
            created_by_employee_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            voucherNo,
            companyId,
            date,
            receiptAccountId,
            instrumentType,
            referenceNo,
            narration,
            ledgerId,
            amount,
            i === 0 ? totalAmount : null,
            creator.userId,
            creator.employeeId,
          ]
        );

        // Update ledger balance
        await conn.query(
          `
          UPDATE ledgers 
          SET closingBalance = COALESCE(closingBalance, 0) + ?
          WHERE name = ? AND companyId = ?
          `,
          [amount, ledgerId, companyId] 
        );
      }
    }

    await conn.commit();
    res.json({ message: "Bulk Receipt Vouchers Created Successfully" });

  } catch (err) {
    await conn.rollback();
    console.error("BULK RECEIPT ERROR:", err);
    res.status(500).json({ message: "Error creating receipt vouchers", error: err });
  } finally {
    conn.release();
  }
};

// ------------------------------------------------------
// GET SINGLE RECEIPT VOUCHER (FULL DETAILS)
// ------------------------------------------------------
export const getReceiveVoucherById = async (req, res) => {
  const { voucherId } = req.params;

  try {
    let [rows] = await pool.query(
      `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS formattedDate FROM receive_vouchers WHERE voucherId = ?`,
      [voucherId]
    );

    if (rows.length === 0) {
      const [rowsById] = await pool.query(
        `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS formattedDate FROM receive_vouchers WHERE id = ?`,
        [voucherId]
      );

      if (rowsById.length > 0) {
        const actualVoucherId = rowsById[0].voucherId;
        [rows] = await pool.query(
          `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS formattedDate FROM receive_vouchers WHERE voucherId = ?`,
          [actualVoucherId]
        );
      }
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const firstRow = rows[0];

    // Format output to match front-end expectations
    res.json({
      id: firstRow.id,
      voucherId: firstRow.voucherId,
      companyId: firstRow.companyId,
      date: firstRow.formattedDate || firstRow.date,
      receiptAccountId: normalizeReceiptAccountId(firstRow.receiptAccountId),
      instrumentType: firstRow.instrumentType,
      referenceNo: firstRow.referenceNo,
      narration: firstRow.narration,
      totalAmount: firstRow.totalAmount || rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      items: rows.map(r => ({
        id: r.id,
        ledgerId: String(r.customer),
        amount: r.amount
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching voucher details" });
  }
};

// ------------------------------------------------------
// DELETE RECEIPT VOUCHER
// ------------------------------------------------------
export const deleteReceiveVoucher = async (req, res) => {
  const { voucherId } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    if (!voucherId || voucherId.trim() === "" || voucherId === "undefined" || voucherId === "null") {
      conn.release();
      return res.status(400).json({ success: false, message: "Invalid Voucher ID to delete" });
    }

    const [rows] = await conn.query(
      `SELECT * FROM receive_vouchers WHERE voucherId = ?`,
      [voucherId]
    );

    if (rows.length === 0) {
      // Fallback: Check if it's a primary key ID!
      const [rowsById] = await conn.query(
        `SELECT * FROM receive_vouchers WHERE id = ?`,
        [voucherId]
      );
      if (rowsById.length > 0) {
        const row = rowsById[0];
        const ledgerId = row.customer;
        const amount = row.amount;
        const companyId = row.companyId;

        if (ledgerId && amount) {
          const isNumeric = !isNaN(Number(ledgerId));
          if (isNumeric) {
            await conn.query(
              `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) - ? WHERE id = ? AND companyId = ?`,
              [amount, Number(ledgerId), companyId]
            );
          } else {
            await conn.query(
              `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) - ? WHERE name = ? AND companyId = ?`,
              [amount, ledgerId, companyId]
            );
          }
        }

        await conn.query(
          `DELETE FROM receive_vouchers WHERE id = ?`,
          [voucherId]
        );

        await conn.commit();
        return res.json({ success: true, message: "Receipt Voucher deleted successfully by ID and balance reverted" });
      }

      conn.release();
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const firstRow = rows[0];
    const companyId = firstRow.companyId;

    // Revert ledger balances (subtracting what was added)
    for (const row of rows) {
      const ledgerId = row.customer;
      const amount = row.amount;

      if (ledgerId && amount) {
        const isNumeric = !isNaN(Number(ledgerId));
        if (isNumeric) {
          await conn.query(
            `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) - ? WHERE id = ? AND companyId = ?`,
            [amount, Number(ledgerId), companyId]
          );
        } else {
          await conn.query(
            `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) - ? WHERE name = ? AND companyId = ?`,
            [amount, ledgerId, companyId]
          );
        }
      }
    }

    // Delete voucher entries
    await conn.query(
      `DELETE FROM receive_vouchers WHERE voucherId = ?`,
      [voucherId]
    );

    await conn.commit();
    res.json({ success: true, message: "Receipt Voucher deleted successfully and balances reverted" });

  } catch (error) {
    await conn.rollback();
    console.error("Delete Voucher Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete voucher", error });
  } finally {
    conn.release();
  }
};

// ------------------------------------------------------
// UPDATE RECEIPT VOUCHER
// ------------------------------------------------------
export const updateReceiveVoucher = async (req, res) => {
  const { voucherId } = req.params;
  const creator = getCreatorFromRequest(req);
  const {
    voucherNo, // This will be the new/updated voucherNo
    date,
    receiptAccountId,
    instrumentType,
    referenceNo,
    narration,
    items,
    companyId
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "Items are required" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const isDuplicate = await checkVoucherNumberExists(companyId || req.body.companyId, "receive_vouchers", "voucherId", voucherNo || voucherId, creator);
    // Note: since receive_vouchers stores multiple rows per "voucherId", checkVoucherNumberExists doesn't work perfectly with excludeId.
    // However, since we check voucherNo, if they changed the number, we need to check if the NEW number already exists.
    // We should do a manual query to correctly exclude all rows belonging to the CURRENT voucher.
    
    if (voucherNo && voucherNo !== voucherId) {
       const [[existing]] = await conn.query("SELECT id FROM receive_vouchers WHERE companyId = ? AND voucherId = ? AND (created_by_user_id = ? OR created_by_employee_id = ?)", [companyId, voucherNo, creator.userId || 0, creator.employeeId || 0]);
       if (existing) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ success: false, message: "Voucher number already exists" });
       }
    }

    // 1️⃣ Fetch old items to revert ledger balances
    const [oldRows] = await conn.query(
      `SELECT * FROM receive_vouchers WHERE voucherId = ?`,
      [voucherId]
    );

    if (oldRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const activeCompanyId = companyId || oldRows[0].companyId;

    for (const oldRow of oldRows) {
      const ledgerId = oldRow.customer;
      const amount = oldRow.amount;

      if (ledgerId && amount) {
        const isNumeric = !isNaN(Number(ledgerId));
        if (isNumeric) {
          await conn.query(
            `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) - ? WHERE id = ? AND companyId = ?`,
            [amount, Number(ledgerId), activeCompanyId]
          );
        } else {
          await conn.query(
            `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) - ? WHERE name = ? AND companyId = ?`,
            [amount, ledgerId, activeCompanyId]
          );
        }
      }
    }

    // 2️⃣ Delete old entries
    await conn.query(
      `DELETE FROM receive_vouchers WHERE voucherId = ?`,
      [voucherId]
    );

    // 3️⃣ Calculate new total
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    // 4️⃣ Insert new entries and update ledger balances
    for (let i = 0; i < items.length; i++) {
      const { ledgerId, amount } = items[i];

      if (!ledgerId) continue;
      if (!amount || isNaN(Number(amount))) continue;

      // Insert row
      await conn.query(
        `INSERT INTO receive_vouchers 
        (
          voucherId,
          companyId,
          date,
          receiptAccountId,
          instrumentType,
          referenceNo,
          narration,
          customer,
          amount,
          totalAmount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          voucherNo || voucherId, // Use the new voucherNo, or fallback to parameter
          activeCompanyId,
          date,
          receiptAccountId,
          instrumentType,
          referenceNo,
          narration,
          ledgerId,
          amount,
          i === 0 ? totalAmount : null,
        ]
      );

      // Update ledger balance (adding new amount)
      const isNumeric = !isNaN(Number(ledgerId));
      if (isNumeric) {
        await conn.query(
          `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) + ? WHERE id = ? AND companyId = ?`,
          [amount, Number(ledgerId), activeCompanyId]
        );
      } else {
        await conn.query(
          `UPDATE ledgers SET closingBalance = COALESCE(closingBalance, 0) + ? WHERE name = ? AND companyId = ?`,
          [amount, ledgerId, activeCompanyId]
        );
      }
    }

    await conn.commit();

    // Pre-generate PDF for instant preview
    let pdfPath = "";
    try {
      const pdfItems = [];
      for (let item of items) {
        pdfItems.push({
          description: await getAccountName(item.ledgerId, activeCompanyId),
          amount: item.amount
        });
      }

      pdfPath = `uploads/receipt/Receipt_${voucherNo || voucherId}_${Date.now()}.pdf`;

      const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [activeCompanyId]);
      const pdfData = {
        voucherNo: voucherNo || voucherId,
        date: date,
        total: totalAmount,
        items: pdfItems,
        narration: narration,
        customer: await getAccountName(receiptAccountId, activeCompanyId),
        company: company || {}
      };

      await generateReceiptPDF(pdfData, pdfPath);
      await pool.query(
        `UPDATE receive_vouchers SET pdf_path = ? WHERE voucherId = ? AND companyId = ?`,
        [pdfPath, voucherNo || voucherId, activeCompanyId]
      );
    } catch (pdfErr) {
      console.error("Error generating PDF on updateReceiveVoucher:", pdfErr);
    }

    res.json({
      success: true,
      message: "Receive voucher updated successfully",
      voucherId: voucherNo || voucherId,
      totalAmount,
      pdf_path: pdfPath
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error in updateReceiveVoucher:", error);
    res.status(500).json({ success: false, message: "Error updating voucher", error: error.message });
  } finally {
    conn.release();
  }
};

export const downloadReceiveVoucherPDF = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(`SELECT * FROM receive_vouchers WHERE id = ?`, [id]);
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found" });

    const [entries] = await pool.query(
      `SELECT * FROM receive_vouchers WHERE voucherId = ? AND companyId = ?`,
      [voucher.voucherId, voucher.companyId]
    );

    const items = [];
    for (let entry of entries) {
      items.push({
        description: await getAccountName(entry.customer, voucher.companyId),
        amount: entry.amount
      });
    }

    const pdfPath = `uploads/receipt/Receipt_${voucher.voucherId || id}_${Date.now()}.pdf`;

    const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [voucher.companyId]);
    const pdfData = {
      voucherNo: voucher.voucherId || id,
      date: voucher.date,
      total: voucher.totalAmount,
      items,
      narration: voucher.narration,
      customer: await getAccountName(voucher.receiptAccountId, voucher.companyId),
      company: company || {}
    };

    await generateReceiptPDF(pdfData, pdfPath);
    await pool.query(
      `UPDATE receive_vouchers SET pdf_path = ? WHERE voucherId = ? AND companyId = ?`,
      [pdfPath, voucher.voucherId, voucher.companyId]
    );

    res.download(path.join(process.cwd(), pdfPath));
  } catch (error) {
    console.error("Error in downloadReceiveVoucherPDF:", error);
    res.status(500).json({ success: false, message: "Error generating PDF", error: error.message });
  }
};
