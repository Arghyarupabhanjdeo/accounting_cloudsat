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
      `SELECT * FROM stocks WHERE companyId = ? and isdeleted = 0`,
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


