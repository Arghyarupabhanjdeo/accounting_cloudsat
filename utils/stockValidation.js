import pool from "../db.js";

export const validateStockAvailability = async (companyId, items, creator) => {
  const connection = await pool.getConnection();
  try {
    for (const sold of items) {
      const soldQty = Number(sold.qty);

      const [mjStockResult] = await connection.query(
        `SELECT SUM(finishedQty) AS totalQty FROM manufacturing_journal WHERE companyId = ? AND LOWER(productName) = LOWER(?)`, 
        [companyId, sold.item]
      );
      const [tradingStockResult] = await connection.query(
        `SELECT SUM(openingBalanceQty) AS totalQty FROM stocks WHERE companyId = ? AND LOWER(name) = LOWER(?) AND isDeleted = 0`, 
        [companyId, sold.item]
      );

      const mjAvailable = parseFloat(mjStockResult[0]?.totalQty || 0);
      const tradingAvailable = parseFloat(tradingStockResult[0]?.totalQty || 0);
      const totalAvailable = mjAvailable + tradingAvailable;

      if (totalAvailable < soldQty) {
        throw new Error(
          `Insufficient stock for "${sold.item}". Available: ${totalAvailable} (MJ: ${mjAvailable}, Trading: ${tradingAvailable}), Required: ${soldQty}`
        );
      }
    }
  } finally {
    connection.release();
  }
};
