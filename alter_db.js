import pool from "./db.js";

async function alterTable() {
  try {
    const conn = await pool.getConnection();
    // Add 'per' column if it doesn't exist
    await conn.query("ALTER TABLE purchase_voucher_items ADD COLUMN per VARCHAR(50) DEFAULT 'Nos'");
    console.log("Column 'per' added successfully to purchase_voucher_items.");
    conn.release();
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column 'per' already exists in purchase_voucher_items.");
    } else {
      console.error(err);
    }
  }
  process.exit(0);
}

alterTable();
