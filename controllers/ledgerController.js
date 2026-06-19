// import pool from "../db.js";

// export const createLedger = async (req, res) => {
//   try {
//     const {
//       name,
//       alias,
//       under,
//       openingBalance,
//       type,
//       mailingName,
//       address,
//       state,
//       country,
//       pincode,
//       provideBankDetails,
//       pan,
//       registrationType,
//       gstin,
//       alterGst,
//       bankDetails,
//     } = req.body;

//     // ✅ Insert Ledger
//     const [ledgerResult] = await pool.query(
//       `INSERT INTO ledgers 
//       (name, aliasName, underGroup, openingBalance, balanceType, mailingName, 
//       address, state, country, pincode, haveBankDetails, pan, registrationType, 
//       gstin, alterGstDetails)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         name,
//         alias,
//         under,
//         openingBalance,
//         type,
//         mailingName,
//         address,
//         state,
//         country,
//         pincode,
//         provideBankDetails,
//         pan,
//         registrationType,
//         gstin,
//         alterGst,
//       ]
//     );

//     const ledgerId = ledgerResult.insertId;

//     // ✅ Insert Bank Details if provided
//     if (provideBankDetails === "Yes" && bankDetails) {
//       const { bankName, branch, accountNumber, ifsc } = bankDetails;

//       await pool.query(
//         `INSERT INTO bank_details (ledgerId, bankName, branch, accountNumber, ifsc)
//         VALUES (?, ?, ?, ?, ?)`,
//         [ledgerId, bankName, branch, accountNumber, ifsc]
//       );
//     }

//     res.json({ success: true, message: "Ledger created successfully" });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// //  GET ALL LEDGERS
// export const getLedgers = async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       `SELECT l.*, b.bankName, b.branch, b.accountNumber, b.ifsc
//        FROM ledgers l
//        LEFT JOIN bank_details b ON l.id = b.ledgerId`
//     );

//     res.json(rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// //  GET SINGLE LEDGER
// export const getLedgerById = async (req, res) => {
//   try {
//     const [ledger] = await pool.query(
//       `SELECT * FROM ledgers WHERE id = ?`,
//       [req.params.id]
//     );

//     const [bank] = await pool.query(
//       `SELECT * FROM bank_details WHERE ledgerId = ?`,
//       [req.params.id]
//     );

//     res.json({ ...ledger[0], bankDetails: bank[0] || null });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// //  DELETE LEDGER
// export const deleteLedger = async (req, res) => {
//   try {
//     await pool.query("DELETE FROM ledgers WHERE id = ?", [req.params.id]);
//     res.json({ success: true, message: "Ledger deleted" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };


import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

// ✅ Create Ledger (Company Based)
export const createLedger = async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log(companyId);
    
    const {
      name,
      alias,
      under,
      openingBalance,
      type,
      mailingName,
      address,
      state,
      country,
      pincode,
      provideBankDetails,
      pan,
      registrationType,
      gstin,
      alterGst,
      bankDetails,
    } = req.body;
console.log(req.body);
    const creator = getCreatorFromRequest(req);
    await ensureCreatorColumns(pool, "ledgers");

         let parsedUnder = JSON.parse(under);

           let underGroup = parsedUnder.name;  // GROUP1
          let groupId = parsedUnder.id;       // 3

    // ✅ Insert Ledger
    const [ledgerResult] = await pool.query(
      `INSERT INTO ledgers 
      (companyId,groupId, name, aliasName, underGroup, openingBalance, balanceType, mailingName, 
      address, state, country, pincode, haveBankDetails, pan, registrationType, 
      gstin, alterGstDetails, created_by_user_id, created_by_employee_id)
      VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        groupId,
        name,
        alias,
        underGroup,
        openingBalance,
        type,
        mailingName,
        address,
        state,
        country,
        pincode,
        provideBankDetails,
        pan,
        registrationType,
        gstin,
        alterGst,
        creator.userId,
        creator.employeeId,
      ]
    );

    const ledgerId = ledgerResult.insertId;

    // ✅ Insert Bank Details if provided
    if (provideBankDetails === "Yes" && bankDetails) {
      const { bankName, branch, accountNumber, ifsc } = bankDetails;

      await pool.query(
        `INSERT INTO bank_details (ledgerId, companyId, bankName, branch, accountNumber, ifsc)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [ledgerId, companyId, bankName, branch, accountNumber, ifsc]
      );
    }

    res.json({ success: true, message: "Ledger created successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ Get All Ledgers for a Company
export const getLedgers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const creator = getCreatorFromRequest(req);

    let query = `SELECT l.*, b.bankName, b.branch, b.accountNumber, b.ifsc,
              u.name AS created_by_name,
              u.email AS created_by_email,
              u.role AS created_by_role,
              u.employee_id AS creator_employee_id,
              (
                SELECT COALESCE(SUM(debit), 0) FROM voucher_transactions WHERE ledgerId = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'Contra' AND toLedger = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'journal' AND fromLedger = l.id AND companyId = l.companyId
              ) AS computed_total_debit,
              (
                SELECT COALESCE(SUM(credit), 0) FROM voucher_transactions WHERE ledgerId = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'Contra' AND fromLedger = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'journal' AND toLedger = l.id AND companyId = l.companyId
              ) AS computed_total_credit
       FROM ledgers l
       LEFT JOIN bank_details b 
       ON l.id = b.ledgerId AND b.companyId = ?
       LEFT JOIN users u
       ON l.created_by_user_id = u.id
       WHERE l.companyId = ?`;
    const params = [companyId, companyId];

    if (creator.employeeId) {
      query += ` AND l.created_by_employee_id = ?`;
      params.push(creator.employeeId);
    } else if (creator.userId) {
      query += ` AND l.created_by_user_id = ? AND (l.created_by_employee_id IS NULL OR l.created_by_employee_id = 0)`;
      params.push(creator.userId);
    }

    query += ` ORDER BY l.id DESC`;

    const [rows] = await pool.query(query, params);

    // Compute dynamic closing balances
    const enhancedRows = rows.map(r => {
      const open = parseFloat(r.openingBalance) || 0;
      const dr = parseFloat(r.computed_total_debit) || 0;
      const cr = parseFloat(r.computed_total_credit) || 0;
      let closing = 0;
      if (r.balanceType === "Debit") {
        closing = open + dr - cr;
      } else {
        closing = open + cr - dr;
      }
      return { ...r, debit: dr, credit: cr, closingBalance: closing };
    });

    res.json(enhancedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get Single Ledger for Company
export const getLedgerById = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const [ledger] = await pool.query(
      `SELECT l.*,
              u.name AS created_by_name,
              u.email AS created_by_email,
              u.role AS created_by_role,
              u.employee_id AS creator_employee_id,
              (
                SELECT COALESCE(SUM(debit), 0) FROM voucher_transactions WHERE ledgerId = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'Contra' AND toLedger = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'journal' AND fromLedger = l.id AND companyId = l.companyId
              ) AS computed_total_debit,
              (
                SELECT COALESCE(SUM(credit), 0) FROM voucher_transactions WHERE ledgerId = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'Contra' AND fromLedger = l.id AND companyId = l.companyId
              ) + (
                SELECT COALESCE(SUM(amount), 0) FROM voucher_transactions WHERE voucherType = 'journal' AND toLedger = l.id AND companyId = l.companyId
              ) AS computed_total_credit
       FROM ledgers l
       LEFT JOIN users u
       ON l.created_by_user_id = u.id
       WHERE l.id = ? AND (l.companyId = ? OR l.companyId IS NULL)`,
      [id, companyId]
    );

    const [bank] = await pool.query(
      `SELECT * FROM bank_details WHERE ledgerId = ? AND (companyId = ? OR companyId IS NULL)`,
      [id, companyId]
    );

    let enhancedLedger = ledger[0];
    if (enhancedLedger) {
      const open = parseFloat(enhancedLedger.openingBalance) || 0;
      const dr = parseFloat(enhancedLedger.computed_total_debit) || 0;
      const cr = parseFloat(enhancedLedger.computed_total_credit) || 0;
      let closing = 0;
      if (enhancedLedger.balanceType === "Debit") {
        closing = open + dr - cr;
      } else {
        closing = open + cr - dr;
      }
      enhancedLedger = { ...enhancedLedger, debit: dr, credit: cr, closingBalance: closing };
    }

    res.json({ ...enhancedLedger, bankDetails: bank[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete Ledger (Company Based)
export const deleteLedger = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    // ✅ Delete bank details for that company-ledger
    await pool.query(
      "DELETE FROM bank_details WHERE ledgerId = ? AND companyId = ?",
      [id, companyId]
    );

    // ✅ Delete ledger itself
    await pool.query(
      "DELETE FROM ledgers WHERE id = ? AND companyId = ?",
      [id, companyId]
    );

    res.json({ success: true, message: "Ledger deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateLedger = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const {
      name,
      alias,
      under,
      openingBalance,
      type, // Debit / Credit
      mailingName,
      address,
      state,
      country,
      pincode,
      provideBankDetails,
      pan,
      registrationType,
      gstin,
      alterGst,
      bankDetails
    } = req.body;

    // --------------------------
    //   PRESERVE DEBIT, CREDIT & GROUP ID
    // --------------------------
    const [existing] = await pool.query(
      `SELECT debit, credit, groupId, underGroup FROM ledgers WHERE id = ? AND (companyId = ? OR companyId IS NULL)`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Ledger not found" });
    }

    const existingDebit = parseFloat(existing[0].debit || 0);
    const existingCredit = parseFloat(existing[0].credit || 0);
    const existingGroupId = existing[0].groupId;
    const existingUnderGroup = existing[0].underGroup;

    // Parse the under group parameter (which might be a JSON string from frontend)
    let underGroup = existingUnderGroup;
    let groupId = existingGroupId;

    if (under) {
      try {
        const parsedUnder = JSON.parse(under);
        underGroup = parsedUnder.name || under;
        groupId = parsedUnder.id || null;
      } catch (err) {
        underGroup = under;
      }
    }

    const open = parseFloat(openingBalance) || 0;
    const dr = req.body.debit !== undefined ? parseFloat(req.body.debit) : existingDebit;
    const cr = req.body.credit !== undefined ? parseFloat(req.body.credit) : existingCredit;

    let closingBalance = 0;
    if (type === "Debit") {
      closingBalance = open + dr - cr;
    } else {
      closingBalance = open - dr + cr;
    }

    // --------------------------
    //   UPDATE LEDGER TABLE
    // --------------------------
    await pool.query(
      `UPDATE ledgers 
       SET name = ?, 
           aliasName = ?, 
           groupId = ?,
           underGroup = ?, 
           openingBalance = ?, 
           balanceType = ?, 
           mailingName = ?, 
           address = ?, 
           state = ?, 
           country = ?, 
           pincode = ?, 
           haveBankDetails = ?, 
           pan = ?, 
           registrationType = ?, 
           gstin = ?, 
           alterGstDetails = ?,
           debit = ?,     
           credit = ?,    
           closingBalance = ?
       WHERE id = ? AND (companyId = ? OR companyId IS NULL)`,
      [
        name,
        alias,
        groupId,
        underGroup,
        open,
        type,
        mailingName,
        address,
        state,
        country,
        pincode,
        provideBankDetails,
        pan,
        registrationType,
        gstin,
        alterGst,
        dr,
        cr,
        closingBalance,
        id,
        companyId,
      ]
    );

    // --------------------------
    //   INSERT HISTORY ENTRY
    // --------------------------
    await pool.query(
      `INSERT INTO ledger_history (
          ledgerId, companyId, openingBalance, debit, credit, closingBalance
        )
        VALUES (?, ?, ?, ?, ?, ?)`,
      [id, companyId, open, dr, cr, closingBalance]
    );

    // --------------------------
    //   BANK DETAILS HANDLING
    // --------------------------
    if (provideBankDetails === "Yes") {
      const { bankName, branch, accountNumber, ifsc } = bankDetails || {};

      const [exist] = await pool.query(
        `SELECT id FROM bank_details WHERE ledgerId=? AND companyId=?`,
        [id, companyId]
      );

      if (exist.length > 0) {
        await pool.query(
          `UPDATE bank_details 
           SET bankName=?, branch=?, accountNumber=?, ifsc=?
           WHERE ledgerId=? AND companyId=?`,
          [bankName, branch, accountNumber, ifsc, id, companyId]
        );
      } else {
        await pool.query(
          `INSERT INTO bank_details 
           (ledgerId, companyId, bankName, branch, accountNumber, ifsc)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, companyId, bankName, branch, accountNumber, ifsc]
        );
      }
    } else {
      await pool.query(
        `DELETE FROM bank_details WHERE ledgerId=? AND companyId=?`,
        [id, companyId]
      );
    }

    res.json({
      success: true,
      message: "Ledger updated successfully",
      closingBalance,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: error.message });
  }
};


export const updateLedgerHistory = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT h.*, l.name AS ledgerName
       FROM ledger_history h
       LEFT JOIN ledgers l ON h.ledgerId = l.id
       WHERE h.companyId = ?
       ORDER BY h.id DESC`,
      [companyId]
    );

    res.json({
      success: true,
     rows,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: error.message });
  }
};
