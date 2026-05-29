import pool from "../db.js";
import fs from "fs";
import path from "path";
import { generateJournalVoucherPDF } from "../utils/journalVoucherPdfUtils.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

const getAccountName = async (ledgerId, companyId) => {
  if (!ledgerId) return "N/A";
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

// CREATE JOURNAL VOUCHER
export const createJournalVoucher = async (req, res) => {
  const { companyId } = req.params;
  const { date, narration, transactions } = req.body;
  const creator = getCreatorFromRequest(req);
  console.log(req.body);


  if (!transactions || transactions.length === 0) {
    return res.status(400).json({ message: "Transactions are required" });
  }

  const totalDebit = transactions.reduce(
    (sum, t) => sum + (parseFloat(t.debit) || 0),
    0
  );
  const totalCredit = transactions.reduce(
    (sum, t) => sum + (parseFloat(t.credit) || 0),
    0
  );

  // const ledgerIds = transactions.map(t => t.ledgerId);

  // Store ledger IDs as a comma-separated string to match DB column type
  const ledgerIds = transactions.map(t => t.ledgerId).join(',');

  // if (totalDebit !== totalCredit) {
  //   return res.status(400).json({
  //     message: "Debit and Credit totals must be equal",
  //   });
  // }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureCreatorColumns(connection, "journal_vouchers");

    // Insert into main voucher table
    const [voucherResult] = await connection.query(
      `INSERT INTO journal_vouchers 
      (companyId,ledgerId, date, narration, totalDebit, totalCredit)
      VALUES (?,?, ?, ?, ?, ?)`,
      [companyId, ledgerIds, date, narration, totalDebit, totalCredit]
    );

    const voucherId = voucherResult.insertId;
    await connection.query(
      `UPDATE journal_vouchers SET created_by_user_id = ?, created_by_employee_id = ? WHERE id = ?`,
      [creator.userId, creator.employeeId, voucherId]
    );

    // Insert each transaction row
    for (const t of transactions) {
   await connection.query(
  `INSERT INTO journal_transactions 
  (companyId, ledgerId, voucherId, particulars, debit, credit)
  VALUES (?, ?, ?, ?, ?, ?)`,
  [
    Number(companyId),
    Number(t.ledgerId),
    Number(voucherId),

    await getAccountName(
      t.ledgerId || t.particulars,
      companyId
    ),

    parseFloat(t.debit) || 0,
    parseFloat(t.credit) || 0,
  ]
);
    }

    await connection.commit();

    // Pre-generate PDF for instant preview
    let pdfPath = "";
    try {
      const pdfItems = [];
      for (const t of transactions) {
        pdfItems.push({
          description: await getAccountName(t.ledgerId || t.particulars, companyId),
          debit: t.debit,
          credit: t.credit
        });
      }

      pdfPath = `uploads/journal/Journal_${voucherId}_${Date.now()}.pdf`;

      const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [companyId]);
      const pdfData = {
        voucherNo: voucherId,
        date: date,
        items: pdfItems,
        totalDebit,
        totalCredit,
        narration: narration,
        company: company || {}
      };

      await generateJournalVoucherPDF(pdfData, pdfPath);
      await connection.query(
        `UPDATE journal_vouchers SET pdf_path = ? WHERE id = ?`,
        [pdfPath, voucherId]
      );
    } catch (pdfErr) {
      console.error("Error generating PDF on createJournalVoucher:", pdfErr);
    }

    connection.release();

    res.status(201).json({
      message: "Journal Voucher created successfully",
      voucherId,
      pdf_path: pdfPath
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

export const getNextJournalVoucherNumber = async (req, res) => {
  try {

    const [[result]] = await pool.query(`
      SELECT AUTO_INCREMENT as nextId
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'journal_vouchers'
    `);

    res.json({
      success: true,
      voucherNo: result?.nextId || 1
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch next voucher number"
    });
  }
};


export const getJournalVouchers = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM journal_vouchers WHERE companyId=? ORDER BY id DESC`,
      [companyId]
    );

    res.json(rows);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};
export const getJournalVoucherById = async (req, res) => {
  const { id } = req.params;

  try {
    const [[voucher]] = await pool.query(
      `SELECT * FROM journal_vouchers WHERE id=?`,
      [id]
    );

    const [transactions] = await pool.query(
      `SELECT * FROM journal_transactions WHERE voucherId=?`,
      [id]
    );

    res.json({ voucher, transactions });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};

export const bulkCreateJournalVoucher = async (req, res) => {
  const { companyId, vouchers } = req.body;
  const creator = getCreatorFromRequest(req);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureCreatorColumns(connection, "journal_vouchers");

    for (const voucher of vouchers) {
      const { date, narration, transactions } = voucher;

      if (!transactions || transactions.length === 0) continue;

      const totalDebit = transactions.reduce(
        (sum, t) => sum + (parseFloat(t.debit) || 0),
        0
      );
      const totalCredit = transactions.reduce(
        (sum, t) => sum + (parseFloat(t.credit) || 0),
        0
      );

      const ledgerIds = transactions.map(t => t.ledgerId).join(','); // Assuming simplistic storage for now or mimicking existing behavior

      // Insert into main voucher table
      const [voucherResult] = await connection.query(
        `INSERT INTO journal_vouchers 
        (companyId, ledgerId, date, narration, totalDebit, totalCredit, created_by_user_id, created_by_employee_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, ledgerIds, date, narration, totalDebit, totalCredit, creator.userId, creator.employeeId]
      );

      const voucherId = voucherResult.insertId;

      // Insert each transaction row
      for (const t of transactions) {
      await connection.query(
  `INSERT INTO journal_transactions 
  (companyId, ledgerId, voucherId, particulars, debit, credit)
  VALUES (?, ?, ?, ?, ?, ?)`,
  [
    Number(companyId),
    Number(t.ledgerId),
    Number(voucherId),

    await getAccountName(
      t.ledgerId || t.particulars,
      companyId
    ),

    parseFloat(t.debit) || 0,
    parseFloat(t.credit) || 0,
  ]
);
      }
    }

    await connection.commit();
    res.status(201).json({
      message: "Bulk Journal Vouchers created successfully",
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  } finally {
    connection.release();
  }
};

// UPDATE JOURNAL VOUCHER
export const updateJournalVoucher = async (req, res) => {

const { id } = req.params;

const {
date,
narration,
transactions
} = req.body;

if (!transactions || transactions.length === 0) {
return res.status(400).json({
message: "Transactions are required"
});
}

const totalDebit = transactions.reduce(
(sum, t) =>
sum + (parseFloat(t.debit) || 0),
0
);

const totalCredit = transactions.reduce(
(sum, t) =>
sum + (parseFloat(t.credit) || 0),
0
);

const ledgerIds = transactions
.map((t) => t.ledgerId || t.particulars)
.join(",");

const connection =
await pool.getConnection();

try {


await connection.beginTransaction();

// Check voucher exists
const [[voucher]] =
  await connection.query(
    `
    SELECT *
    FROM journal_vouchers
    WHERE id = ?
    `,
    [id]
  );

if (!voucher) {

  await connection.rollback();
  connection.release();

  return res.status(404).json({
    message:
      "Journal Voucher not found"
  });
}

// Update voucher
await connection.query(
  `
  UPDATE journal_vouchers
  SET
    ledgerId = ?,
    date = ?,
    narration = ?,
    totalDebit = ?,
    totalCredit = ?
  WHERE id = ?
  `,
  [
    ledgerIds,
    date,
    narration,
    totalDebit,
    totalCredit,
    id
  ]
);

// Delete old transactions
await connection.query(
  `
  DELETE FROM journal_transactions
  WHERE voucherId = ?
  `,
  [id]
);

// Insert updated transactions
for (const t of transactions) {

  const particulars =
    await getAccountName(
      t.ledgerId || t.particulars,
      voucher.companyId
    );

  await connection.query(
    `
    INSERT INTO journal_transactions
    (
      companyId,
      ledgerId,
      voucherId,
      particulars,
      debit,
      credit
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      Number(voucher.companyId),
      Number(t.ledgerId),
      Number(id),
      particulars,
      parseFloat(t.debit) || 0,
      parseFloat(t.credit) || 0
    ]
  );
}

await connection.commit();

// Generate PDF
let pdfPath = "";

try {

  const pdfItems = [];

  for (const t of transactions) {

    pdfItems.push({
      description:
        await getAccountName(
          t.ledgerId || t.particulars,
          voucher.companyId
        ),
      debit: t.debit,
      credit: t.credit
    });
  }

  pdfPath =
    `uploads/journal/Journal_${id}_${Date.now()}.pdf`;

  const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [voucher.companyId]);
  const pdfData = {
    voucherNo: id,
    date,
    items: pdfItems,
    totalDebit,
    totalCredit,
    narration,
    company: company || {}
  };

  await generateJournalVoucherPDF(
    pdfData,
    pdfPath
  );

  await connection.query(
    `
    UPDATE journal_vouchers
    SET pdf_path = ?
    WHERE id = ?
    `,
    [pdfPath, id]
  );

} catch (pdfErr) {

  console.error(
    "PDF Generation Error:",
    pdfErr
  );
}

res.json({
  success: true,
  message:
    "Journal Voucher updated successfully",
  pdf_path: pdfPath
});
```

} catch (error) {

```
await connection.rollback();

console.error(error);

res.status(500).json({
  message: "Server Error",
  error: error.message
});


} finally {


connection.release();


}
};


// DELETE JOURNAL VOUCHER
export const deleteJournalVoucher = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if voucher exists
    const [[voucher]] = await connection.query(
      `SELECT * FROM journal_vouchers WHERE id=?`,
      [id]
    );

    if (!voucher) {
      connection.release();
      return res.status(404).json({ message: "Journal Voucher not found" });
    }

    // Delete transactions associated with this voucher
    await connection.query(
      `DELETE FROM journal_transactions WHERE voucherId=?`,
      [id]
    );

    // Delete the voucher itself
    await connection.query(
      `DELETE FROM journal_vouchers WHERE id=?`,
      [id]
    );

    await connection.commit();
    res.json({ message: "Journal Voucher deleted successfully" });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Server Error", error });
  } finally {
    connection.release();
  }
};

export const downloadJournalVoucherPDF = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(
      `SELECT * FROM journal_vouchers WHERE id=?`,
      [id]
    );

    if (!voucher) {
      return res.status(404).json({ message: "Journal Voucher not found" });
    }

    const [transactions] = await pool.query(
      `SELECT * FROM journal_transactions WHERE voucherId=?`,
      [id]
    );

    const pdfItems = [];
    for (const t of transactions) {
      pdfItems.push({
        description: await getAccountName(t.particulars, voucher.companyId),
        debit: t.debit,
        credit: t.credit
      });
    }

    const pdfPath = `uploads/journal/Journal_${id}_${Date.now()}.pdf`;

    const [[company]] = await pool.query("SELECT * FROM companies WHERE id = ?", [voucher.companyId]);
    const pdfData = {
      voucherNo: id,
      date: voucher.date,
      items: pdfItems,
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
      narration: voucher.narration,
      company: company || {}
    };

    await generateJournalVoucherPDF(pdfData, pdfPath);
    await pool.query(
      `UPDATE journal_vouchers SET pdf_path = ? WHERE id = ?`,
      [pdfPath, id]
    );

    res.download(path.join(process.cwd(), pdfPath));
  } catch (error) {
    console.error("Error in downloadJournalVoucherPDF:", error);
    res.status(500).json({ message: "Error generating PDF", error: error.message });
  }
};
