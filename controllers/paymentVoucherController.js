import pool from "../db.js";
import fs from "fs";
import path from "path";
import { generatePaymentPDF } from "../utils/paymentPdfUtils.js";
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
    const [[ledger]] = await pool.query("SELECT name FROM ledgers WHERE id = ? AND companyId = ?", [ledgerId, companyId]);
    return ledger ? ledger.name : ledgerId;
  } catch (err) {
    console.error("Error in getAccountName:", err);
    return ledgerId;
  }
};

const normalizePaymentAccountType = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const account = String(value);
  if (account === "cash" || account.startsWith("bank_") || account.startsWith("ledger_")) {
    return account;
  }
  return `bank_${account}`;
};

// export const createPaymentVoucher = async (req, res) => {
//   const { companyId } = req.params;
//   const { voucherNo, date, narration, accountType, items, totalAmount } = req.body;

//   if (!accountType)
//     return res.status(400).json({ message: "Account Type is required" });

//   if (!items || items.length === 0)
//     return res.status(400).json({ message: "Provide voucher rows" });

//   try {
//     const conn = await pool.getConnection();
//     await conn.beginTransaction();

//     // 1️⃣ Insert main voucher
//     const [voucher] = await conn.query(
//       `
//       INSERT INTO payment_vouchers
//       (companyId, voucherNo, date, accountType, narration, totalAmount)
//       VALUES (?, ?, ?, ?, ?, ?)
//       `,
//       [companyId, voucherNo, date, accountType, narration, totalAmount]
//     );

//     const voucherId = voucher.insertId; // main ID

//     // 2️⃣ Insert each ledger item one by one
//     for (const item of items) {
//       await conn.query(
//         `
//         INSERT INTO payment_voucher_items
//         (voucherId, ledgerId, amount)
//         VALUES (?, ?, ?)
//         `,
//         [voucherId, item.ledgerId, item.amount]
//       );
//     }
//      await pool.query(
//       `
//         UPDATE ledgers 
//         SET closingBalance = closingBalance + ?
//         WHERE id = ? AND companyId = ?
//         `,
//       [amount, ledgerId, companyId]
//     );

//     await conn.commit();
//     conn.release();

//     res.json({
//       message: "Payment Voucher Created Successfully",
//       voucherId,
//       totalAmount
//     });

//   } catch (err) {
//     console.error("Payment Voucher Error:", err);
//     res.status(500).json({ message: "Error creating payment voucher" });
//   }
// };

// ------------------------------------------------------
// GET ALL VOUCHERS (SUMMARY)
// ------------------------------------------------------

export const createPaymentVoucher = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);

  const {
    voucherNo,
    date,
    accountType,
    narration,
    totalAmount,
    items
  } = req.body;

  if (!voucherNo || !date || !accountType || !items || items.length === 0) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const conn = await pool.getConnection();

  try {
    const isDuplicate = await checkVoucherNumberExists(companyId, "payment_vouchers", "voucherNo", voucherNo, creator);
    if (isDuplicate) {
      conn.release();
      return res.status(400).json({ message: "Voucher number already exists" });
    }

    await conn.beginTransaction();
    await ensureCreatorColumns(conn, "payment_vouchers");

    // Insert each item and update ledger closing balance
    for (let item of items) {
      const { ledgerId, amount } = item;

      // 1️⃣ Insert voucher row
      await conn.query(
        `
        INSERT INTO payment_vouchers
        (companyId, voucherNo, date, accountType, narration, totalAmount, ledgerId, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          companyId,
          voucherNo,
          date,
          accountType,
          narration,
          totalAmount,
          ledgerId,
          amount
        ]
      );

      // 2️⃣ Update the ledger closingBalance
      await conn.query(
        `
        UPDATE ledgers 
        SET closingBalance = closingBalance - ?
        WHERE id = ? AND companyId = ?
        `,
        [amount, ledgerId, companyId]
      );
    }
    await conn.query(
      `UPDATE payment_vouchers SET created_by_user_id = ?, created_by_employee_id = ? WHERE companyId = ? AND voucherNo = ?`,
      [creator.userId, creator.employeeId, companyId, voucherNo]
    );

    await conn.commit();

    // Pre-generate PDF for instant preview
    let pdfPath = "";
    try {
      const pdfItems = [];
      for (let item of items) {
        pdfItems.push({
          description: await getAccountName(item.ledgerId, companyId),
          amount: item.amount
        });
      }

      pdfPath = `uploads/payment/Payment_${voucherNo}_${Date.now()}.pdf`;

      const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [companyId]);
      const pdfData = {
        voucherNo: voucherNo,
        date: date,
        total: totalAmount,
        items: pdfItems,
        narration: narration,
        customer: await getAccountName(accountType, companyId),
        company: company || {}
      };

      await generatePaymentPDF(pdfData, pdfPath);
      await pool.query(
        `UPDATE payment_vouchers SET pdf_path = ? WHERE voucherNo = ? AND companyId = ?`,
        [pdfPath, voucherNo, companyId]
      );
    } catch (pdfErr) {
      console.error("Error generating PDF on createPaymentVoucher:", pdfErr);
    }

    res.status(200).json({
      message: "Payment voucher saved successfully and balances updated",
      pdf_path: pdfPath
    });

  } catch (error) {
    await conn.rollback();
    console.log("ERROR:", error);
    res.status(500).json({ message: "Failed to save voucher", error });
  } finally {
    conn.release();
  }
};

export const getAllPaymentVouchers = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.companyId, p.voucherNo, DATE_FORMAT(p.date, '%Y-%m-%d') AS date, p.accountType, p.narration, SUM(p.amount) AS amount, p.totalAmount, p.pdf_path, MAX(p.created_by_user_id) AS created_by_user_id, MAX(p.created_by_employee_id) AS created_by_employee_id, MAX(u.name) AS creator_name, MAX(eu.name) AS employee_name
       FROM payment_vouchers p
       LEFT JOIN users u ON p.created_by_user_id = u.id
         LEFT JOIN users eu ON p.created_by_employee_id = eu.employee_id
       WHERE p.companyId = ?
       GROUP BY IFNULL(NULLIF(p.voucherNo, ''), p.id)
       ORDER BY MAX(p.id) DESC`,
      [companyId]
    );

    res.json(rows.map((row) => ({
      ...row,
      accountType: normalizePaymentAccountType(row.accountType),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching vouchers" });
  }
};

// ------------------------------------------------------
// GET SINGLE VOUCHER (FULL DETAILS)
// ------------------------------------------------------
export const getPaymentVoucherById = async (req, res) => {
  const { voucherId } = req.params;

  try {
    const [[voucher]] = await pool.query(
      `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS formattedDate FROM payment_vouchers WHERE id = ?`,
      [voucherId]
    );

    if (!voucher) return res.status(404).json({ message: "Voucher not found" });

    const [entries] = await pool.query(
      `SELECT * FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
      [voucher.voucherNo, voucher.companyId]
    );

    res.json({

      ...voucher,
      date: voucher.formattedDate || voucher.date,
      formattedDate: undefined,

      accountType:
        normalizePaymentAccountType(
          voucher.accountType
        ),

      entries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching voucher details" });
  }
};

export const deletePaymentVoucher = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[voucher]] = await conn.query(
      `SELECT * FROM payment_vouchers WHERE id = ?`,
      [id]
    );

    if (!voucher) {
      conn.release();
      return res.status(404).json({ message: "Voucher not found" });
    }

    const { voucherNo, companyId } = voucher;

    if (voucherNo && voucherNo.trim() !== "") {
      const [entries] = await conn.query(
        `SELECT ledgerId, amount FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
        [voucherNo, companyId]
      );

      for (const entry of entries) {
        if (entry.ledgerId && entry.amount) {
          await conn.query(
            `UPDATE ledgers SET closingBalance = closingBalance + ? WHERE id = ? AND companyId = ?`,
            [entry.amount, entry.ledgerId, companyId]
          );
        }
      }

      await conn.query(
        `DELETE FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
        [voucherNo, companyId]
      );
    } else {
      if (voucher.ledgerId && voucher.amount) {
        await conn.query(
          `UPDATE ledgers SET closingBalance = closingBalance + ? WHERE id = ? AND companyId = ?`,
          [voucher.amount, voucher.ledgerId, companyId]
        );
      }
      await conn.query(
        `DELETE FROM payment_vouchers WHERE id = ?`,
        [id]
      );
    }

    await conn.commit();
    res.json({ message: "Payment Voucher deleted successfully and balances reverted" });

  } catch (error) {
    await conn.rollback();
    console.error("Delete Voucher Error:", error);
    res.status(500).json({ message: "Failed to delete voucher", error });
  } finally {
    conn.release();
  }
};

export const bulkDeletePaymentVouchers = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "Provide an array of voucher IDs to delete" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const id of ids) {
      const [[voucher]] = await conn.query(
        `SELECT * FROM payment_vouchers WHERE id = ?`,
        [id]
      );

      if (!voucher) continue;

      const { voucherNo, companyId } = voucher;

      if (voucherNo && voucherNo.trim() !== "") {
        const [entries] = await conn.query(
          `SELECT ledgerId, amount FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
          [voucherNo, companyId]
        );

        for (const entry of entries) {
          if (entry.ledgerId && entry.amount) {
            await conn.query(
              `UPDATE ledgers SET closingBalance = closingBalance + ? WHERE id = ? AND companyId = ?`,
              [entry.amount, entry.ledgerId, companyId]
            );
          }
        }

        await conn.query(
          `DELETE FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
          [voucherNo, companyId]
        );
      } else {
        if (voucher.ledgerId && voucher.amount) {
          await conn.query(
            `UPDATE ledgers SET closingBalance = closingBalance + ? WHERE id = ? AND companyId = ?`,
            [voucher.amount, voucher.ledgerId, companyId]
          );
        }
        await conn.query(
          `DELETE FROM payment_vouchers WHERE id = ?`,
          [id]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Bulk Payment Vouchers deleted successfully" });

  } catch (error) {
    await conn.rollback();
    console.error("Bulk Delete Voucher Error:", error);
    res.status(500).json({ message: "Failed to bulk delete vouchers", error });
  } finally {
    conn.release();
  }
};

export const updatePaymentVoucher = async (req, res) => {
  const { id } = req.params;
  const {
    voucherNo,
    date,
    accountType,
    narration,
    totalAmount,
    items,
    companyId
  } = req.body;

  if (!voucherNo || !date || !accountType || !items || items.length === 0) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const conn = await pool.getConnection();
  const creator = getCreatorFromRequest(req);

  try {
    const isDuplicate = await checkVoucherNumberExists(companyId, "payment_vouchers", "voucherNo", voucherNo, creator, id);
    if (isDuplicate) {
      conn.release();
      return res.status(400).json({ message: "Voucher number already exists" });
    }

    await conn.beginTransaction();

    const [[oldVoucher]] = await conn.query(
      `SELECT * FROM payment_vouchers WHERE id = ?`,
      [id]
    );

    if (!oldVoucher) {
      conn.release();
      return res.status(404).json({ message: "Voucher not found" });
    }

    const oldVoucherNo = oldVoucher.voucherNo;
    const activeCompanyId = oldVoucher.companyId || companyId;

    const [oldEntries] = await conn.query(
      `SELECT ledgerId, amount FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
      [oldVoucherNo, activeCompanyId]
    );

    for (const entry of oldEntries) {
      if (entry.ledgerId && entry.amount) {
        await conn.query(
          `UPDATE ledgers SET closingBalance = closingBalance + ? WHERE id = ? AND companyId = ?`,
          [entry.amount, entry.ledgerId, activeCompanyId]
        );
      }
    }

    await conn.query(
      `DELETE FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
      [oldVoucherNo, activeCompanyId]
    );

    for (let item of items) {
      const { ledgerId, amount } = item;

      await conn.query(
        `
        INSERT INTO payment_vouchers
        (companyId, voucherNo, date, accountType, narration, totalAmount, ledgerId, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          activeCompanyId,
          voucherNo,
          date,
          accountType,
          narration,
          totalAmount,
          ledgerId,
          amount
        ]
      );

      await conn.query(
        `
        UPDATE ledgers 
        SET closingBalance = closingBalance - ?
        WHERE id = ? AND companyId = ?
        `,
        [amount, ledgerId, activeCompanyId]
      );
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

      pdfPath = `uploads/payment/Payment_${voucherNo || id}_${Date.now()}.pdf`;

      const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [activeCompanyId]);
      const pdfData = {
        voucherNo: voucherNo || id,
        date: date,
        total: totalAmount,
        items: pdfItems,
        narration: narration,
        customer: await getAccountName(accountType, activeCompanyId),
        company: company || {}
      };

      await generatePaymentPDF(pdfData, pdfPath);
      await pool.query(
        `UPDATE payment_vouchers SET pdf_path = ? WHERE voucherNo = ? AND companyId = ?`,
        [pdfPath, voucherNo, activeCompanyId]
      );
    } catch (pdfErr) {
      console.error("Error generating PDF in updatePaymentVoucher:", pdfErr);
    }

    res.json({
      message: "Payment Voucher updated successfully and balances synchronized",
      pdf_path: pdfPath
    });

  } catch (error) {
    await conn.rollback();
    console.error("Update Voucher Error:", error);
    res.status(500).json({ message: "Failed to update voucher", error });
  } finally {
    conn.release();
  }
};

export const bulkCreatePaymentVoucher = async (req, res) => {
  const { companyId, vouchers } = req.body;
  const creator = getCreatorFromRequest(req);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await ensureCreatorColumns(conn, "payment_vouchers");

    for (const voucher of vouchers) {
      const {
        voucherNo,
        date,
        accountType,
        narration,
        totalAmount,
        items
      } = voucher;

      if (!items || items.length === 0) continue;

      for (let item of items) {
        const { ledgerId, amount } = item;

        await conn.query(
          `
          INSERT INTO payment_vouchers
          (companyId, voucherNo, date, accountType, narration, totalAmount, ledgerId, amount, created_by_user_id, created_by_employee_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            companyId,
            voucherNo,
            date,
            accountType,
            narration,
            totalAmount,
            ledgerId,
            amount,
            creator.userId,
            creator.employeeId
          ]
        );

        await conn.query(
          `
          UPDATE ledgers 
          SET closingBalance = closingBalance - ?
          WHERE id = ? AND companyId = ?
          `,
          [amount, ledgerId, companyId]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Bulk Payment Vouchers Created Successfully" });

  } catch (err) {
    await conn.rollback();
    console.error("BULK PAYMENT ERROR:", err);
    res.status(500).json({ message: "Error creating payment vouchers", error: err });
  } finally {
    conn.release();
  }
};

export const downloadPaymentVoucherPDF = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(`SELECT * FROM payment_vouchers WHERE id = ?`, [id]);
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });

    const [entries] = await pool.query(
      `SELECT * FROM payment_vouchers WHERE voucherNo = ? AND companyId = ?`,
      [voucher.voucherNo, voucher.companyId]
    );

    const items = [];
    for (let entry of entries) {
      items.push({
        description: await getAccountName(entry.ledgerId, voucher.companyId),
        amount: entry.amount
      });
    }

    const pdfPath = `uploads/payment/Payment_${voucher.voucherNo || id}_${Date.now()}.pdf`;

    const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [voucher.companyId]);
    const pdfData = {
      voucherNo: voucher.voucherNo || id,
      date: voucher.date,
      total: voucher.totalAmount,
      items,
      narration: voucher.narration,
      customer: await getAccountName(voucher.accountType, voucher.companyId),
      company: company || {}
    };

    await generatePaymentPDF(pdfData, pdfPath);
    await pool.query(
      `UPDATE payment_vouchers SET pdf_path = ? WHERE voucherNo = ? AND companyId = ?`,
      [pdfPath, voucher.voucherNo, voucher.companyId]
    );

    res.download(path.join(process.cwd(), pdfPath));
  } catch (error) {
    console.error("Error in downloadPaymentVoucherPDF:", error);
    res.status(500).json({ message: "Error generating PDF", error: error.message });
  }
};
