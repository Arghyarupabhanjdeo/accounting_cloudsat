import { getCreatorFromRequest } from "../utils/creatorTracking.js";
import pool from "../db.js";


// export const getBalanceSheet = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     const [rows] = await pool.query(
//       `SELECT 
//          h.*, 
//          l.name AS ledgerName,
//          l.underGroup AS groupName
//        FROM ledger_history h
//        LEFT JOIN ledgers l ON h.ledgerId = l.id
//        LEFT JOIN groups g ON l.underGroup = g.id
//        WHERE h.companyId = ?
//        ORDER BY h.id DESC`,
//       [companyId]
//     );

//     res.json({
//       success: true,
//       rows,
//     });

//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };



// export const getBalanceSheet = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     // 1. FETCH LEDGER HISTORY + LEDGER DETAILS
//     const [ledgers] = await pool.query(
//       `SELECT 
//          h.*, 
//          l.id AS ledgerId,
//          l.name AS ledgerName,
//          g.groupName AS groupName
//        FROM ledger_history h
//        LEFT JOIN ledgers l ON h.ledgerId = l.id
//        LEFT JOIN groups g ON l.underGroup = g.id
//        WHERE h.companyId = ?
//        ORDER BY l.name ASC`,
//       [companyId]
//     );



//     // Purchase Vouchers
//     const [purchase] = await pool.query(
//       `SELECT id, date, ledgerId AS ledgerId, grand_total AS amount, 'Purchase' AS voucherType
//        FROM purchase_vouchers
//        WHERE companyId = ?`,
//       [companyId]
//     );
//      console.log(purchase);

//     // Sales Vouchers
//     const [sales] = await pool.query(
//       `SELECT id, date, ledgerId, grand_total AS amount, 'Sales' AS voucherType
//        FROM sales_vouchers
//        WHERE companyId = ?`,
//       [companyId]
//     );

//     const [payment] = await pool.query(
//       `SELECT id, date, ledgerId AS ledgerId,totalCredit AS amount, 'Payment' AS voucherType
//        FROM payment_vouchers
//        WHERE companyId = ?`,
//       [companyId]
//     )

//     // Contra Vouchers
//     const [contra] = await pool.query(
//       `SELECT id, ledgerId, amount, 'Contra' AS voucherType
//        FROM contra_transactions
//        WHERE companyId = ?`,
//       [companyId]
//     );

//     // Journal Vouchers
//     const [journal] = await pool.query(
//       `SELECT id,  ledgerId,  'Journal' AS voucherType
//        FROM journal_transactions
//        WHERE companyId = ?`,
//       [companyId]
//     );

//     // ------------------------------------------
//     // 3. COMBINE ALL VOUCHERS INTO ONE OBJECT
//     // ------------------------------------------

//     const vouchers = [...purchase,...payment, ...sales, ...contra, ...journal];
//      console.log(vouchers);

//     // Group vouchers by ledgerId
//     const voucherMap = vouchers.reduce((acc, v) => {
//       if (!acc[v.ledgerId]) acc[v.ledgerId] = [];
//       acc[v.ledgerId].push(v);
//       return acc;
//     }, {});

//     // ------------------------------------------
//     // 4. ATTACH VOUCHERS TO EACH LEDGER
//     // ------------------------------------------

//     const result = ledgers.map((l) => ({
//       ...l,
//       vouchers: voucherMap[l.ledgerId] || [],
//     }));

//     res.json({
//       success: true,
//       data: result,
//     });

//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


export const getBalanceSheet = async (req, res) => {
  const { companyId } = req.params;

  
  const creator = getCreatorFromRequest(req);
  let extraCondition = "";
  let extraParams = [];

  if (creator.employeeId) {
    extraCondition = " AND created_by_employee_id = ?";
    extraParams.push(creator.employeeId);
  } else if (creator.userId) {
    extraCondition = " AND created_by_user_id = ?";
    extraParams.push(creator.userId);
  }
try {
    // ----------------------------------------------------------
    // 1️⃣ Fetch Ledgers & Groups
    // ----------------------------------------------------------
    const [ledgers] = await pool.query(
      `SELECT * FROM ledgers WHERE companyId = ?`,
      [companyId]
    );

    const [groups] = await pool.query(
      `SELECT * FROM groups WHERE companyId = ? OR companyId IS NULL`,
      [companyId]
    );

    const groupMapByName = {};
    groups.forEach((g) => {
      groupMapByName[g.groupName] = g;
    });

    const getPrimaryGroup = (groupName) => {
      let current = groupMapByName[groupName];
      let lastGroupName = groupName;
      let visited = new Set();
      while (current && current.under && current.under !== "Primary" && current.under !== "") {
        if (visited.has(current.groupName)) break;
        visited.add(current.groupName);
        lastGroupName = current.under;
        current = groupMapByName[current.under];
      }
      return lastGroupName || "Others";
    };

    // Map groups by ID
    const groupMap = {};
    groups.forEach((g) => {
      groupMap[g.id] = {
        groupName: g.groupName,
        primaryGroupName: getPrimaryGroup(g.groupName),
        nature: g.nature?.toLowerCase(), // assets, liabilities, income, expense, equity
      };
    });

    // Prepare Ledger Summary
    const ledgerSummary = {};

    // Helper to init ledger if not exists (for virtual ledgers like Duties & Taxes)
    const initLedger = (id, name, groupId, nature) => {
      if (!ledgerSummary[id]) {
        ledgerSummary[id] = {
          ledgerId: id,
          ledgerName: name,
          groupId: groupId || 0,
          groupName: groupMap[groupId]?.primaryGroupName || groupMap[groupId]?.groupName || "Others",
          nature: nature || groupMap[groupId]?.nature || "liabilities", // Default to liab if unknown
          openingDebit: 0,
          openingCredit: 0,
          debit: 0,
          credit: 0,
          closingDebit: 0,
          closingCredit: 0,
        };
      }
      return ledgerSummary[id];
    };



    ledgers.forEach((l) => {
      ledgerSummary[l.id] = {
        ledgerId: l.id,
        ledgerName: l.name,
        groupId: l.groupId,
        groupName: groupMap[l.groupId]?.primaryGroupName || groupMap[l.groupId]?.groupName || "Others",
        nature: groupMap[l.groupId]?.nature || "asset",

        openingDebit: l.balanceType === "Debit" ? +l.openingBalance : 0,
        openingCredit: l.balanceType === "Credit" ? +l.openingBalance : 0,

        debit: 0,
        credit: 0,

        closingDebit: 0,
        closingCredit: 0,
      };
    });

    // Virtual Ledger IDs
    const DUTIES_TAXES_ID = -999;
    initLedger(DUTIES_TAXES_ID, "Duties & Taxes", null, "liabilities");
    ledgerSummary[DUTIES_TAXES_ID].groupName = "Current Liabilities";



    // ----------------------------------------------------------
    // 2️⃣ AGGREGATE TRANSACTIONS
    // ----------------------------------------------------------

    // a) Payment (Debit Party, Credit Bank/Cash - already handled in double entry usually, but here we just have payment_vouchers table)
    // Assuming payment_vouchers means: We paid to `ledgerId`. So `ledgerId` gets DEBIT (Receiver).
    // Wait, typically Payment Voucher: Dr Party, Cr Cash/Bank.
    // The query `SELECT ledgerId, amount FROM payment_vouchers` usually ignores the Cash/Bank side if not stored. 
    // We will stick to correcting the PARTY balance.
    const [payment] = await pool.query(
      `SELECT ledgerId, amount FROM payment_vouchers WHERE companyId = ?${extraCondition}`, [companyId, ...extraParams]);
    payment.forEach((p) => {
      if (ledgerSummary[p.ledgerId]) {
        // Party picked up money: Dr Party
        ledgerSummary[p.ledgerId].debit += Number(p.amount);
      }
    });

    // b) Receive (Credit Party, Debit Bank/Cash)
    // Party gave money: Cr Party.
    const [receive] = await pool.query(
      `SELECT customer AS ledgerId, amount FROM receive_vouchers WHERE companyId = ?${extraCondition}`, [companyId, ...extraParams]);
    receive.forEach((r) => {
      if (ledgerSummary[r.ledgerId]) {
        ledgerSummary[r.ledgerId].credit += Number(r.amount);
      }
    });

    // c) Purchase (Credit Supplier, Debit Purchase A/c, Debit Input Tax)
    // We separate Tax here.
    const [purchase] = await pool.query(
      `SELECT ledgerId, subtotal, gst_amount, grand_total FROM purchase_vouchers WHERE companyId = ?${extraCondition}`, [companyId, ...extraParams]);

    let totalPurchaseNum = 0; // Taxable Value

    purchase.forEach((p) => {
      // 1. Credit Party (Supplier) with FULL Amount
      if (ledgerSummary[p.ledgerId]) {
        ledgerSummary[p.ledgerId].credit += Number(p.grand_total);
      }

      // 2. Add to Total Purchase (Expense) - ONLY SUBTOTAL
      totalPurchaseNum += Number(p.subtotal);

      // 3. Debit Duties & Taxes (Input Tax matches asset side logic, but usually we just net it off in Liab)
      // Since "Duties & Taxes" is Liability nature: Debit decreases it.
      ledgerSummary[DUTIES_TAXES_ID].debit += Number(p.gst_amount);
    });

    // d) Sales (Debit Customer, Credit Sales A/c, Credit Output Tax)
    const [sales] = await pool.query(
      `SELECT ledgerId, subtotal, gst_amount, grand_total FROM sales_vouchers WHERE companyId = ?${extraCondition}`, [companyId, ...extraParams]);

    let totalSalesNum = 0; // Taxable Value

    sales.forEach((s) => {
      // 1. Debit Party (Customer) with FULL Amount
      if (ledgerSummary[s.ledgerId]) {
        ledgerSummary[s.ledgerId].debit += Number(s.grand_total);
      }

      // 2. Add to Total Sales (Income) - ONLY SUBTOTAL
      totalSalesNum += Number(s.subtotal);

      // 3. Credit Duties & Taxes (Output Tax)
      // Liability increases with Credit.
      ledgerSummary[DUTIES_TAXES_ID].credit += Number(s.gst_amount);
    });

    // e) Journal
    const [journal] = await pool.query(
      `SELECT jt.particulars AS ledgerId, jt.debit, jt.credit FROM journal_transactions jt JOIN journal_vouchers jv ON jt.voucherId = jv.id WHERE jt.companyId = ?${extraCondition.replace(/created_by/g, 'jv.created_by')}`, [companyId, ...extraParams]);
    journal.forEach((j) => {
      if (ledgerSummary[j.ledgerId]) {
        ledgerSummary[j.ledgerId].debit += Number(j.debit || 0);
        ledgerSummary[j.ledgerId].credit += Number(j.credit || 0);
      }
    });

    // f) Contra
    const [contra] = await pool.query(
      `SELECT fromAccount, toAccount, amount FROM contra_transactions 
       LEFT JOIN contra_vouchers ON contra_vouchers.id = contra_transactions.voucherId
       WHERE contra_vouchers.companyId = ?${extraCondition.replace(/created_by/g, 'contra_vouchers.created_by')}`, [companyId, ...extraParams]);
    contra.forEach((c) => {
      // fromAccount -> Giver -> Credit
      if (ledgerSummary[c.fromAccount]) ledgerSummary[c.fromAccount].credit += Number(c.amount);
      // toAccount -> Receiver -> Debit
      if (ledgerSummary[c.toAccount]) ledgerSummary[c.toAccount].debit += Number(c.amount);
    });

    // g) Debit Notes (Purchase Return)
    // Debit Party, Credit Purchase Return
    const [debitNotes] = await pool.query(
      `SELECT n.PartyLedger, SUM(ni.amount) AS total, SUM(ni.amount) AS subtotal 
         FROM notes n
         JOIN note_items ni ON n.id = ni.noteId
         WHERE n.companyId = ? AND n.note_type = 'debit'
         GROUP BY n.PartyLedger`,
      [companyId]
    );

    debitNotes.forEach(dn => {
      // Debit Party
      if (ledgerSummary[dn.PartyLedger]) {
        ledgerSummary[dn.PartyLedger].debit += Number(dn.total);
      }
      // Reduce Purchase Expense
      totalPurchaseNum -= Number(dn.subtotal);
    });

    // h) Credit Notes (Sales Return)
    // Credit Party, Debit Sales Return
    const [creditNotes] = await pool.query(
      `SELECT n.PartyLedger, SUM(ni.amount) AS total, SUM(ni.amount) AS subtotal 
         FROM notes n
         JOIN note_items ni ON n.id = ni.noteId
         WHERE n.companyId = ? AND n.note_type = 'credit'
         GROUP BY n.PartyLedger`,
      [companyId]
    );

    creditNotes.forEach(cn => {
      // Credit Party
      if (ledgerSummary[cn.PartyLedger]) {
        ledgerSummary[cn.PartyLedger].credit += Number(cn.total);
      }
      // Reduce Sales Income
      totalSalesNum -= Number(cn.subtotal);
    });


    // ----------------------------------------------------------
    // 3️⃣ CALCULATE CLOSING BALANCES
    // ----------------------------------------------------------
    Object.values(ledgerSummary).forEach((l) => {
      const totalDebit = l.openingDebit + l.debit;
      const totalCredit = l.openingCredit + l.credit;

      // Calculate based on nature usually, but simple deb-cred works for balance sheet placement
      // Asset/Expense: Dr > Cr = Dr Balance
      // Liab/Income: Cr > Dr = Cr Balance
      const balance = totalDebit - totalCredit;

      if (balance > 0) {
        l.closingDebit = balance;
        l.closingCredit = 0;
      } else {
        l.closingCredit = Math.abs(balance);
        l.closingDebit = 0;
      }
    });

    // ----------------------------------------------------------
    // 4️⃣ PROFIT & LOSS CALCULATION
    // ----------------------------------------------------------
    let totalIncome = totalSalesNum;
    let totalExpense = totalPurchaseNum;

    // Add Indirect Incomes and Expenses from Ledgers
    Object.values(ledgerSummary).forEach((l) => {
      if (l.nature === 'income') {
        totalIncome += (l.closingCredit - l.closingDebit);
      } else if (l.nature === 'expense') {
        totalExpense += (l.closingDebit - l.closingCredit);
      }
    });

    // Closing Stock
    const [stocks] = await pool.query(
      `SELECT SUM(openingBalanceQty * openingBalanceRate) as stockValue FROM stocks WHERE companyId = ?`,
      [companyId]
    );
    const closingStockValue = Number(stocks[0]?.stockValue || 0);

    // Net Profit = (Income + Closing Stock) - Expense
    const netProfit = (totalIncome + closingStockValue) - totalExpense;


    // ----------------------------------------------------------
    // 5️⃣ PREPARE BALANCE SHEET STRUCTURE
    // ----------------------------------------------------------
    const liabilities = [];
    const assets = [];

    // Group Ledgers
    Object.values(ledgerSummary).forEach((l) => {
      if (l.closingDebit === 0 && l.closingCredit === 0 && l.ledgerId !== DUTIES_TAXES_ID) return;

      if (l.ledgerId === DUTIES_TAXES_ID) {
        // Duties & Taxes Logic
        // If Credit > Debit -> Payable (Liability)
        // If Debit > Credit -> Receivable (Asset)
        if (l.closingCredit > 0) {
          liabilities.push(l);
        } else if (l.closingDebit > 0) {
          assets.push(l);
        }
        return;
      }

      if (l.nature === 'asset') {
        assets.push(l);
      } else if (l.nature === 'liabilities' || l.nature === 'equity') {
        liabilities.push(l);
      }
    });

    // Add Net Profit to Capital Account (Owner's Capital = Capital + Profit - Drawings)
    if (netProfit !== 0) {
      liabilities.push({
        ledgerId: "PNL",
        ledgerName: "Profit & Loss A/c",
        groupName: "Capital Account",
        closingCredit: netProfit > 0 ? netProfit : 0,
        closingDebit: netProfit < 0 ? Math.abs(netProfit) : 0,
      });
    }

    // Add Closing Stock to Assets
    if (closingStockValue > 0) {
      assets.push({
        ledgerName: "Closing Stock",
        groupName: "Current Assets",
        closingDebit: closingStockValue,
        closingCredit: 0
      });
    }

    // ----------------------------------------------------------
    // 6️⃣ TOTALS AND RESPONSE
    // ----------------------------------------------------------
    let totalAssets = 0;
    let totalLiabilities = 0;

    assets.forEach(a => totalAssets += (a.closingDebit - a.closingCredit));
    liabilities.forEach(l => {
      totalLiabilities += (l.closingCredit - l.closingDebit);
    });

    res.json({
      success: true,
      assets,
      liabilities,
      totals: {
        totalAssets,
        totalLiabilities
      }
    });

  } catch (error) {
    console.error("BALANCE SHEET ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error generating balance sheet",
      error: error.message,
    });
  }
};

