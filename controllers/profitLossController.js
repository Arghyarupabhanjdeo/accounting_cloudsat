import pool from "../db.js";


export const getProfitLoss = async (req, res) => {
  const { companyId } = req.params;
  const qFrom = req.query.from;
  const qTo = req.query.to;

  // default period
  const today = new Date();
  const defaultTo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setFullYear(defaultTo.getFullYear() - 1);

  const from = qFrom ? new Date(qFrom) : defaultFrom;
  const to = qTo ? new Date(qTo) : defaultTo;

  const formatDateSQL = (d) => d.toISOString().slice(0, 10);

  try {
    // 1) Load all ledgers
    const [ledgers] = await pool.query(
      `SELECT l.id AS ledgerId,
              l.name AS ledgerName,
              l.openingBalance,
              l.balanceType AS balanceType,
              l.underGroup AS underGroupRaw,
              g.id AS groupId,
              g.groupName AS groupName,
              g.nature AS groupCategory
       FROM ledgers l
       LEFT JOIN groups g ON (g.id = l.underGroup OR g.groupName = l.underGroup)
       WHERE l.companyId = ?`,
      [companyId]
    );

    if (!ledgers || ledgers.length === 0) {
      return res.json({
        success: true,
        income: [],
        expenses: [],
        totals: { totalIncome: 0, totalExpenses: 0, net: 0 },
      });
    }

    const ledgerIds = ledgers.map((l) => l.ledgerId);
    const inClause = ledgerIds.length ? ledgerIds : [0];

    const fromSQL = formatDateSQL(from);
    const toSQL = formatDateSQL(to);

    // 2) Aggregates

    // Payment
    const [paymentAgg] = await pool.query(
      `SELECT pve.ledger AS ledgerId,
              SUM(COALESCE(pve.debit,0)) AS debit_sum,
              SUM(COALESCE(pve.credit,0)) AS credit_sum
       FROM payment_voucher_entries pve
       JOIN payment_vouchers pv ON pv.id = pve.voucherId
       WHERE pv.companyId = ? AND pv.date BETWEEN ? AND ?
         AND pve.ledger IN (?)
       GROUP BY pve.ledger`,
      [companyId, fromSQL, toSQL, inClause]
    );

    // Journal
    const [journalAgg] = await pool.query(
      `SELECT jt.particulars AS ledgerId,
              SUM(COALESCE(jt.debit,0)) AS debit_sum,
              SUM(COALESCE(jt.credit,0)) AS credit_sum
       FROM journal_transactions jt
       JOIN journal_vouchers jv ON jv.id = jt.voucherId
       WHERE jv.companyId = ? AND jv.date BETWEEN ? AND ?
         AND jt.particulars IN (?)
       GROUP BY jt.particulars`,
      [companyId, fromSQL, toSQL, inClause]
    );

    // Contra
    const [contraFrom] = await pool.query(
      `SELECT ct.fromAccount AS ledgerId, SUM(COALESCE(ct.amount,0)) AS credit_sum
       FROM contra_transactions ct
       JOIN contra_vouchers cv ON cv.id = ct.voucherId
       WHERE cv.companyId = ? AND cv.date BETWEEN ? AND ?
         AND ct.fromAccount IN (?)
       GROUP BY ct.fromAccount`,
      [companyId, fromSQL, toSQL, inClause]
    );

    const [contraTo] = await pool.query(
      `SELECT ct.toAccount AS ledgerId, SUM(COALESCE(ct.amount,0)) AS debit_sum
       FROM contra_transactions ct
       JOIN contra_vouchers cv ON cv.id = ct.voucherId
       WHERE cv.companyId = ? AND cv.date BETWEEN ? AND ?
         AND ct.toAccount IN (?)
       GROUP BY ct.toAccount`,
      [companyId, fromSQL, toSQL, inClause]
    );

    // 5) Sales vouchers: Use SUBTOTAL (Taxable Value) - Credit Side
    const [salesAgg] = await pool.query(
      `SELECT sv.ledgerId AS ledgerId, SUM(COALESCE(sv.subtotal,0)) AS credit_sum
       FROM sales_vouchers sv
       WHERE sv.companyId = ? AND sv.date BETWEEN ? AND ?
         AND sv.ledgerId IN (?)
       GROUP BY sv.ledgerId`,
      [companyId, fromSQL, toSQL, inClause]
    );

    // 6) Purchase vouchers: Use SUBTOTAL (Taxable Value) - Debit Side
    const [purchaseAgg] = await pool.query(
      `SELECT pv.ledgerId AS ledgerId, SUM(COALESCE(pv.subtotal,0)) AS debit_sum
       FROM purchase_vouchers pv
       WHERE pv.companyId = ? AND pv.date BETWEEN ? AND ?
         AND pv.ledgerId IN (?)
       GROUP BY pv.ledgerId`,
      [companyId, fromSQL, toSQL, inClause]
    );

    // 7) Debit Notes (Purchase Returns) -> Reduce Purchase (Reduce Debit or Add Credit)
    // We treat as Credit to the separate Expense Ledger or the same Ledger.
    // Usually Debit Note to Party -> Party Debit, Expense Credit.
    // We need to fetch the SUM from note_items because notes table might miss Amount.
    // However, here we need to know WHICH ledger is credited (Purchase Account).
    // The note table has PurchaseLedger column.
    const [debitNoteAgg] = await pool.query(
      `SELECT n.PurchaseLedger AS ledgerId, SUM(ni.amount) AS credit_sum
         FROM notes n
         JOIN note_items ni ON n.id = ni.noteId
         WHERE n.companyId = ? AND n.date BETWEEN ? AND ? 
           AND n.note_type = 'debit'
           AND n.PurchaseLedger IN (?)
         GROUP BY n.PurchaseLedger`,
      [companyId, fromSQL, toSQL, inClause]
    );

    // 8) Credit Notes (Sales Returns) -> Reduce Sales (Reduce Credit or Add Debit)
    // Usually Credit Note to Party -> Party Credit, Income Debit.
    // Using PurchaseLedger column (which seems to store the Sales/Income ledger based on createCreditNote usage or assumptions).
    // We check createCreditNote: it puts PurchaseLedger as 5th arg. 
    // We assume n.PurchaseLedger holds the "Sales Account" or "Income Account" ledger ID.
    const [creditNoteAgg] = await pool.query(
      `SELECT n.PurchaseLedger AS ledgerId, SUM(ni.amount) AS debit_sum
         FROM notes n
         JOIN note_items ni ON n.id = ni.noteId
         WHERE n.companyId = ? AND n.date BETWEEN ? AND ? 
           AND n.note_type = 'credit'
           AND n.PurchaseLedger IN (?)
         GROUP BY n.PurchaseLedger`,
      [companyId, fromSQL, toSQL, inClause]
    );


    // Build Map
    const ledgerMap = {};
    for (const l of ledgers) {
      ledgerMap[l.ledgerId] = {
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        groupName: l.groupName || l.underGroupRaw || "",
        groupCategory: l.groupCategory ? l.groupCategory.toLowerCase() : null,
        openingBalance: parseFloat(l.openingBalance) || 0,
        balanceType: l.balanceType || "Debit",
        debit: 0,
        credit: 0,
      };
    }

    const addAgg = (rows, ledgerField, debitField = "debit_sum", creditField = "credit_sum") => {
      for (const r of rows) {
        const id = Number(r[ledgerField]);
        if (!ledgerMap[id]) continue;
        ledgerMap[id].debit += parseFloat(r[debitField] || 0);
        ledgerMap[id].credit += parseFloat(r[creditField] || 0);
      }
    };

    addAgg(paymentAgg, "ledgerId");
    addAgg(journalAgg, "ledgerId");

    // Contra
    for (const r of contraFrom) {
      const id = Number(r.ledgerId);
      if (ledgerMap[id]) ledgerMap[id].credit += parseFloat(r.credit_sum || 0);
    }
    for (const r of contraTo) {
      const id = Number(r.ledgerId);
      if (ledgerMap[id]) ledgerMap[id].debit += parseFloat(r.debit_sum || 0);
    }

    // Sales & Purchase
    addAgg(salesAgg, "ledgerId");
    addAgg(purchaseAgg, "ledgerId");

    // Notes
    addAgg(debitNoteAgg, "ledgerId", "debit_sum", "credit_sum"); // Debit Note returns -> Credit Expense
    addAgg(creditNoteAgg, "ledgerId", "debit_sum", "credit_sum"); // Credit Note returns -> Debit Income

    // Compute Result
    const result = Object.values(ledgerMap).map((l) => {
      const opening = parseFloat(l.openingBalance || 0);
      const dr = l.debit;
      const cr = l.credit;

      let closing = 0;
      if ((String(l.balanceType || "").toLowerCase() || "debit") === "debit") {
        closing = opening + dr - cr;
      } else {
        closing = opening - dr + cr;
      }

      return {
        ...l,
        debit: Number(dr.toFixed(2)),
        credit: Number(cr.toFixed(2)),
        closingBalance: Number(closing.toFixed(2)),
      };
    });

    // Classify
    const income = [];
    const expenses = [];

    // Simple keyword matching if nature not set
    const isIncomeGroup = (name) => /income|sales|revenue/i.test(name);
    const isExpenseGroup = (name) => /expense|purchase|cost/i.test(name);

    for (const l of result) {
      // If no transactions and no opening, skip? (Optional, keeping for now)

      let nature = l.groupCategory;

      let isIncome = false;
      let isExpense = false;

      if (nature === 'income') isIncome = true;
      else if (nature === 'expense') isExpense = true;
      else {
        // fallback
        const gName = (l.groupName || "").toString();
        if (isIncomeGroup(gName)) isIncome = true;
        else if (isExpenseGroup(gName)) isExpense = true;
      }

      // Auto-classify based on P&L behavior if still unknown:
      // In P&L: Credit entries are Income, Debit entries are Expenses.
      // But we must look at the Ledger Type too. 
      // Using simpler fallback:
      if (!isIncome && !isExpense) {
        if (l.credit > l.debit && l.credit > 0) isIncome = true;
        else if (l.debit > l.credit && l.debit > 0) isExpense = true;
      }

      if (isIncome) {
        // For Income: Balance is typically Credit. 
        // We show the "amount" relevant to P&L.
        // Usually just the movement during the period? Or the closing balance?
        // P&L usually shows "Sales Account: 5000". This is the closing balance of Sales A/c.
        income.push({
          ledgerName: l.ledgerName,
          amount: Math.abs(l.closingBalance) // Show positive
        });
      } else if (isExpense) {
        expenses.push({
          ledgerName: l.ledgerName,
          amount: Math.abs(l.closingBalance)
        });
      }
    }

    // Totals
    const totalIncome = income.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Closing Stock
    const [stocks] = await pool.query(
      `SELECT SUM(openingBalanceQty * openingBalanceRate) as stockValue FROM stocks WHERE companyId = ?`,
      [companyId]
    );
    const closingStockValue = Number(stocks[0]?.stockValue || 0);

    // P&L also includes Closing Stock on Income side (Trading A/c style)
    if (closingStockValue > 0) {
      income.push({ ledgerName: "Closing Stock", amount: closingStockValue });
    }

    const finalTotalIncome = totalIncome + closingStockValue;
    const net = finalTotalIncome - totalExpenses;

    return res.json({
      success: true,
      from: fromSQL,
      to: toSQL,
      income,
      expenses,
      totals: {
        totalIncome: Number(finalTotalIncome.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netProfit: Number(net.toFixed(2)),
      },
    });

  } catch (error) {
    console.error("PROFIT-LOSS ERROR:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
