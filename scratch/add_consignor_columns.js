import pool from "../db.js";

async function main() {
  try {
    const columnsToAdd = [
      "consignorName VARCHAR(255) NULL",
      "consignorGSTIN VARCHAR(50) NULL",
      "consignorState VARCHAR(100) NULL",
      "consignorPincode VARCHAR(20) NULL",
      "consignorAddress TEXT NULL",
      "consignorEmail VARCHAR(255) NULL"
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
    console.log("Database update complete.");
    process.exit(0);
  } catch (error) {
    console.error("Error updating database:", error);
    process.exit(1);
  }
}

main();
