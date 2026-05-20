import pool from "../db.js";

async function main() {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM purchase_vouchers");
    console.log("Columns of purchase_vouchers:");
    console.log(columns.map(c => `${c.Field} (${c.Type})`).join("\n"));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

main();
