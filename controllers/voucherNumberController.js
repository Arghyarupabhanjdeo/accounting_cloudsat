import pool from "../db.js";
import { getCreatorFromRequest } from "../utils/creatorTracking.js";

export const getNextVoucherNumber = async (req, res) => {
  const { type, companyId } = req.query;
  const creator = getCreatorFromRequest(req);

  if (!type || !companyId) {
    return res.status(400).json({ error: "type and companyId are required" });
  }

  let tableName = "";
  let columnName = "";

  switch (type) {
    case "purchase":
      tableName = "purchase_vouchers";
      columnName = "invoiceNo";
      break;
    case "sales":
      tableName = "sales_vouchers";
      columnName = "invoiceNo";
      break;
    case "contra":
      tableName = "contra_vouchers";
      columnName = "voucherNo";
      break;
    case "journal":
      tableName = "journal_vouchers";
      columnName = "voucherNo";
      break;
    case "payment":
      tableName = "payment_vouchers";
      columnName = "voucherNo";
      break;
    case "receipt":
      tableName = "receive_vouchers";
      columnName = "voucherNo";
      break;
    case "credit_note":
    case "debit_note":
      tableName = "notes";
      columnName = "invoiceNo"; // or noteNo, need to check noteController
      break;
    default:
      return res.status(400).json({ error: "Invalid voucher type" });
  }

  // Adjust column name for notes based on what is used
  if (type === "credit_note" || type === "debit_note") {
    // Actually notes uses invoiceNo
    columnName = "invoiceNo";
  }

  try {
    let query = `
      SELECT ${columnName}
      FROM ${tableName}
      WHERE companyId = ?
    `;
    const params = [companyId];

    if (creator.employeeId) {
      query += ` AND created_by_employee_id = ?`;
      params.push(creator.employeeId);
    } else if (creator.userId) {
      query += ` AND created_by_user_id = ? AND (created_by_employee_id IS NULL OR created_by_employee_id = 0)`;
      params.push(creator.userId);
    }

    if (type === "credit_note") {
      query += ` AND type = 'Credit Note'`;
    } else if (type === "debit_note") {
      query += ` AND type = 'Debit Note'`;
    }

    const [rows] = await pool.query(query, params);

    let maxNum = 0;
    for (let row of rows) {
      const val = row[columnName];
      if (val) {
        // Extract numeric part from strings like "INV-001" or just "1"
        const numMatch = val.toString().match(/\d+$/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextNumber = maxNum + 1;
    res.json({ success: true, voucherNo: nextNumber.toString(), nextNumber: nextNumber.toString() });

  } catch (err) {
    console.error("Error generating next voucher number:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
