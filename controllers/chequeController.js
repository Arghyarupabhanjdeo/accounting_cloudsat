// controllers/chequeController.js
import pool from '../db.js';
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";
// import { isValidDateString } from '../utils/validators.js'; // small helper (I'll include below)


export const createCheque = async (req, res) => {
  const { companyId } = req.params;
  const data = req.body;
  const creator = getCreatorFromRequest(req);

  // Basic server-side validation
  if (!data.chequeNumber || !data.amount) {
    return res.status(400).json({ success: false, message: 'chequeNumber and amount are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensureCreatorColumns(conn, "cheques");

    const q = `INSERT INTO cheques
      (companyId, chequeNumber, chequeDate, chequeType, amount, amountInWords, payeeName, payeeAddress, payeeContact, payeePAN,
       bankId, bankName, branchName, accountNumber, ifscCode, dateIssued, datePresented, dateCleared, status, statusDate,
       purpose, referenceNumber, narration, tdsDeducted, tdsAmount, attachmentUrl, chequeImage, createdBy, created_by_user_id, created_by_employee_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      companyId,
      data.chequeNumber,
      data.chequeDate || null,
      data.chequeType || 'issued',
      parseFloat(data.amount || 0),
      data.amountInWords || null,
      data.payeeName || null,
      data.payeeAddress || null,
      data.payeeContact || null,
      data.payeePAN || null,
      data.bankId || null,
      data.bankName || null,
      data.branchName || null,
      data.accountNumber || null,
      data.ifscCode || null,
      data.dateIssued || null,
      data.datePresented || null,
      data.dateCleared || null,
      data.status || 'pending',
      data.statusDate || null,
      data.purpose || null,
      data.referenceNumber || null,
      data.narration || null,
      data.tdsDeducted ? parseFloat(data.tdsDeducted) : 0,
      data.tdsAmount ? parseFloat(data.tdsAmount) : 0,
      data.attachmentUrl || null,
      data.chequeImage || null,
      data.createdBy || null,
      creator.userId,
      creator.employeeId
    ];

    const [result] = await conn.query(q, values);
    const insertedId = result.insertId;

    // Optionally: if cheque created with status 'cleared' and bankId present, update bank balance
    if (data.status === 'cleared' && data.bankId) {
      // If issued cheque -> reduce bank balance, if received -> increase
      const delta = data.chequeType === 'received' ? parseFloat(data.amount) : -parseFloat(data.amount);
      await conn.query(
        `UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`,
        [delta, data.bankId]
      );
    }

    await conn.commit();

    const [rows] = await pool.query(`SELECT * FROM cheques WHERE id = ?`, [insertedId]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await conn.rollback();
    console.error('createCheque err', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
};

/**
 * Get all cheques for a company (with optional filters)
 * GET /api/v1/cheque/:companyId/all?status=&type=&q=&limit=&offset=
 */
export const getChequesForCompany = async (req, res) => {
  const { companyId } = req.params;
  const { status, type, q, limit = 100, offset = 0 } = req.query;

  try {
    let where = 'WHERE companyId = ?';
    const params = [companyId];

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    if (type) {
      where += ' AND chequeType = ?';
      params.push(type);
    }

    if (q) {
      where += ' AND (chequeNumber LIKE ? OR payeeName LIKE ? OR referenceNumber LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const sql = `SELECT * FROM cheques ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error('getChequesForCompany', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get single cheque by id
 * GET /api/v1/cheque/:id
 */
export const getChequeById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`SELECT * FROM cheques WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Cheque not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getChequeById', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Update cheque
 * PUT /api/v1/cheque/:id/update
 */
export const updateCheque = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // fetch existing row for diff logic
    const [existingRows] = await conn.query(`SELECT * FROM cheques WHERE id = ?`, [id]);
    if (!existingRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Cheque not found' });
    }
    const existing = existingRows[0];

    // Update row
    const updateQ = `UPDATE cheques SET
      chequeNumber=?, chequeDate=?, chequeType=?, amount=?, amountInWords=?, payeeName=?, payeeAddress=?, payeeContact=?, payeePAN=?,
      bankId=?, bankName=?, branchName=?, accountNumber=?, ifscCode=?, dateIssued=?, datePresented=?, dateCleared=?, status=?, statusDate=?,
      purpose=?, referenceNumber=?, narration=?, tdsDeducted=?, tdsAmount=?, attachmentUrl=?, chequeImage=?, updatedAt=NOW()
      WHERE id = ?`;

    const values = [
      data.chequeNumber || existing.chequeNumber,
      data.chequeDate || existing.chequeDate,
      data.chequeType || existing.chequeType,
      data.amount !== undefined ? parseFloat(data.amount) : existing.amount,
      data.amountInWords || existing.amountInWords,
      data.payeeName || existing.payeeName,
      data.payeeAddress || existing.payeeAddress,
      data.payeeContact || existing.payeeContact,
      data.payeePAN || existing.payeePAN,
      data.bankId || existing.bankId,
      data.bankName || existing.bankName,
      data.branchName || existing.branchName,
      data.accountNumber || existing.accountNumber,
      data.ifscCode || existing.ifscCode,
      data.dateIssued || existing.dateIssued,
      data.datePresented || existing.datePresented,
      data.dateCleared || existing.dateCleared,
      data.status || existing.status,
      data.statusDate || existing.statusDate,
      data.purpose || existing.purpose,
      data.referenceNumber || existing.referenceNumber,
      data.narration || existing.narration,
      data.tdsDeducted !== undefined ? parseFloat(data.tdsDeducted) : existing.tdsDeducted,
      data.tdsAmount !== undefined ? parseFloat(data.tdsAmount) : existing.tdsAmount,
      data.attachmentUrl || existing.attachmentUrl,
      data.chequeImage || existing.chequeImage,
      id
    ];

    await conn.query(updateQ, values);

    // If status changed from non-cleared -> cleared (or vice-versa), adjust bank balance
    const oldStatus = existing.status;
    const newStatus = data.status || existing.status;
    const bankId = data.bankId || existing.bankId;
    const oldAmount = parseFloat(existing.amount || 0);
    const newAmount = data.amount !== undefined ? parseFloat(data.amount) : oldAmount;

    if (oldStatus !== 'cleared' && newStatus === 'cleared' && bankId) {
      // apply delta once
      const delta = (existing.chequeType === 'received' ? newAmount : -newAmount);
      await conn.query(`UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`, [delta, bankId]);
    } else if (oldStatus === 'cleared' && newStatus !== 'cleared' && bankId) {
      // rollback previous clear effect
      const delta = (existing.chequeType === 'received' ? -oldAmount : oldAmount);
      await conn.query(`UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`, [delta, bankId]);
    } else if (oldStatus === 'cleared' && newStatus === 'cleared' && bankId && newAmount !== oldAmount) {
      // amount changed while cleared; adjust by difference
      const diff = (existing.chequeType === 'received' ? (newAmount - oldAmount) : (oldAmount - newAmount));
      await conn.query(`UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`, [diff, bankId]);
    }

    await conn.commit();

    const [updatedRows] = await pool.query(`SELECT * FROM cheques WHERE id = ?`, [id]);
    res.json({ success: true, data: updatedRows[0] });
  } catch (err) {
    await conn.rollback();
    console.error('updateCheque', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
};

/**
 * Delete cheque
 * DELETE /api/v1/cheque/:id/delete
 */
export const deleteCheque = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // If cheque was 'cleared' and linked to bank account, optionally rollback balance
    const [rows] = await conn.query(`SELECT * FROM cheques WHERE id = ?`, [id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Cheque not found' });
    }
    const ch = rows[0];

    if (ch.status === 'cleared' && ch.bankId) {
      // reverse cleared effect
      const delta = (ch.chequeType === 'received' ? -ch.amount : ch.amount);
      await conn.query(`UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`, [delta, ch.bankId]);
    }

    await conn.query(`DELETE FROM cheques WHERE id = ?`, [id]);
    await conn.commit();
    res.json({ success: true, message: 'Cheque deleted' });
  } catch (err) {
    await conn.rollback();
    console.error('deleteCheque', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
};

/**
 * Change status quickly (endpoint)
 * POST /api/v1/cheque/:id/change-status
 * body: { status: 'cleared'|'bounced'|'pending'|'cancelled', statusDate: 'YYYY-MM-DD' }
 */
export const changeChequeStatus = async (req, res) => {
  const { id } = req.params;
  const { status, statusDate } = req.body;

  if (!status) return res.status(400).json({ success: false, message: 'status required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(`SELECT * FROM cheques WHERE id = ?`, [id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Cheque not found' });
    }
    const ch = rows[0];

    // update cheque
    await conn.query(`UPDATE cheques SET status = ?, statusDate = ?, updatedAt = NOW() WHERE id = ?`, [status, statusDate || null, id]);

    // adjust bank balance on status transitions
    if (ch.bankId) {
      if (ch.status !== 'cleared' && status === 'cleared') {
        // apply effect
        const delta = (ch.chequeType === 'received' ? ch.amount : -ch.amount);
        await conn.query(`UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`, [delta, ch.bankId]);
      } else if (ch.status === 'cleared' && status !== 'cleared') {
        // rollback
        const delta = (ch.chequeType === 'received' ? -ch.amount : ch.amount);
        await conn.query(`UPDATE bank_accounts SET currentBalance = currentBalance + ? WHERE id = ?`, [delta, ch.bankId]);
      }
    }

    await conn.commit();
    const [updated] = await pool.query(`SELECT * FROM cheques WHERE id = ?`, [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    await conn.rollback();
    console.error('changeChequeStatus', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
};

// cheque register 
export const addCheque = async (req, res) => {
  const {companyId} = req.params ;
   const {chequeNo, chequeBookNumber ,status,type,amount ,dateIssued ,payeeName, remarks } = req.body;
   const creator = getCreatorFromRequest(req);
  try {
    await ensureCreatorColumns(pool, "chequeslist");
    await pool.query(`INSERT INTO chequeslist
    (companyId, chequeNo, chequeBookNumber, status, type, amount, date_issued, payeeName, remarks, created_by_user_id, created_by_employee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [companyId, chequeNo, chequeBookNumber ,status,type,amount ,dateIssued ,payeeName, remarks, creator.userId, creator.employeeId ]);
    res.json({ success: true, message: 'Cheque added to register successfully' });
  } catch (error) {
    console.log(error);
    
  }
}

export  const getChequeList = async (req, res) => {
  const {companyId} = req.params ;  
  try {
    const [rows] = await pool.query(`SELECT * FROM chequeslist WHERE companyId = ?`, [companyId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const updateChequeList = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const updateQ = `UPDATE chequeslist SET
      chequeNo=?, chequeBookNumber=?, status=?, type=?, amount=?, date_issued=?, payeeName=?, remarks=?
      WHERE id = ?`;  
    const values = [
      data.chequeNumber,
      data.chequeBookNumber,
      data.status,
      data.type,
      data.amount,
      data.dateIssued,
      data.payeeName,
      data.remarks,
      id
    ];
    await pool.query(updateQ, values);
    const [updatedRows] = await pool.query(`SELECT * FROM chequeslist WHERE id = ?`, [id]);
    res.json({ success: true, data: updatedRows[0] });
  }
    catch (err) {
    console.error('updateChequeList', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
  
export const deleteChequeList = async (req, res) => {
  const { id } = req.params;
  console.log("Deleting Cheque ID:", id);

  try {
    const [result] = await pool.query(
      `DELETE FROM chequeslist WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Cheque not found" });
    }

    res.status(200).json({
      success: true,
      message: "Cheque deleted from register"
    });

  } catch (err) {
    console.error("deleteChequeList Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
