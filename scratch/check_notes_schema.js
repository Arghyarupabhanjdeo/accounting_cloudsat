import pool from "../db.js";

async function checkSchema() {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM notes");
    console.log("Notes Table Columns:");
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'nullable' : 'non-null'})`);
    });
    process.exit(0);
  } catch (error) {
    console.error("Error checking schema:", error);
    process.exit(1);
  }
}

checkSchema();
