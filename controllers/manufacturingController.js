
import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

// export const createManufacturingJournal = async (req, res) => {
//   const { companyId } = req.params;

//   const {
//     voucherNo,
//     date,
//     productName,
//     godown,
//     finishedQty,
//     costAllocation,
//     costTracking,
//     components,
//     byProducts,
//     addlCost,
//     grandTotal,
//     effectiveRatePerFinished,
//     narration,
//   } = req.body;

//   const conn = await pool.getConnection();

//   try {
//     await conn.beginTransaction();

//     // INSERT MAIN JOURNAL
//     const [journal] = await conn.query(
//       `INSERT INTO manufacturing_journal 
//       (companyId, voucherNo, date, productName, godown, finishedQty, costAllocation, costTracking, addlCost, grandTotal, effectiveRatePerFinished, narration)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         companyId,
//         voucherNo,
//         date,
//         productName,
//         godown,
//         finishedQty,
//         costAllocation,
//         costTracking,
//         addlCost,
//         grandTotal,
//         effectiveRatePerFinished,
//         narration,
//       ]
//     );

//     const journalId = journal.insertId;

    
//     // INSERT COMPONENTS (CONSUMPTION)
//     for (const c of components) {
//       const totalquantity = finishedQty * c.qty
//       await conn.query(
//         `INSERT INTO manufacturing_components 
//         (journalId, companyId, itemName, godown, qty,totalquantity, rate, amount) 
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//         [
//           journalId,
//           companyId,
//           c.itemName,
//           c.godown,
//           c.qty,
//           totalquantity,
//           c.rate,
//           c.amount,
//         ]
//       );
//     }

//     // INSERT BY-PRODUCTS
//     for (const b of byProducts) {
//       await conn.query(
//         `INSERT INTO manufacturing_byproducts 
//         (journalId, companyId, itemName, godown, qty, rate, amount, pctOfCost) 
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//         [
//           journalId,
//           companyId,
//           b.itemName,
//           b.godown,
//           b.qty,
//           b.rate,
//           b.amount,
//           b.pctOfCost,
//         ]
//       );
//     }

//     await conn.commit();

//     res.json({
//       success: true,
//       message: "Manufacturing Journal saved successfully",
//       journalId,
//     });

//   } catch (error) {
//     await conn.rollback();
//     console.error(error);
//     res.status(500).json({ error: "Failed to save manufacturing journal" });
//   } finally {
//     conn.release();
//   }
// };


// export const getManufacturedItems = async (req, res) => {
//   const { companyId } = req.params;

//   try {
//     const [rows] = await pool.query(
//       `
//       SELECT 
//         mc.*, 
//         mj.productName,
//         mj.voucherNo,
//         mj.date,
//         mj.finishedQty,
//         mj.godown AS finishedGodown
//       FROM manufacturing_components mc
//       INNER JOIN manufacturing_journal mj 
//         ON mc.journalId = mj.id
//       WHERE mc.companyId = ?
//       ORDER BY mc.journalId DESC
//       `,
//       [companyId]
//     );

//     res.status(200).json({
//       success: true,
//       message: "Manufactured items fetched successfully",
//       data: rows
//     });

//   } catch (error) {
//     console.error("GET MANUFACTURED ITEMS ERROR:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch manufactured items",
//     });
//   }
// };

export const createManufacturingJournal = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);

  const {
    voucherNo,
    date,
    productName,
    godown,
    finishedQty,
    costAllocation,
    costTracking,
    components,
    byProducts,
    addlCost,
    grandTotal,
    effectiveRatePerFinished,
    narration,
  } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await ensureCreatorColumns(conn, "manufacturing_journal");

    /* ===============================
       1️⃣ INSERT MANUFACTURING JOURNAL
       =============================== */
    const [journal] = await conn.query(
      `INSERT INTO manufacturing_journal 
      (companyId, voucherNo, date, productName, godown, finishedQty, costAllocation, costTracking, addlCost, grandTotal, effectiveRatePerFinished, narration, created_by_user_id, created_by_employee_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        voucherNo,
        date,
        productName,
        godown,
        finishedQty,
        costAllocation,
        costTracking,
        addlCost,
        grandTotal,
        effectiveRatePerFinished,
        narration,
        creator.userId,
        creator.employeeId,
      ]
    );
console.log(req.body);

    const journalId = journal.insertId;

    /* ==================================
       2️⃣ CONSUME RAW MATERIAL STOCK
       ================================== */
    for (const c of components) {
    const totalQuantity =
  (Number(finishedQty) || 0) *
  (Number(c.qty) || 0);

      // Insert component consumption
      await conn.query(
        `INSERT INTO manufacturing_components 
        (journalId, companyId, itemName, godown, qty, totalquantity, rate, amount) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          journalId,
          companyId,
          c.itemName,
          c.godown,
        Number(c.qty) || 0,
Number(totalQuantity) || 0,
Number(c.rate) || 0,
Number(c.amount) || 0,
        ]
      );

      // 🔻 Reduce stock
      const [stock] = await conn.query(
        `SELECT openingBalanceQty FROM stocks 
         WHERE companyId = ? AND name = ? FOR UPDATE`,
        [companyId, c.itemName]
      );

      if (!stock.length || stock[0].openingBalanceQty < totalQuantity) {
        throw new Error(`Insufficient stock for ${c.itemName}`);
      }

      await conn.query(
        `UPDATE stocks 
         SET openingBalanceQty = openingBalanceQty - ? 
         WHERE companyId = ? AND name = ?`,
      [
  Number(totalQuantity) || 0,
  companyId,
  c.itemName
]
      );
    }

    /* ==========================
       3️⃣ ADD FINISHED GOODS
       ========================== */
    const [fgStock] = await conn.query(
      `SELECT id FROM stocks 
       WHERE companyId = ? AND name = ?`,
      [companyId, productName]
    );

  
      // Increase stock
      // await conn.query(
      //   `UPDATE stocks 
      //    SET openingBalanceQty = openingBalanceQty + ? 
      //    WHERE companyId = ? AND name = ?`,
      //   [finishedQty, companyId, productName]
      // );
    

    /* ==========================
       4️⃣ BY-PRODUCTS STOCK
       ========================== */
    for (const b of byProducts) {
      await conn.query(
        `INSERT INTO manufacturing_byproducts 
        (journalId, companyId, itemName, godown, qty, rate, amount, pctOfCost) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          journalId,
          companyId,
          b.itemName,
          b.godown,
          b.qty,
          b.rate,
          b.amount,
          b.pctOfCost,
        ]
      );

      await conn.query(
        `UPDATE stocks 
         SET openingBalanceQty = openingBalanceQty + ? 
         WHERE companyId = ? AND name = ?`,
        [b.qty, companyId, b.itemName]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Manufacturing Journal saved & stock updated",
      journalId,
    });

  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

export const getManufacturedItems = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      // `
      // SELECT 
      //   mc.*, 
      //   mj.productName,
      //   mj.voucherNo,
      //   mj.date,
      //   mj.finishedQty,
      //   mj.godown AS finishedGodown
      // FROM manufacturing_components mc
      // INNER JOIN manufacturing_journal mj 
      //   ON mc.journalId = mj.id
      // WHERE mc.companyId = ?
      // ORDER BY mc.journalId DESC
      // `,
      `SELECT * FROM manufacturing_journal WHERE companyId = ?`,
      [companyId]
    );
console.log(rows);

    res.status(200).json({
      success: true,
      message: "Manufactured items fetched successfully",
      data: rows
    });

  } catch (error) {
    console.error("GET MANUFACTURED ITEMS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch manufactured items",
    });
  }
};


export const getManufacturingList = async (req, res) => {
  const { companyId } = req.params;

  try {
    // Fetch all journals for the company
    const [journals] = await pool.query(
      `SELECT * FROM manufacturing_journal WHERE companyId = ? ORDER BY date DESC, id DESC`,
      [companyId]
    );

    // For each journal, fetch associated components and by-products
    const detailedJournals = await Promise.all(
      journals.map(async (j) => {
        const [components] = await pool.query(
          `SELECT * FROM manufacturing_components WHERE journalId = ?`,
          [j.id]
        );
        const [byProducts] = await pool.query(
          `SELECT * FROM manufacturing_byproducts WHERE journalId = ?`,
          [j.id]
        );
        return { ...j, components, byProducts };
      })
    );

    res.status(200).json({
      success: true,
      data: detailedJournals,
    });
  } catch (error) {
    console.error("GET MANUFACTURING LIST ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch manufacturing journals",
    });
  }
};

export const getManufacturingById = async (req, res) => {
  const { id } = req.params;
  try {
    const [journal] = await pool.query(`SELECT * FROM manufacturing_journal WHERE id = ?`, [id]);
    if (journal.length === 0) return res.status(404).json({ success: false, message: "Journal not found" });

    const [components] = await pool.query(`SELECT * FROM manufacturing_components WHERE journalId = ?`, [id]);
    const [byProducts] = await pool.query(`SELECT * FROM manufacturing_byproducts WHERE journalId = ?`, [id]);

    res.status(200).json({
      success: true,
      data: { ...journal[0], components, byProducts }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteManufacturingJournal = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch details for stock reversal
    const [journal] = await conn.query(`SELECT * FROM manufacturing_journal WHERE id = ?`, [id]);
    if (journal.length === 0) throw new Error("Journal not found");
    const { companyId } = journal[0];

    const [components] = await conn.query(`SELECT * FROM manufacturing_components WHERE journalId = ?`, [id]);
    const [byProducts] = await conn.query(`SELECT * FROM manufacturing_byproducts WHERE journalId = ?`, [id]);

    // 2. Reverse stock adjustments
    // Add back components (consumption)
    for (const c of components) {
      await conn.query(
        `UPDATE stocks SET openingBalanceQty = openingBalanceQty + ? WHERE companyId = ? AND name = ?`,
        [c.qty, companyId, c.itemName]
      );
    }
    // Subtract by-products
    for (const b of byProducts) {
      await conn.query(
        `UPDATE stocks SET openingBalanceQty = openingBalanceQty - ? WHERE companyId = ? AND name = ?`,
        [b.qty, companyId, b.itemName]
      );
    }

    // 3. Delete records
    await conn.query(`DELETE FROM manufacturing_byproducts WHERE journalId = ?`, [id]);
    await conn.query(`DELETE FROM manufacturing_components WHERE journalId = ?`, [id]);
    await conn.query(`DELETE FROM manufacturing_journal WHERE id = ?`, [id]);

    await conn.commit();
    res.json({ success: true, message: "Manufacturing Journal deleted successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

export const updateManufacturingJournal = async (req, res) => {
  const { id } = req.params;
  const {
    voucherNo, date, productName, batchName, mfgDate, expDate, godown, finishedQty, costAllocation, costTracking,
    components, byProducts, additionalCosts, addlCost, addlCostType, addlCostPct, grandTotal, effectiveRatePerFinished, narration
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Reverse old stock
    const [oldJournal] = await conn.query(`SELECT * FROM manufacturing_journal WHERE id = ?`, [id]);
    const { companyId } = oldJournal[0];
    const [oldComponents] = await conn.query(`SELECT * FROM manufacturing_components WHERE journalId = ?`, [id]);
    const [oldByProducts] = await conn.query(`SELECT * FROM manufacturing_byproducts WHERE journalId = ?`, [id]);

    for (const c of oldComponents) {
      await conn.query(`UPDATE stocks SET openingBalanceQty = openingBalanceQty + ? WHERE companyId = ? AND name = ?`, [c.qty, companyId, c.itemName]);
    }
    for (const b of oldByProducts) {
      await conn.query(`UPDATE stocks SET openingBalanceQty = openingBalanceQty - ? WHERE companyId = ? AND name = ?`, [b.qty, companyId, b.itemName]);
    }

    // 2. Update Journal Header
    const fQty = parseFloat(finishedQty) || 0;
    const gTotal = parseFloat(grandTotal) || 0;
    const aCost = parseFloat(addlCost) || 0;
    const effRate = parseFloat(effectiveRatePerFinished) || 0;

    await conn.query(
      `UPDATE manufacturing_journal SET 
        voucherNo=?, date=?, productName=?, batchName=?, mfgDate=?, expDate=?, godown=?, finishedQty=?, costAllocation=?, 
        costTracking=?, addlCost=?, addlCostType=?, addlCostPct=?, additionalCosts=?, grandTotal=?, effectiveRatePerFinished=?, narration=?
      WHERE id=?`,
      [voucherNo, date, productName, batchName, mfgDate, expDate, godown, fQty, costAllocation, costTracking, aCost, addlCostType, addlCostPct, JSON.stringify(additionalCosts || []), gTotal, effRate, narration, id]
    );

    // 3. Replace components & byproducts
    await conn.query(`DELETE FROM manufacturing_components WHERE journalId = ?`, [id]);
    await conn.query(`DELETE FROM manufacturing_byproducts WHERE journalId = ?`, [id]);

    for (const c of components) {
      const cQty = parseFloat(c.qty) || 0;
      const totalQuantity = fQty * cQty;
      await conn.query(
        `INSERT INTO manufacturing_components (journalId, companyId, itemName, godown, qty, totalquantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, companyId, c.itemName, c.godown, cQty, totalQuantity, parseFloat(c.rate), parseFloat(c.amount)]
      );
      await conn.query(`UPDATE stocks SET openingBalanceQty = openingBalanceQty - ? WHERE companyId = ? AND name = ?`, [cQty, companyId, c.itemName]);
    }

    for (const b of byProducts) {
      const bQty = parseFloat(b.qty) || 0;
      await conn.query(
        `INSERT INTO manufacturing_byproducts (journalId, companyId, itemName, godown, qty, rate, amount, pctOfCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, companyId, b.itemName, b.godown, bQty, parseFloat(b.rate), parseFloat(b.amount), parseFloat(b.pctOfCost)]
      );
      await conn.query(`UPDATE stocks SET openingBalanceQty = openingBalanceQty + ? WHERE companyId = ? AND name = ?`, [bQty, companyId, b.itemName]);
    }

    await conn.commit();
    res.json({ success: true, message: "Manufacturing Journal updated successfully" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

export const generateManufacturingPDF_Doc = async (req, res) => {
  res.status(500).json({ success: false, message: "PDF generation not implemented locally" });
};
