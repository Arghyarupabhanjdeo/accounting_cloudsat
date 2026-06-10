import pool from "../db.js";

export const checkVoucherNumberExists = async (companyId, tableName, columnName, numberToCheck, creator, excludeId = null, extraCondition = null) => {
  if (!numberToCheck) return false;

  let query = `SELECT id FROM ${tableName} WHERE companyId = ? AND ${columnName} = ?`;
  const params = [companyId, numberToCheck];

  if (creator.employeeId) {
    query += ` AND created_by_employee_id = ?`;
    params.push(creator.employeeId);
  } else if (creator.userId) {
    query += ` AND created_by_user_id = ? AND (created_by_employee_id IS NULL OR created_by_employee_id = 0)`;
    params.push(creator.userId);
  }

  if (excludeId) {
    query += ` AND id != ?`;
    params.push(excludeId);
  }

  if (extraCondition) {
    query += ` AND ${extraCondition.key} = ?`;
    params.push(extraCondition.value);
  }

  const [rows] = await pool.query(query, params);
  return rows.length > 0;
};
