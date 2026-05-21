import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

// ➜ Add Ledger Entry
export const addLedger = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);
  console.log(req.body);
  
  const {
    ledgerName,
    openingDebit,
    openingCredit,
    closingDebit,
    closingCredit,
  } = req.body;

  try {
    await ensureCreatorColumns(pool, "trial_balance");
    const [result] = await pool.query(
      `INSERT INTO trial_balance 
        (companyId, ledgerName, openingDebit, openingCredit, closingDebit, closingCredit, created_by_user_id, created_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        ledgerName,
        openingDebit || 0,
        openingCredit || 0,
        closingDebit || 0,
        closingCredit || 0,
        creator.userId,
        creator.employeeId,
      ]
    );

    res.status(201).json({
      message: "Ledger added successfully",
      id: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to add ledger", details: error });
  }
};

// ➜ Get All Ledgers for Company
export const getAllLedgers = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [result] = await pool.query(
      `SELECT * FROM trial_balance WHERE companyId = ? ORDER BY id DESC`,
      [companyId]
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch trial balance", details: error });
  }
};

// ➜ Delete Ledger
export const deleteLedger = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(`DELETE FROM trial_balance WHERE id = ?`, [id]);

    res.json({ message: "Ledger deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete ledger", details: error });
  }
};


// export const trial_balance = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     // 1️⃣ Get ALL voucher transactions for company
//     const [transactions] = await pool.query(
//       `SELECT * FROM voucher_transactions WHERE companyId = ? ORDER BY id DESC`,
//       [companyId]
//     );

//     if (transactions.length === 0) {
//       return res.status(200).json({
//         message: "No Voucher Transactions Found",
//         data: { voucherTypeWise: {}, ledgerWise: {} },
//       });
//     }

//     // -----------------------------------------
//     // 2️⃣ GROUP BY voucherType
//     // -----------------------------------------
//     const voucherTypeWise = {};

//     transactions.forEach((tx) => {
//       const type = tx.voucherType || "unknown";

//       if (!voucherTypeWise[type]) {
//         voucherTypeWise[type] = [];
//       }
//       voucherTypeWise[type].push(tx);
//     });

//     // -----------------------------------------
//     // 3️⃣ GROUP BY ledgerId
//     // -----------------------------------------
//     const ledgerWise = {};

//     transactions.forEach((tx) => {
//       const lid = tx.ledgerId;

//       if (!ledgerWise[lid]) {
//         ledgerWise[lid] = [];
//       }
//       ledgerWise[lid].push(tx);
//     });

//     return res.status(200).json({
//       message: "Data fetched successfully",
//       data: {
//         voucherTypeWise, // grouped by voucherType
//         ledgerWise,      // grouped by ledgerId
//       },
//     });

//   } catch (error) {
//     console.error("TRIAL BALANCE ERROR:", error);
//     return res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

// export const trial_balance = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     const [transactions] = await pool.query(
//       `SELECT * FROM voucher_transactions WHERE companyId = ? ORDER BY id DESC`,
//       [companyId]
//     );

//     const [ledgers] = await pool.query(
//       `SELECT * FROM ledgers WHERE companyId = ?`,
//       [companyId]
//     );

//     const [groups] = await pool.query(
//       `SELECT * FROM groups WHERE companyId = ?`,
//       [companyId]
//     );

//     // ---------------------------------------------------
//     // GROUP MAP (KEY = groupName)
//     // ---------------------------------------------------
//     const groupMap = {};
//     groups.forEach((g) => {
//       groupMap[g.groupName.trim()] = {
//         groupName: g.groupName.trim(),
//         nature: g.nature,
//       };
//     });
// console.log(groupMap);

//     // ---------------------------------------------------
//     // GROUP BY voucherType
//     // ---------------------------------------------------
//     const voucherTypeWise = {};
//     transactions.forEach((tx) => {
//       const type = tx.voucherType || "unknown";
//       if (!voucherTypeWise[type]) voucherTypeWise[type] = [];
//       voucherTypeWise[type].push(tx);
//     });

//     // ---------------------------------------------------
//     // GROUP BY ledgerId (MATCH group using underGroup)
//     // ---------------------------------------------------
//     const ledgerWise = {};

//     ledgers.forEach((l) => {
//       const groupKey = l.underGroup?.trim() || "";
//       const groupInfo = groupMap[groupKey] || {};

//       ledgerWise[l.id] = {
//         ledgerId: l.id,
//         ledgerName: l.name,

//         groupName: groupInfo.groupName || l.underGroup || "No Group",
//         groupNature: groupInfo.nature || "No Nature",

//         transactions: [],
//       };
//     });

//     // Place transactions inside each ledger
//     transactions.forEach((tx) => {
//       if (ledgerWise[tx.ledgerId]) {
//         ledgerWise[tx.ledgerId].transactions.push(tx);
//       }
//     });

//     return res.status(200).json({
//       message: "Data fetched successfully",
//       data: {
//         voucherTypeWise,
//         ledgerWise,
//       },
//     });

//   } catch (error) {
//     console.error("TRIAL BALANCE ERROR:", error);
//     return res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

// export const trial_balance = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     const [transactions] = await pool.query(
//       `SELECT * FROM voucher_transactions WHERE companyId = ? ORDER BY id DESC`,
//       [companyId]
//     );

//     const [ledgers] = await pool.query(
//       `SELECT * FROM ledgers WHERE companyId = ?`,
//       [companyId]
//     );

//     const [groups] = await pool.query(
//       `SELECT * FROM groups WHERE companyId = ?`,
//       [companyId]
//     );

//     // ---------------------------------------------------
//     // GROUP MAP (KEY = groupName)
//     // ---------------------------------------------------
//     const groupMap = {};
//     groups.forEach((g) => {
//       groupMap[g.groupName.trim()] = {
//         groupName: g.groupName.trim(),
//         nature: g.nature?.toLowerCase() || "",
//       };
//     });

//     // ---------------------------------------------------
//     // GROUP BY voucherType
//     // ---------------------------------------------------
//     const voucherTypeWise = {};
//     transactions.forEach((tx) => {
//       const type = tx.voucherType || "unknown";
//       if (!voucherTypeWise[type]) voucherTypeWise[type] = [];
//       voucherTypeWise[type].push(tx);
//     });

//     // ---------------------------------------------------
//     // PREPARE LEDGER MAP
//     // ---------------------------------------------------
//     const ledgerWise = {};
//     ledgers.forEach((l) => {
//       const groupKey = l.underGroup?.trim() || "";
//       const groupInfo = groupMap[groupKey] || {};

//       ledgerWise[l.id] = {
//         ledgerId: l.id,
//         ledgerName: l.name,

//         groupName: groupInfo.groupName || l.underGroup || "No Group",
//         groupNature: groupInfo.nature || "unknown",

//         openingDebit: l.openingBalanceType === "Debit" ? parseFloat(l.openingBalance || 0) : 0,
//         openingCredit: l.openingBalanceType === "Credit" ? parseFloat(l.openingBalance || 0) : 0,

//         transactions: [],
//         totalDebit: 0,
//         totalCredit: 0,
//         closingDebit: 0,
//         closingCredit: 0,
//       };
//     });

//     // ---------------------------------------------------
//     // ADD TRANSACTIONS TO LEDGER
//     // ---------------------------------------------------
//     transactions.forEach((tx) => {
//       if (ledgerWise[tx.ledgerId]) {
//         ledgerWise[tx.ledgerId].transactions.push(tx);
//       }
//     });

//     // ---------------------------------------------------
//     // RULES BASED ON NATURE
//     // ---------------------------------------------------
//     const natureDebit = ["asset", "expenses"];
//     const natureCredit = ["liabilities", "revenue", "income"];

//     // ---------------------------------------------------
//     // CALCULATE TOTALS + CLOSING BALANCE
//     // ---------------------------------------------------
//     Object.values(ledgerWise).forEach((ledger) => {
//       let debitSum = ledger.openingDebit;
//       let creditSum = ledger.openingCredit;

//       ledger.transactions.forEach((tx) => {
//         debitSum += parseFloat(tx.debit || 0);
//         creditSum += parseFloat(tx.credit || 0);
//       });

//       ledger.totalDebit = debitSum;
//       ledger.totalCredit = creditSum;

//       // APPLY NATURE RULE
//       if (natureDebit.includes(ledger.groupNature)) {
//         // Debit nature → Debit balance = debit - credit
//         const bal = debitSum - creditSum;
//         ledger.closingDebit = bal > 0 ? bal : 0;
//         ledger.closingCredit = bal < 0 ? Math.abs(bal) : 0;
//       } 
//       else if (natureCredit.includes(ledger.groupNature)) {
//         // Credit nature → Credit balance = credit - debit
//         const bal = creditSum - debitSum;
//         ledger.closingCredit = bal > 0 ? bal : 0;
//         ledger.closingDebit = bal < 0 ? Math.abs(bal) : 0;
//       } 
//       else {
//         ledger.closingDebit = debitSum;
//         ledger.closingCredit = creditSum;
//       }
//     });

//     // ---------------------------------------------------
//     // CALCULATE TRIAL BALANCE TOTALS
//     // ---------------------------------------------------
//     let totalDebit = 0;
//     let totalCredit = 0;

//     Object.values(ledgerWise).forEach((l) => {
//       totalDebit += l.closingDebit;
//       totalCredit += l.closingCredit;
//     });

//     const groupWise = {};

// Object.values(ledgerWise).forEach((ledger) => {
//   const groupName = ledger.groupName;

//   if (!groupWise[groupName]) {
//     groupWise[groupName] = {
//       groupName,
//       nature: ledger.groupNature,
//       ledgers: []
//     };
//   }

//   groupWise[groupName].ledgers.push({
//     ledgerId: ledger.ledgerId,
//     ledgerName: ledger.ledgerName,
//     openingDebit: ledger.openingDebit,
//     openingCredit: ledger.openingCredit,
//     totalDebit: ledger.totalDebit,
//     totalCredit: ledger.totalCredit,
//     closingDebit: ledger.closingDebit,
//     closingCredit: ledger.closingCredit,
//     transactions: ledger.transactions   // vouchers under ledger
//   });
// });

// return res.status(200).json({
//      message: "Trial Balance Calculated Successfully",
// data: {
//   groupWise,     // <-- group → ledgers → vouchers
//   summary: {
//     totalDebit,
//     totalCredit,
//     difference: totalDebit - totalCredit,
//   },
// },
// })



//     // return res.status(200).json({
//     //   message: "Trial Balance Calculated Successfully",
//     //   data: {
//     //     voucherTypeWise,
//     //     ledgerWise,
//     //     summary: {
//     //       totalDebit,
//     //       totalCredit,
//     //       difference: totalDebit - totalCredit,
//     //     },
//     //   },
//     // });

//   } catch (error) {
//     console.error("TRIAL BALANCE ERROR:", error);
//     return res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

export const trial_balance = async (req, res) => {
  const { companyId } = req.params;

  try {
    // ----------------------------------------------------------
    // 1️⃣ Fetch Ledgers & Groups
    // ----------------------------------------------------------
    const [ledgers] = await pool.query(
      `SELECT * FROM ledgers WHERE companyId = ?`,
      [companyId]
    );

    const [groups] = await pool.query(
      `SELECT * FROM groups WHERE companyId = ?`,
      [companyId]
    );

    // Map groups by ID
    const groupMap = {};
    groups.forEach((g) => {
      groupMap[g.id] = {
        groupName: g.groupName,
        nature: g.nature?.toLowerCase(),
      };
    });

    // Prepare Ledger Summary
    const ledgerSummary = {};

    ledgers.forEach((l) => {
      ledgerSummary[l.id] = {
        ledgerId: l.id,
        ledgerName: l.name,
        groupId: l.groupId,
        groupName: groupMap[l.groupId]?.groupName || "Others",
        nature: groupMap[l.groupId]?.nature || "asset",

        openingDebit: l.balanceType === "Debit" ? +l.openingBalance : 0,
        openingCredit: l.balanceType === "Credit" ? +l.openingBalance : 0,

        debit: 0,
        credit: 0,

        closingDebit: 0,
        closingCredit: 0,
      };
    });

    // ----------------------------------------------------------
    // 2️⃣ PAYMENT VOUCHER → CREDIT (Bank/Cash)
    // ----------------------------------------------------------
    const [payment] = await pool.query(
      `SELECT ledgerId, amount FROM payment_vouchers WHERE companyId = ?`,
      [companyId]
    );

    payment.forEach((p) => {
      if (ledgerSummary[p.ledgerId]) {
        // Payment reduces Asset (Bank/Cash) -> Credit
        ledgerSummary[p.ledgerId].credit += Number(p.amount);
      }
    });

    // ----------------------------------------------------------
    // 3️⃣ RECEIVE VOUCHER → DEBIT (Bank/Cash)
    // ----------------------------------------------------------
    const [receive] = await pool.query(
      `SELECT customer AS ledgerId, amount 
       FROM receive_vouchers WHERE companyId = ?`,
      [companyId]
    );

    receive.forEach((r) => {
      if (ledgerSummary[r.ledgerId]) {
        // Receive increases Asset (Bank/Cash) -> Debit
        ledgerSummary[r.ledgerId].debit += Number(r.amount);
      }
    });

    // ----------------------------------------------------------
    // 4️⃣ PURCHASE VOUCHER
    //    1. Credit Supplier (ledgerId)
    //    2. Debit Purchase Account (Virtual)
    // ----------------------------------------------------------
    const [purchase] = await pool.query(
      `SELECT ledgerId, grand_total AS amount 
       FROM purchase_vouchers WHERE companyId = ?`,
      [companyId]
    );

    let totalPurchase = 0;

    purchase.forEach((p) => {
      if (ledgerSummary[p.ledgerId]) {
        // Credit Supplier
        ledgerSummary[p.ledgerId].credit += Number(p.amount);
      }
      totalPurchase += Number(p.amount);
    });

    // ----------------------------------------------------------
    // 5️⃣ SALES VOUCHER
    //    1. Debit Customer (ledgerId)
    //    2. Credit Sales Account (Virtual)
    // ----------------------------------------------------------
    const [sales] = await pool.query(
      `SELECT ledgerId, grand_total AS amount 
       FROM sales_vouchers WHERE companyId = ?`,
      [companyId]
    );

    let totalSales = 0;

    sales.forEach((s) => {
      if (ledgerSummary[s.ledgerId]) {
        // Debit Customer
        ledgerSummary[s.ledgerId].debit += Number(s.amount);
      }
      totalSales += Number(s.amount);
    });

    // ----------------------------------------------------------
    // 6️⃣ JOURNAL TRANSACTIONS → DR/CR
    // ----------------------------------------------------------
    const [journal] = await pool.query(
      `SELECT particulars AS ledgerId, debit, credit 
       FROM journal_transactions WHERE companyId = ?`,
      [companyId]
    );

    journal.forEach((j) => {
      if (ledgerSummary[j.ledgerId]) {
        ledgerSummary[j.ledgerId].debit += Number(j.debit || 0);
        ledgerSummary[j.ledgerId].credit += Number(j.credit || 0);
      }
    });

    // ----------------------------------------------------------
    // 7️⃣ CONTRA TRANSACTIONS
    //    From Account -> Credit
    //    To Account -> Debit
    // ----------------------------------------------------------
    const [contra] = await pool.query(
      `SELECT fromAccount, toAccount, amount 
       FROM contra_transactions 
       LEFT JOIN contra_vouchers ON contra_vouchers.id = contra_transactions.voucherId
       WHERE contra_vouchers.companyId = ?`,
      [companyId]
    );

    contra.forEach((c) => {
      if (ledgerSummary[c.fromAccount]) {
        ledgerSummary[c.fromAccount].credit += Number(c.amount);
      }
      if (ledgerSummary[c.toAccount]) {
        ledgerSummary[c.toAccount].debit += Number(c.amount);
      }
    });

    // ----------------------------------------------------------
    // 8️⃣ ADD VIRTUAL LEDGERS (Purchase & Sales)
    // ----------------------------------------------------------
    const purchaseLedgerId = "VIRTUAL_PURCHASE";
    const salesLedgerId = "VIRTUAL_SALES";

    // Virtual Purchase Account (Expense -> Debit Nature)
    ledgerSummary[purchaseLedgerId] = {
      ledgerId: purchaseLedgerId,
      ledgerName: "Purchase Accounts",
      groupId: "VIRTUAL_GRP_PURCHASE",
      groupName: "Purchase Accounts",
      nature: "expense",
      openingDebit: 0,
      openingCredit: 0,
      debit: totalPurchase, // Debit Purchase Account
      credit: 0, 
      closingDebit: 0,
      closingCredit: 0
    };

    // Virtual Sales Account (Income -> Credit Nature)
    ledgerSummary[salesLedgerId] = {
      ledgerId: salesLedgerId,
      ledgerName: "Sales Accounts",
      groupId: "VIRTUAL_GRP_SALES",
      groupName: "Sales Accounts",
      nature: "income",
      openingDebit: 0,
      openingCredit: 0,
      debit: 0,
      credit: totalSales, // Credit Sales Account
      closingDebit: 0,
      closingCredit: 0
    };


    // ----------------------------------------------------------
    // 9️⃣ CALCULATE CLOSING BALANCE
    // ----------------------------------------------------------
    Object.values(ledgerSummary).forEach((l) => {
      const totalDebit = l.openingDebit + l.debit;
      const totalCredit = l.openingCredit + l.credit;

      // Nature Rules:
      // Assets / Expenses -> Debit Balance usually
      // Liabilities / Income -> Credit Balance usually
      
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
    // 🔟 GROUP WISE TRIAL BALANCE
    // ----------------------------------------------------------
    const groupWise = {};
    const ledgerList = Object.values(ledgerSummary);

    // Sort alphabetically by group name
    ledgerList.sort((a, b) => a.groupName.localeCompare(b.groupName));

    ledgerList.forEach((l) => {
      if (!groupWise[l.groupName]) {
        groupWise[l.groupName] = {
          groupName: l.groupName,
          nature: l.nature,
          totalDebit: 0,
          totalCredit: 0,
          ledgers: [],
        };
      }
      
      groupWise[l.groupName].ledgers.push(l);
      
      // Accumulate Group Totals
      groupWise[l.groupName].totalDebit += l.closingDebit;
      groupWise[l.groupName].totalCredit += l.closingCredit;
    });

    // ----------------------------------------------------------
    // 1️⃣1️⃣ FINAL TOTALS
    // ----------------------------------------------------------
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    ledgerList.forEach((l) => {
      grandTotalDebit += l.closingDebit;
      grandTotalCredit += l.closingCredit;
    });

    return res.status(200).json({
      success: true,
      message: "Trial Balance Generated",
      summary: {
        totalDebit: grandTotalDebit,
        totalCredit: grandTotalCredit,
        difference: grandTotalDebit - grandTotalCredit,
      },
      groupWise,
      ledgers: ledgerList
    });

  } catch (error) {
    console.log("TRIAL BALANCE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// export const trial_balance = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     // 1️⃣ Get all voucher transactions
//     const [transactions] = await pool.query(
//       `SELECT * FROM voucher_transactions WHERE companyId = ? ORDER BY id DESC`,
//       [companyId]
//     );

//     // 2️⃣ Get all ledgers for company
//     const [ledgers] = await pool.query(
//       `SELECT * FROM ledgers WHERE companyId = ?`,
//       [companyId]
//     );

//     // 3️⃣ Get all groups (to find groupName)
//     const [groups] = await pool.query(`SELECT * FROM groups WHERE companyId = ?`, [
//       companyId,
//     ]);

//     // Convert groups to map -> { groupId: groupName }
//     const groupMap = {};
//     groups.forEach((g) => {
//       groupMap[g.id] = g.groupName;
//     });
    
//     console.log(groupMap);
 
//     // ---------------------------------------------------
//     // GROUP BY voucherType
//     // ---------------------------------------------------
//     const voucherTypeWise = {};

//     transactions.forEach((tx) => {
//       const type = tx.voucherType || "unknown";

//       if (!voucherTypeWise[type]) {
//         voucherTypeWise[type] = [];
//       }
//       voucherTypeWise[type].push(tx);
//     });

//     // ---------------------------------------------------
//     // GROUP BY ledgerId + include ledger info & group name
//     // ---------------------------------------------------
//     const ledgerWise = {};

//     // Prepare ledger-wise buckets
//     ledgers.forEach((l) => {
//       ledgerWise[l.id] = {
//         ledgerId: l.id,
//         ledgerName: l.name,
//         groupId: l.groupId,
//         groupName: l.underGroup || "N Group",

//         transactions: [],
//       };
//     });
//     const groupType = {}
//     groups.forEach((g) =>{
//         groupType[g.id] ={
//           type:g.nature
//         }
//     })
//     // Insert transactions under correct ledger
//     transactions.forEach((tx) => {
//       if (ledgerWise[tx.ledgerId]) {
//         ledgerWise[tx.ledgerId].transactions.push(tx);
//       }
//     });



//     return res.status(200).json({
//       message: "Data fetched successfully",
//       data: {
//         voucherTypeWise,
//         ledgerWise,
//       },
//     });
//   } catch (error) {
//     console.error("TRIAL BALANCE ERROR:", error);
//     return res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

