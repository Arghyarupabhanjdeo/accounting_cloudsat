import jwt from "jsonwebtoken";

export const getCreatorFromRequest = (req) => {
  const bodyUserId = req.body.created_by_user_id ?? req.body.createdByUserId ?? null;
  const bodyEmployeeId = req.body.created_by_employee_id ?? req.body.createdByEmployeeId ?? null;

  if (bodyUserId || bodyEmployeeId) {
    return {
      userId: bodyUserId || null,
      employeeId: bodyEmployeeId || null,
    };
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;

  if (!token) {
    return { userId: null, employeeId: null };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      userId: decoded.id || null,
      employeeId: decoded.employee_id || null,
    };
  } catch {
    return { userId: null, employeeId: null };
  }
};

export const ensureCreatorColumns = async (db, tableName) => {
  await db.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS created_by_user_id INT DEFAULT NULL`).catch(() => {});
  await db.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS created_by_employee_id INT DEFAULT NULL`).catch(() => {});
};
