import pool from "../db.js";

const trackedResources = {
  ledgers: {
    label: "Ledger",
    table: "ledgers",
    title: ["name", "ledgerName"],
    number: ["aliasName", "alias"],
    amount: ["openingBalance", "closingBalance"],
    date: ["created_at", "createdAt", "updatedAt"],
    deletedFlag: "isDeleted",
  },
  stocks: {
    label: "Stock",
    table: "stocks",
    title: ["name"],
    number: ["hsn", "alias"],
    amount: ["openingBalanceValue", "openingBalanceQty"],
    date: ["created_at", "createdAt", "updatedAt"],
    deletedFlag: "isDeleted",
  },
  sales: {
    label: "Sales Voucher",
    table: "sales_vouchers",
    title: ["customer"],
    number: ["invoiceNo", "voucherNo"],
    amount: ["grand_total", "total"],
    date: ["created_at", "createdAt", "date"],
  },
  purchases: {
    label: "Purchase Voucher",
    table: "purchase_vouchers",
    title: ["customer"],
    number: ["invoiceNo", "voucherNo"],
    amount: ["grand_total", "total"],
    date: ["created_at", "createdAt", "date"],
  },
  contra: {
    label: "Contra Voucher",
    table: "contra_vouchers",
    title: ["narration"],
    number: ["voucherNo"],
    amount: ["total", "amount"],
    date: ["created_at", "createdAt", "date"],
  },
  payments: {
    label: "Payment Voucher",
    table: "payment_vouchers",
    title: ["customer", "ledger", "narration"],
    number: ["voucherNo"],
    amount: ["total", "amount"],
    date: ["created_at", "createdAt", "date"],
  },
  receipts: {
    label: "Receipt Voucher",
    table: "receive_vouchers",
    title: ["customer", "ledger", "narration"],
    number: ["voucherNo"],
    amount: ["total", "amount"],
    date: ["created_at", "createdAt", "date"],
  },
  journals: {
    label: "Journal Voucher",
    table: "journal_vouchers",
    title: ["narration"],
    number: ["voucherNo"],
    amount: ["totalDebit", "totalCredit", "total"],
    date: ["created_at", "createdAt", "date"],
  },
  manufacturing: {
    label: "Manufacturing Journal",
    table: "manufacturing_journal",
    title: ["productName", "narration"],
    number: ["voucherNo"],
    amount: ["grandTotal", "finishedQty"],
    date: ["created_at", "createdAt", "date"],
  },
};

const columnCache = new Map();

const getTableColumns = async (tableName) => {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  const [columns] = await pool.query(`SHOW COLUMNS FROM ${tableName}`);
  const names = new Set(columns.map((column) => column.Field));
  columnCache.set(tableName, names);
  return names;
};

const firstExistingColumn = (columns, candidates) => (
  candidates.find((candidate) => columns.has(candidate)) || null
);

const columnExpression = (alias, columnName, fallback = "NULL") => (
  columnName ? `${alias}.\`${columnName}\`` : fallback
);

const buildCoalesceExpression = (alias, columns, candidates, fallback = "NULL") => {
  const existing = candidates.filter((candidate) => columns.has(candidate));
  if (existing.length === 0) return fallback;
  return `COALESCE(${existing.map((column) => `${alias}.\`${column}\``).join(", ")}, ${fallback})`;
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const fetchResourceActivity = async (resourceKey, config, filters) => {
  const columns = await getTableColumns(config.table);

  if (!columns.has("created_by_user_id") && !columns.has("created_by_employee_id")) {
    return [];
  }

  const idExpr = columnExpression("t", firstExistingColumn(columns, ["id"]), "NULL");
  const companyExpr = columnExpression("t", firstExistingColumn(columns, ["companyId", "company_id"]), "NULL");
  const titleExpr = buildCoalesceExpression("t", columns, config.title, "''");
  const numberExpr = buildCoalesceExpression("t", columns, config.number, "''");
  const amountExpr = buildCoalesceExpression("t", columns, config.amount, "0");
  const dateColumn = firstExistingColumn(columns, config.date);
  const dateExpr = columnExpression("t", dateColumn, "NULL");
  const creatorUserExpr = columnExpression("t", columns.has("created_by_user_id") ? "created_by_user_id" : null, "NULL");
  const creatorEmployeeExpr = columnExpression("t", columns.has("created_by_employee_id") ? "created_by_employee_id" : null, "NULL");

  const where = [`(${creatorUserExpr} IS NOT NULL OR ${creatorEmployeeExpr} IS NOT NULL)`];
  const params = [];

  if (columns.has("companyId") && filters.companyId) {
    where.push("t.companyId = ?");
    params.push(filters.companyId);
  }

  if (columns.has("created_by_employee_id") && filters.employeeId) {
    where.push("t.created_by_employee_id = ?");
    params.push(filters.employeeId);
  }

  if (dateColumn && filters.from) {
    where.push(`${dateExpr} >= ?`);
    params.push(filters.from);
  }

  if (dateColumn && filters.to) {
    where.push(`${dateExpr} <= ?`);
    params.push(`${filters.to} 23:59:59`);
  }

  if (config.deletedFlag && columns.has(config.deletedFlag)) {
    where.push(`COALESCE(t.\`${config.deletedFlag}\`, 0) = 0`);
  }

  const sql = `
    SELECT
      '${resourceKey}' AS resource_key,
      '${config.label}' AS resource_label,
      ${idExpr} AS record_id,
      ${companyExpr} AS company_id,
      ${titleExpr} AS title,
      ${numberExpr} AS document_no,
      ${amountExpr} AS amount,
      ${dateExpr} AS activity_date,
      ${creatorUserExpr} AS created_by_user_id,
      ${creatorEmployeeExpr} AS created_by_employee_id,
      u.name AS creator_name,
      u.email AS creator_email,
      u.role AS creator_role,
      c.name AS company_name
    FROM ${config.table} t
    LEFT JOIN users u ON ${creatorUserExpr} = u.id
    LEFT JOIN companies c ON ${companyExpr} = c.id
    WHERE ${where.join(" AND ")}
    ORDER BY ${dateColumn ? `${dateExpr} DESC, ` : ""}${idExpr} DESC
    LIMIT ?
  `;

  const [rows] = await pool.query(sql, [...params, filters.limit]);
  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
    activity_date: normalizeDate(row.activity_date),
  }));
};

const buildSummary = (activity) => {
  const resourceCounts = {};
  const creatorMap = new Map();
  let totalAmount = 0;

  for (const item of activity) {
    resourceCounts[item.resource_key] = (resourceCounts[item.resource_key] || 0) + 1;
    totalAmount += toNumber(item.amount);

    const creatorKey = item.created_by_employee_id || `user:${item.created_by_user_id || "unknown"}`;
    const existing = creatorMap.get(creatorKey) || {
      key: creatorKey,
      employee_id: item.created_by_employee_id,
      user_id: item.created_by_user_id,
      name: item.creator_name || item.creator_email || "Unknown creator",
      email: item.creator_email,
      role: item.creator_role,
      count: 0,
      amount: 0,
    };

    existing.count += 1;
    existing.amount += toNumber(item.amount);
    creatorMap.set(creatorKey, existing);
  }

  return {
    totalRecords: activity.length,
    totalAmount,
    resourceCounts,
    creators: Array.from(creatorMap.values()).sort((a, b) => b.count - a.count),
  };
};

export const getSuperAdminAccountingActivity = async (req, res) => {
  try {
    const requestedType = req.query.type;
    const resourceEntries = Object.entries(trackedResources).filter(([key]) => (
      !requestedType || requestedType === "all" || requestedType === key
    ));

    const filters = {
      companyId: req.query.companyId || null,
      employeeId: req.query.employeeId || null,
      from: req.query.from || null,
      to: req.query.to || null,
      limit: Math.min(Number(req.query.limit) || 250, 1000),
    };

    const activityByResource = await Promise.all(
      resourceEntries.map(([key, config]) => fetchResourceActivity(key, config, filters))
    );

    const activity = activityByResource
      .flat()
      .sort((a, b) => {
        const dateA = a.activity_date ? new Date(a.activity_date).getTime() : 0;
        const dateB = b.activity_date ? new Date(b.activity_date).getTime() : 0;
        return dateB - dateA || Number(b.record_id || 0) - Number(a.record_id || 0);
      })
      .slice(0, filters.limit);

    res.json({
      success: true,
      filters,
      resources: Object.entries(trackedResources).map(([key, config]) => ({
        key,
        label: config.label,
      })),
      summary: buildSummary(activity),
      activity,
    });
  } catch (error) {
    console.error("SUPERADMIN ACCOUNTING ACTIVITY ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch accounting activity",
      error: error.message,
    });
  }
};
