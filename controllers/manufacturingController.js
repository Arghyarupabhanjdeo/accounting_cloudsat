
import pool from "../db.js";

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

    /* ===============================
       1️⃣ INSERT MANUFACTURING JOURNAL
       =============================== */
    const [journal] = await conn.query(
      `INSERT INTO manufacturing_journal 
      (companyId, voucherNo, date, productName, godown, finishedQty, costAllocation, costTracking, addlCost, grandTotal, effectiveRatePerFinished, narration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );
console.log(req.body);

    const journalId = journal.insertId;

    /* ==================================
       2️⃣ CONSUME RAW MATERIAL STOCK
       ================================== */
    for (const c of components) {
      const totalQuantity = finishedQty * c.qty;

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
          c.qty,
          totalQuantity,
          c.rate,
          c.amount,
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
        [c.qty, companyId, c.itemName]
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
