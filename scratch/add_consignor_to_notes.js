import pool from "../db.js";

async function addColumns() {
  try {
    const columnsToAdd = [
      { name: "consignorName", type: "VARCHAR(255) NULL" },
      { name: "consignorGSTIN", type: "VARCHAR(20) NULL" },
      { name: "consignorState", type: "VARCHAR(100) NULL" },
      { name: "consignorPincode", type: "VARCHAR(20) NULL" },
      { name: "consignorAddress", type: "TEXT NULL" },
      { name: "consignorEmail", type: "VARCHAR(255) NULL" }
    ];

    const [columns] = await pool.query("SHOW COLUMNS FROM notes");
    const existingColumns = columns.map(c => c.Field);

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        console.log(`Adding column ${col.name}...`);
        await pool.query(`ALTER TABLE notes ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Column ${col.name} added successfully!`);
      } else {
        console.log(`Column ${col.name} already exists.`);
      }
    }
    console.log("Database migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

addColumns();
