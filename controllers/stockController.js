import pool from "../db.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

export const createStockList = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);
  try {
    const {
      name,
      alias,
      under,
      units,
      maintainInBatches,
      trackDateOfManufacture,
      expiryDateOfBatches,
      rateOfDuty,
      gstApplicable,
      hsn,
      openingBalanceQty,
      openingBalanceRate,
      openingBalanceValue,
    } = req.body;

    // Validation
    if (!companyId || !name || !under) {
      return res.status(400).json({
        success: false,
        message: "companyId, name, and under are required fields.",
      });
    }
    await ensureCreatorColumns(pool, "stocks");

    // Insert Query
    const [result] = await pool.query(
      `INSERT INTO stocks 
      (
        companyId,
        name,
        alias,
        under,
        units,
        maintainInBatches,
        trackDateOfManufacture,
        expiryDateOfBatches,
        rateOfDuty,
        gstApplicable,
        hsn,
        openingBalanceQty,
        openingBalanceRate,
        openingBalanceValue,
        created_by_user_id,
        created_by_employee_id
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        name,
        alias || "",
        under,
        units,
        maintainInBatches,
        trackDateOfManufacture,
        expiryDateOfBatches,
        rateOfDuty,
        gstApplicable,
        hsn,
        openingBalanceQty,
        openingBalanceRate,
        openingBalanceValue,
        creator.userId,
        creator.employeeId,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Stock item created successfully",
      stockId: result.insertId,
    });
  } catch (error) {
    console.log("Error inserting stock list:", error);
    return res.status(500).json({
      success: false,
      message: "Database error",
      error: error.message,
    });
  }
};

export const getStocks = async (req, res) => {
  const { companyId } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "Missing CompanyId" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM stocks WHERE companyId = ? and isdeleted = 0 ORDER BY id DESC`,
      [companyId]
    );

    res.status(200).json({
      message: "Data fetched successfully",
      data: rows,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching stocks",
      error: error.message,
    });
  }
};

export const updateStocks = async (req, res) => {
  const { companyId } = req.params;
  const { stockId } = req.params;

  if (!companyId || !stockId) {
    return res.status(400).json({
      success: false,
      message: "companyId and stockId are required",
    });
  }

  try {
    const {
      name,
      alias,
      under,
      units,
      maintainInBatches,
      trackDateOfManufacture,
      expiryDateOfBatches,
      rateOfDuty,
      gstApplicable,
      hsn,
      openingBalanceQty,
      openingBalanceRate,
      openingBalanceValue,
    } = req.body;

    // Update Query
    const [result] = await pool.query(
      `
      UPDATE stocks SET
        name = ?, 
        alias = ?, 
        under = ?, 
        units = ?, 
        maintainInBatches = ?, 
        trackDateOfManufacture = ?, 
        expiryDateOfBatches = ?, 
        rateOfDuty = ?, 
        gstApplicable = ?, 
        hsn = ?, 
        openingBalanceQty = ?, 
        openingBalanceRate = ?, 
        openingBalanceValue = ?
      WHERE id = ? AND companyId = ?
      `,
      [
        name,
        alias || "",
        under,
        units,
        maintainInBatches,
        trackDateOfManufacture,
        expiryDateOfBatches,
        rateOfDuty,
        gstApplicable,
        hsn,
        openingBalanceQty,
        openingBalanceRate,
        openingBalanceValue,
        stockId,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Stock item not found or companyId mismatch",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock item updated successfully",
    });

  } catch (error) {
    console.log("Error updating stock:", error);
    return res.status(500).json({
      success: false,
      message: "Database error while updating stock",
      error: error.message,
    });
  }
};

export const deleteStock = async (req, res) => {
  const { companyId, stockId } = req.params;

  if (!companyId || !stockId) {
    return res.status(400).json({
      success: false,
      message: "companyId and stockId are required",
    });
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE stocks
      SET isDeleted = 1
      WHERE id = ? AND companyId = ?
      `,
      [stockId, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Stock item not found or companyId mismatch",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock item deleted successfully",
    });
  } catch (error) {
    console.log("Error deleting stock:", error);
    return res.status(500).json({
      success: false,
      message: "Database error while deleting stock",
      error: error.message,
    });
  }
};

export const getAllStockNames = async (req, res) => {
  const { companyId } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "Missing CompanyId" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name FROM stocks WHERE companyId = ? AND isdeleted = 0 ORDER BY name ASC`,
      [companyId]
    );

    res.status(200).json({
      message: "Stock names fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching stock names",
      error: error.message,
    });
  }
};

export const getAllHSN = async (req, res) => {
  const { companyId } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "Missing CompanyId" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, hsn FROM stocks WHERE companyId = ? AND isdeleted = 0 AND hsn IS NOT NULL AND hsn != '' ORDER BY hsn ASC`,
      [companyId]
    );

    res.status(200).json({
      message: "HSN data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching HSN data",
      error: error.message,
    });
  }
};




export const getStockSummary = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);

  if (!companyId) {
    return res.status(400).json({ message: "Missing CompanyId" });
  }

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
    // We get all stocks for the company
    const [stocks] = await pool.query(
      `SELECT * FROM stocks WHERE companyId = ? and isdeleted = 0`,
      [companyId]
    );

    // Get Purchases
    const [purchases] = await pool.query(
      `SELECT i.item_name, SUM(i.qty) as totalQty, SUM(i.amount) as totalValue
       FROM purchase_voucher_items i
       JOIN purchase_vouchers v ON i.voucher_id = v.id
       WHERE v.companyId = ? ${extraCondition.replace(/created_by/g, 'v.created_by')}
       GROUP BY i.item_name`,
      [companyId, ...extraParams]
    );

    // Get Sales
    const [sales] = await pool.query(
      `SELECT i.item as item_name, SUM(i.qty) as totalQty, SUM(i.amount) as totalValue
       FROM sales_items i
       JOIN sales_vouchers v ON i.voucherId = v.id
       WHERE v.companyId = ? ${extraCondition.replace(/created_by/g, 'v.created_by')}
       GROUP BY i.item`,
      [companyId, ...extraParams]
    );

    // Get Debit Notes (Purchase Returns)
    const [debitNotes] = await pool.query(
      `SELECT i.itemName as item_name, SUM(i.qty) as totalQty, SUM(i.amount) as totalValue
       FROM note_items i
       JOIN notes v ON i.noteId = v.id
       WHERE v.companyId = ? AND v.note_type = 'debit' ${extraCondition.replace(/created_by/g, 'v.created_by')}
       GROUP BY i.itemName`,
      [companyId, ...extraParams]
    );

    // Get Credit Notes (Sales Returns)
    const [creditNotes] = await pool.query(
      `SELECT i.itemName as item_name, SUM(i.qty) as totalQty, SUM(i.amount) as totalValue
       FROM note_items i
       JOIN notes v ON i.noteId = v.id
       WHERE v.companyId = ? AND v.note_type = 'credit' ${extraCondition.replace(/created_by/g, 'v.created_by')}
       GROUP BY i.itemName`,
      [companyId, ...extraParams]
    );

    const purchaseMap = {};
    purchases.forEach(p => { purchaseMap[p.item_name] = p; });

    const salesMap = {};
    sales.forEach(s => { salesMap[s.item_name] = s; });

    const debitMap = {};
    debitNotes.forEach(d => { debitMap[d.item_name] = d; });

    const creditMap = {};
    creditNotes.forEach(c => { creditMap[c.item_name] = c; });

    const stockSummary = stocks.map(stock => {
      const p = purchaseMap[stock.name] || { totalQty: 0, totalValue: 0 };
      const s = salesMap[stock.name] || { totalQty: 0, totalValue: 0 };
      const d = debitMap[stock.name] || { totalQty: 0, totalValue: 0 };
      const c = creditMap[stock.name] || { totalQty: 0, totalValue: 0 };

      const openingQty = parseFloat(stock.openingBalanceQty) || 0;
      const openingRate = parseFloat(stock.openingBalanceRate) || 0;
      const openingValue = parseFloat(stock.openingBalanceValue) || 0;

      const inwardsQty = parseFloat(p.totalQty) + parseFloat(c.totalQty);
      const inwardsValue = parseFloat(p.totalValue) + parseFloat(c.totalValue);

      const outwardsQty = parseFloat(s.totalQty) + parseFloat(d.totalQty);
      const outwardsValue = parseFloat(s.totalValue) + parseFloat(d.totalValue);

      const closingQty = openingQty + inwardsQty - outwardsQty;

      // Calculate closing value (simplified weighted average or just net value)
      // Standard: closing value = opening value + inwards value - outwards value
      let closingValue = openingValue + inwardsValue - outwardsValue;
      if (closingQty === 0) closingValue = 0; // handle negative or zero values if qty is 0

      let closingRate = closingQty !== 0 ? closingValue / closingQty : 0;

      if (closingRate < 0 && closingQty > 0) {
        // Fallback if values become negative due to sales at higher prices
        closingRate = openingRate || (p.totalQty > 0 ? p.totalValue / p.totalQty : 0);
        closingValue = closingQty * closingRate;
      }

      return {
        ...stock,
        id: stock.id,
        name: stock.name,
        group: stock.under,
        units: stock.units,
        openingQty,
        openingRate,
        openingValue,
        inwardsQty,
        inwardsValue,
        outwardsQty,
        outwardsValue,
        closingQty,
        closingRate: Math.abs(closingRate),
        closingValue: Math.abs(closingValue)
      };
    });

    res.status(200).json({
      message: "Stock summary fetched successfully",
      data: stockSummary,
    });

  } catch (error) {
    console.error("Error fetching stock summary:", error);
    res.status(500).json({
      message: "Server error while fetching stock summary",
      error: error.message,
    });
  }
};


