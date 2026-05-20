import pool from "../db.js";

async function main() {
  try {
    const columnsToAdd = [
      "igst_rate DECIMAL(10,2) DEFAULT 0.00",
      "cgst_rate DECIMAL(10,2) DEFAULT 0.00",
      "sgst_rate DECIMAL(10,2) DEFAULT 0.00",
      "carrierName VARCHAR(255) NULL"
    ];

    for (const col of columnsToAdd) {
      const colName = col.split(" ")[0];
      const [exists] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_NAME = 'purchase_vouchers' AND COLUMN_NAME = ?`,
         [colName]
      );

      if (exists.length === 0) {
        console.log(`Adding column ${colName}...`);
        await pool.query(`ALTER TABLE purchase_vouchers ADD COLUMN ${col}`);
      } else {
        console.log(`Column ${colName} already exists.`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

main();
