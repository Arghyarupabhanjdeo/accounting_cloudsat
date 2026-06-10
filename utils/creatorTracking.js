import jwt from "jsonwebtoken";

const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null && value !== "") ?? null;

export const getCreatorFromRequest = (req) => {
  if (req.user) {
    return {
      userId: pickFirst(req.user.id, req.user.user_id, req.user.userId),
      employeeId: pickFirst(req.user.employee_id, req.user.employeeId, req.user.employeeID),
    };
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : pickFirst(req.cookies?.token, req.cookies?.employeeToken);

  if (!token) {
    return { userId: null, employeeId: null };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      userId: pickFirst(decoded.id, decoded.user_id, decoded.userId),
      employeeId: pickFirst(decoded.employee_id, decoded.employeeId, decoded.employeeID),
    };
  } catch {
    // Fallback: Verify using the Main System's JWT Secret (if provided)
    if (process.env.MAIN_JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.MAIN_JWT_SECRET);
        return {
          userId: pickFirst(decoded.id, decoded.user_id, decoded.userId),
          employeeId: pickFirst(decoded.employee_id, decoded.employeeId, decoded.employeeID),
        };
      } catch {
        // Ignore secondary verify error
      }
    }
    
    // Insecure fallback: Decode without verifying if neither secret works
    try {
      const decoded = jwt.decode(token);
      if (decoded) {
        return {
          userId: pickFirst(decoded.id, decoded.user_id, decoded.userId),
          employeeId: pickFirst(decoded.employee_id, decoded.employeeId, decoded.employeeID),
        };
      }
    } catch {
      // Ignore inner decode error
    }
    return { userId: null, employeeId: null };
  }
};

const assertSafeTableName = (tableName) => {
  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    throw new Error(`Unsafe table name for creator tracking: ${tableName}`);
  }
};

export const ensureCreatorColumns = async (db, tableName) => {
  assertSafeTableName(tableName);
  await db.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS created_by_user_id INT DEFAULT NULL`).catch(() => {});
  await db.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS created_by_employee_id INT DEFAULT NULL`).catch(() => {});
};

export const ensureCreatorColumnsForTables = async (db, tableNames = []) => {
  for (const tableName of tableNames) {
    await ensureCreatorColumns(db, tableName);
  }
};
