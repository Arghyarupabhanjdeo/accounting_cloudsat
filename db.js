import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "test",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test DB connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(" Connected to MySQL Database");
    connection.release();
  } catch (error) {
    console.error(" MySQL Connection Failed:", error.message);
    process.exit(1);
  }
})();

export default pool;
