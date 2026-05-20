import pool from "../db.js";

async function main() {
  try {
    const tables = ["payment_vouchers", "receive_vouchers", "journal_vouchers"];
    for (const table of tables) {
      const [columns] = await pool.query(`SHOW COLUMNS FROM ${table}`);
      const hasPdfPath = columns.some(col => col.Field === "pdf_path");
      console.log(`Table ${table} has pdf_path:`, hasPdfPath);
      if (!hasPdfPath) {
        console.log(`Adding pdf_path column to ${table}...`);
        await pool.query(`ALTER TABLE ${table} ADD COLUMN pdf_path VARCHAR(255) NULL`);
        console.log(`Successfully added pdf_path to ${table}.`);
      }
    }
  } catch (error) {
    console.error("Error in check_and_add_columns:", error);
  } finally {
    await pool.end();
  }
}

main();
