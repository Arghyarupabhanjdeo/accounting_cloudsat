
import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

/* ================= CREATE INVOICE ================= */
export const createInvoice = async (req, res) => {
  const {
    invoice_no,
    customer,
    date,
    dueDate,
    items,
    subtotal,
    taxAmount,
    total,
    paidAmount,
    balance,
    status,
    paymentMethod,
    notes
  } = req.body;
  const creator = getCreatorFromRequest(req);

  try {
    await ensureCreatorColumns(pool, "invoices");

    const invoiceSql = `
      INSERT INTO invoices
      (invoice_no, customer_name, customer_email, customer_phone, customer_gstin,
       customer_address, invoice_date, due_date, subtotal, tax_amount, total,
       paid_amount, balance, status, payment_method, notes, created_by,
       created_by_user_id, created_by_employee_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const [result] = await pool.query(invoiceSql, [
      invoice_no,
      customer.name,
      customer.email,
      customer.phone,
      customer.gstin,
      customer.address,
      date,
      dueDate,
      subtotal,
      taxAmount,
      total,
      paidAmount,
      balance,
      status,
      paymentMethod,
      notes,
      creator.userId,
      creator.userId,
      creator.employeeId
    ]);

    const invoiceId = result.insertId;

    const itemSql = `
      INSERT INTO invoice_items
      (invoice_id, description, quantity, rate, tax_rate, amount)
      VALUES ?
    `;

    const itemValues = items.map(item => [
      invoiceId,
      item.description,
      item.quantity,
      item.rate,
      item.taxRate,
      item.amount
    ]);

    await pool.query(itemSql, [itemValues]);
    res.json({ message: "Invoice created successfully" });
  } catch (err) {
    res.status(500).json(err);
  }
};

/* ================= GET ALL INVOICES ================= */
export const getInvoices = (req, res) => {
  const sql = `SELECT * FROM invoices ORDER BY created_at DESC`;

  pool.query(sql, (err, invoices) => {
    if (err) return res.status(500).json(err);

    if (invoices.length === 0) return res.json([]);

    const ids = invoices.map(inv => inv.id);

    pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id IN (?)`,
      [ids],
      (err, items) => {
        if (err) return res.status(500).json(err);

        const data = invoices.map(inv => ({
          ...inv,
          items: items.filter(it => it.invoice_id === inv.id)
        }));

        res.json(data);
      }
    );
  });
};

/* ================= GET SINGLE INVOICE ================= */
export const getInvoiceById = (req, res) => {
  const { id } = req.params;

  pool.query(`SELECT * FROM invoices WHERE id=?`, [id], (err, inv) => {
    if (err) return res.status(500).json(err);
    if (!inv.length) return res.status(404).json({ message: "Not found" });

    pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id=?`,
      [id],
      (err, items) => {
        if (err) return res.status(500).json(err);
        res.json({ ...inv[0], items });
      }
    );
  });
};

/* ================= DELETE INVOICE ================= */
export const deleteInvoice = (req, res) => {
  pool.query(
    `DELETE FROM invoices WHERE id=?`,
    [req.params.id],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Invoice deleted" });
    }
  );
};
