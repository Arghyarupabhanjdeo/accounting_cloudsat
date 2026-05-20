import pool from "../db.js";

async function main() {
  try {
    const [compCols] = await pool.query("DESCRIBE companies");
    console.log("=== companies columns ===");
    console.log(compCols.map(c => c.Field).join(", "));

    const [noteCols] = await pool.query("DESCRIBE notes");
    console.log("\n=== notes columns ===");
    console.log(noteCols.map(c => c.Field).join(", "));
  } catch (error) {
    console.error("Error describing tables:", error);
  } finally {
    process.exit(0);
  }
}

main();
