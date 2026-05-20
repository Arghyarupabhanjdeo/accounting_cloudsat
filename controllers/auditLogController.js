import pool from "../db.js";

export const logAction = async ({ company_id, action, entity_type, entity_id, old_value, new_value }) => {
  try {
    // Ensure audit_logs table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id INT NOT NULL,
        old_value JSON,
        new_value JSON,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(
      `INSERT INTO audit_logs (company_id, action, entity_type, entity_id, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        company_id,
        action,
        entity_type,
        entity_id,
        old_value ? JSON.stringify(old_value) : null,
        new_value ? JSON.stringify(new_value) : null
      ]
    );
  } catch (error) {
    console.error("AUDIT LOG ERROR:", error);
  }
};
