import pool from "../db.js";
import { generateNotePDF } from "../utils/notePdf.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

export const createDebitNote = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);
  try {
    await ensureCreatorColumns(pool, "notes");
    const {
      voucherNo, date, partyLedger, purchaseLedger, partyDetails, dispatchDetails, consignorDetails = {}, narration, items,
      subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required" });
    }

    const [note] = await pool.query(
      `INSERT INTO notes 
       (companyId, voucherNo, date, PartyLedger, PurchaseLedger, narration, note_type,
        mailingName, address, state, country, pincode, gstRegistrationType, gstin, placeOfSupply,
        deliveryNoteNo, deliveryNoteDate, paymentTerms, otherReferences, referenceNo, referenceDate, 
        buyerOrderNo, buyerOrderDate, dispatchDocNo, dispatchedThrough, destination, carrierName, 
        billOfLading, billOfLadingDate, motorVehicleNo, dispatchDate, termsOfDelivery,
        consigneeSameAsBilling, consigneeName, consigneeGSTIN, consigneeAddress, consigneeState, 
        subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total,
        consignorName, consignorGSTIN, consignorState, consignorPincode, consignorAddress, consignorEmail,
        created_by_user_id, created_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, "debit", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, voucherNo, date, partyLedger || null, purchaseLedger || null, narration,
        partyDetails?.mailingName, partyDetails?.address, partyDetails?.state, partyDetails?.country, partyDetails?.pincode,
        partyDetails?.gstRegistrationType, partyDetails?.gstin, partyDetails?.placeOfSupply,
        dispatchDetails?.deliveryNoteNo || null, dispatchDetails?.originalInvoiceDate || null, dispatchDetails?.originalInvoiceNo || null,
        dispatchDetails?.otherReferences || null, dispatchDetails?.referenceNo || null, dispatchDetails?.referenceDate || null,
        dispatchDetails?.buyerOrderNo || null, dispatchDetails?.buyerOrderDate || null, dispatchDetails?.dispatchDocNo || null,
        dispatchDetails?.dispatchedThrough || null, dispatchDetails?.destination || null, dispatchDetails?.carrierName || null,
        dispatchDetails?.billOfLading || null, dispatchDetails?.billOfLadingDate || null, dispatchDetails?.motorVehicleNo || null,
        dispatchDetails?.dispatchDate || null, dispatchDetails?.termsOfDelivery || null,
        dispatchDetails?.consigneeSameAsBilling ? 1 : 0, dispatchDetails?.consigneeName, dispatchDetails?.consigneeGSTIN,
        dispatchDetails?.consigneeAddress, dispatchDetails?.consigneeState,
        subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total,
        consignorDetails?.consignorName || null, consignorDetails?.consignorGSTIN || null, consignorDetails?.consignorState || null,
        consignorDetails?.consignorPincode || null, consignorDetails?.consignorAddress || null, consignorDetails?.consignorEmail || null,
        creator.userId, creator.employeeId
      ]
    );

    const noteId = note.insertId;

    for (const item of items) {
      const { itemName, hsn_code, qty, per, rate, discount, amount } = item;
      await pool.query(
        `INSERT INTO note_items (noteId, itemName, hsn_code, qty, per, rate, discount, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [noteId, itemName, hsn_code, qty, per, rate, discount, amount]
      );
    }

    return res.json({ success: true, message: "Debit note created successfully", noteId });
  } catch (error) {
    console.log("Debit Note Error:", error);
    return res.status(500).json({ success: false, message: "Error inserting debit note", error: error.message });
  }
};

export const getDebitNote = async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(`SELECT * FROM notes WHERE companyId = ? AND note_type = "debit" ORDER BY id DESC`, [companyId]);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createCreditNote = async (req, res) => {
  const { companyId } = req.params;
  const creator = getCreatorFromRequest(req);
  try {
    await ensureCreatorColumns(pool, "notes");
    const {
      voucherNo, date, partyLedger, purchaseLedger, partyDetails, dispatchDetails, consignorDetails = {}, narration, items,
      subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required" });
    }

    // Convert empty strings to null for date fields
    const sanitizeDate = (val) => !val || val === '' ? null : val;

    const [note] = await pool.query(
      `INSERT INTO notes 
       (companyId, voucherNo, date, PartyLedger, PurchaseLedger, narration, note_type,
        mailingName, address, state, country, pincode, gstRegistrationType, gstin, placeOfSupply,
        deliveryNoteNo, deliveryNoteDate, paymentTerms, otherReferences, referenceNo, referenceDate, 
        buyerOrderNo, buyerOrderDate, dispatchDocNo, dispatchedThrough, destination, carrierName, 
        billOfLading, billOfLadingDate, motorVehicleNo, dispatchDate, termsOfDelivery,
        consigneeSameAsBilling, consigneeName, consigneeGSTIN, consigneeAddress, consigneeState, 
        subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total,
        consignorName, consignorGSTIN, consignorState, consignorPincode, consignorAddress, consignorEmail,
        created_by_user_id, created_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, "credit", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, voucherNo, date, partyLedger || null, purchaseLedger || null, narration,
        partyDetails?.mailingName, partyDetails?.address, partyDetails?.state, partyDetails?.country, partyDetails?.pincode,
        partyDetails?.gstRegistrationType, partyDetails?.gstin, partyDetails?.placeOfSupply,
        dispatchDetails?.deliveryNoteNo || null, sanitizeDate(dispatchDetails?.originalInvoiceDate), dispatchDetails?.originalInvoiceNo || null,
        dispatchDetails?.otherReferences || null, dispatchDetails?.referenceNo || null, sanitizeDate(dispatchDetails?.referenceDate),
        dispatchDetails?.buyerOrderNo || null, sanitizeDate(dispatchDetails?.buyerOrderDate), dispatchDetails?.dispatchDocNo || null,
        dispatchDetails?.dispatchedThrough || null, dispatchDetails?.destination || null, dispatchDetails?.carrierName || null,
        dispatchDetails?.billOfLading || null, sanitizeDate(dispatchDetails?.billOfLadingDate), dispatchDetails?.motorVehicleNo || null,
        sanitizeDate(dispatchDetails?.dispatchDate), dispatchDetails?.termsOfDelivery || null,
        dispatchDetails?.consigneeSameAsBilling ? 1 : 0, dispatchDetails?.consigneeName, dispatchDetails?.consigneeGSTIN,
        dispatchDetails?.consigneeAddress, dispatchDetails?.consigneeState,
        subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total,
        consignorDetails?.consignorName || null, consignorDetails?.consignorGSTIN || null, consignorDetails?.consignorState || null,
        consignorDetails?.consignorPincode || null, consignorDetails?.consignorAddress || null, consignorDetails?.consignorEmail || null,
        creator.userId, creator.employeeId
      ]
    );

    const noteId = note.insertId;

    for (const item of items) {
      const { itemName, hsn_code, qty, per, rate, discount, amount } = item;
      await pool.query(
        `INSERT INTO note_items (noteId, itemName, hsn_code, qty, per, rate, discount, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [noteId, itemName, hsn_code, qty, per, rate, discount, amount]
      );
    }

    return res.json({ success: true, message: "Credit Note created successfully", noteId });
  } catch (error) {
    console.log("Credit Note Error:", error);
    return res.status(500).json({ success: false, message: "Error inserting credit note", error: error.message });
  }
};

export const getCreditNotes = async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(`SELECT * FROM notes WHERE companyId = ? AND note_type = "credit" ORDER BY id DESC`, [companyId]);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getNotePDF = async (req, res) => {
  const { noteId } = req.params;
  try {
    const [noteRows] = await pool.query(`SELECT * FROM notes WHERE id = ?`, [noteId]);
    if (noteRows.length === 0) return res.status(404).json({ success: false, message: "Note not found" });
    const note = noteRows[0];

    const [itemRows] = await pool.query(`SELECT * FROM note_items WHERE noteId = ?`, [noteId]);

    const [compRows] = await pool.query(`SELECT * FROM companies WHERE id = ?`, [note.companyId]);
    if (compRows.length === 0) return res.status(404).json({ success: false, message: "Company not found" });
    const company = compRows[0];

    const pdfData = {
      voucherNo: note.voucherNo,
      date: note.date,
      partyDetails: {
        mailingName: note.mailingName,
        address: note.address,
        state: note.state,
        gstin: note.gstin
      },
      dispatchDetails: {
        deliveryNoteNo: note.deliveryNoteNo,
        originalInvoiceDate: note.deliveryNoteDate,
        originalInvoiceNo: note.paymentTerms,
        referenceNo: note.referenceNo,
        referenceDate: note.referenceDate,
        otherReferences: note.otherReferences,
        buyerOrderNo: note.buyerOrderNo,
        buyerOrderDate: note.buyerOrderDate,
        dispatchDocNo: note.dispatchDocNo,
        dispatchedThrough: note.dispatchedThrough,
        destination: note.destination,
        carrierName: note.carrierName,
        billOfLading: note.billOfLading,
        billOfLadingDate: note.billOfLadingDate,
        motorVehicleNo: note.motorVehicleNo,
        dispatchDate: note.dispatchDate,
        termsOfDelivery: note.termsOfDelivery,
        consigneeSameAsBilling: note.consigneeSameAsBilling,
        consigneeName: note.consigneeName,
        consigneeGSTIN: note.consigneeGSTIN,
        consigneeAddress: note.consigneeAddress,
        consigneeState: note.consigneeState
      },
      items: itemRows,
      subtotal: note.subtotal,
      igst_rate: note.igst_rate,
      cgst_rate: note.cgst_rate,
      sgst_rate: note.sgst_rate,
      igst_amount: note.igst_amount,
      cgst_amount: note.cgst_amount,
      sgst_amount: note.sgst_amount,
      grand_total: note.grand_total,
      narration: note.narration,
      sender: {
        company_name: note.consignorName || company.name || "",
        address: note.consignorAddress || company.address || "",
        gst: note.consignorGSTIN || company.gstin || "",
        email: note.consignorEmail || company.email || "",
        phone: company.mobile || "",
        state: note.consignorState || company.state || ""
      }
    };

    const typeLabel = note.note_type.toUpperCase() + " NOTE";
    const fileName = `${note.note_type}_${note.voucherNo}_${Date.now()}.pdf`;
    const subDir = "notes";

    await generateNotePDF(pdfData, typeLabel, fileName, subDir);
    res.json({ success: true, pdfPath: `/uploads/${subDir}/${fileName}` });

  } catch (error) {
    console.error("PDF Error:", error);
    res.status(500).json({ success: false, message: "Error generating PDF", error: error.message });
  }
};

export const updateDebitNote = async (req, res) => {
  const { noteId } = req.params;
  try {
    const {
      voucherNo, date, partyLedger, purchaseLedger, partyDetails, dispatchDetails, consignorDetails = {}, narration, items,
      subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total
    } = req.body;

    // Convert empty strings to null for date fields
    const sanitizeDate = (val) => !val || val === '' ? null : val;

    await pool.query(
      `UPDATE notes SET 
        voucherNo=?, date=?, PartyLedger=?, PurchaseLedger=?, narration=?,
        mailingName=?, address=?, state=?, country=?, pincode=?, gstRegistrationType=?, gstin=?, placeOfSupply=?,
        deliveryNoteNo=?, deliveryNoteDate=?, paymentTerms=?, otherReferences=?, referenceNo=?, referenceDate=?, 
        buyerOrderNo=?, buyerOrderDate=?, dispatchDocNo=?, dispatchedThrough=?, destination=?, carrierName=?, 
        billOfLading=?, billOfLadingDate=?, motorVehicleNo=?, dispatchDate=?, termsOfDelivery=?,
        consigneeSameAsBilling=?, consigneeName=?, consigneeGSTIN=?, consigneeAddress=?, consigneeState=?, 
        subtotal=?, gst_amount=?, igst_rate=?, cgst_rate=?, sgst_rate=?, igst_amount=?, cgst_amount=?, sgst_amount=?, grand_total=?,
        consignorName=?, consignorGSTIN=?, consignorState=?, consignorPincode=?, consignorAddress=?, consignorEmail=?
      WHERE id = ?`,
      [
        voucherNo, date, partyLedger || null, purchaseLedger || null, narration,
        partyDetails?.mailingName, partyDetails?.address, partyDetails?.state, partyDetails?.country, partyDetails?.pincode,
        partyDetails?.gstRegistrationType, partyDetails?.gstin, partyDetails?.placeOfSupply,
        dispatchDetails?.deliveryNoteNo || null, sanitizeDate(dispatchDetails?.originalInvoiceDate), dispatchDetails?.originalInvoiceNo || null,
        dispatchDetails?.otherReferences || null, dispatchDetails?.referenceNo || null, sanitizeDate(dispatchDetails?.referenceDate),
        dispatchDetails?.buyerOrderNo || null, sanitizeDate(dispatchDetails?.buyerOrderDate), dispatchDetails?.dispatchDocNo || null,
        dispatchDetails?.dispatchedThrough || null, dispatchDetails?.destination || null, dispatchDetails?.carrierName || null,
        dispatchDetails?.billOfLading || null, sanitizeDate(dispatchDetails?.billOfLadingDate), dispatchDetails?.motorVehicleNo || null,
        sanitizeDate(dispatchDetails?.dispatchDate), dispatchDetails?.termsOfDelivery || null,
        dispatchDetails?.consigneeSameAsBilling ? 1 : 0, dispatchDetails?.consigneeName, dispatchDetails?.consigneeGSTIN,
        dispatchDetails?.consigneeAddress, dispatchDetails?.consigneeState,
        subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total,
        consignorDetails?.consignorName || null, consignorDetails?.consignorGSTIN || null, consignorDetails?.consignorState || null,
        consignorDetails?.consignorPincode || null, consignorDetails?.consignorAddress || null, consignorDetails?.consignorEmail || null,
        noteId
      ]
    );

    await pool.query(`DELETE FROM note_items WHERE noteId = ?`, [noteId]);
    for (const item of items) {
      const { itemName, hsn_code, qty, per, rate, discount, amount } = item;
      await pool.query(
        `INSERT INTO note_items (noteId, itemName, hsn_code, qty, per, rate, discount, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [noteId, itemName, hsn_code, qty, per, rate, discount, amount]
      );
    }

    return res.json({ success: true, message: "Debit note updated successfully" });
  } catch (error) {
    console.error("Update Debit Note Error:", error);
    return res.status(500).json({ success: false, message: "Error updating debit note", error: error.message });
  }
};

export const updateCreditNote = async (req, res) => {
  const { noteId } = req.params;
  try {
    const {
      voucherNo, date, partyLedger, purchaseLedger, partyDetails, dispatchDetails, consignorDetails = {}, narration, items,
      subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total
    } = req.body;

    // Convert empty strings to null for date fields
    const sanitizeDate = (val) => !val || val === '' ? null : val;

    await pool.query(
      `UPDATE notes SET 
        voucherNo=?, date=?, PartyLedger=?, PurchaseLedger=?, narration=?,
        mailingName=?, address=?, state=?, country=?, pincode=?, gstRegistrationType=?, gstin=?, placeOfSupply=?,
        deliveryNoteNo=?, deliveryNoteDate=?, paymentTerms=?, otherReferences=?, referenceNo=?, referenceDate=?, 
        buyerOrderNo=?, buyerOrderDate=?, dispatchDocNo=?, dispatchedThrough=?, destination=?, carrierName=?, 
        billOfLading=?, billOfLadingDate=?, motorVehicleNo=?, dispatchDate=?, termsOfDelivery=?,
        consigneeSameAsBilling=?, consigneeName=?, consigneeGSTIN=?, consigneeAddress=?, consigneeState=?, 
        subtotal=?, gst_amount=?, igst_rate=?, cgst_rate=?, sgst_rate=?, igst_amount=?, cgst_amount=?, sgst_amount=?, grand_total=?,
        consignorName=?, consignorGSTIN=?, consignorState=?, consignorPincode=?, consignorAddress=?, consignorEmail=?
      WHERE id = ?`,
      [
        voucherNo, date, partyLedger || null, purchaseLedger || null, narration,
        partyDetails?.mailingName, partyDetails?.address, partyDetails?.state, partyDetails?.country, partyDetails?.pincode,
        partyDetails?.gstRegistrationType, partyDetails?.gstin, partyDetails?.placeOfSupply,
        dispatchDetails?.deliveryNoteNo || null, sanitizeDate(dispatchDetails?.originalInvoiceDate), dispatchDetails?.originalInvoiceNo || null,
        dispatchDetails?.otherReferences || null, dispatchDetails?.referenceNo || null, sanitizeDate(dispatchDetails?.referenceDate),
        dispatchDetails?.buyerOrderNo || null, sanitizeDate(dispatchDetails?.buyerOrderDate), dispatchDetails?.dispatchDocNo || null,
        dispatchDetails?.dispatchedThrough || null, dispatchDetails?.destination || null, dispatchDetails?.carrierName || null,
        dispatchDetails?.billOfLading || null, sanitizeDate(dispatchDetails?.billOfLadingDate), dispatchDetails?.motorVehicleNo || null,
        sanitizeDate(dispatchDetails?.dispatchDate), dispatchDetails?.termsOfDelivery || null,
        dispatchDetails?.consigneeSameAsBilling ? 1 : 0, dispatchDetails?.consigneeName, dispatchDetails?.consigneeGSTIN,
        dispatchDetails?.consigneeAddress, dispatchDetails?.consigneeState,
        subtotal, gst_amount, igst_rate, cgst_rate, sgst_rate, igst_amount, cgst_amount, sgst_amount, grand_total,
        consignorDetails?.consignorName || null, consignorDetails?.consignorGSTIN || null, consignorDetails?.consignorState || null,
        consignorDetails?.consignorPincode || null, consignorDetails?.consignorAddress || null, consignorDetails?.consignorEmail || null,
        noteId
      ]
    );

    await pool.query(`DELETE FROM note_items WHERE noteId = ?`, [noteId]);
    for (const item of items) {
      const { itemName, hsn_code, qty, per, rate, discount, amount } = item;
      await pool.query(
        `INSERT INTO note_items (noteId, itemName, hsn_code, qty, per, rate, discount, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [noteId, itemName, hsn_code, qty, per, rate, discount, amount]
      );
    }

    return res.json({ success: true, message: "Credit note updated successfully" });
  } catch (error) {
    console.error("Update Credit Note Error:", error);
    return res.status(500).json({ success: false, message: "Error updating credit note", error: error.message });
  }
};

export const deleteNote = async (req, res) => {
  const { noteId } = req.params;
  try {
    await pool.query(`DELETE FROM note_items WHERE noteId = ?`, [noteId]);
    await pool.query(`DELETE FROM notes WHERE id = ?`, [noteId]);
    res.json({ success: true, message: "Note deleted successfully" });
  } catch (error) {
    console.error("Delete Note Error:", error);
    res.status(500).json({ success: false, message: "Error deleting note", error: error.message });
  }
};

export const getSingleNote = async (req, res) => {
  const { noteId } = req.params;
  try {
    const [noteRows] = await pool.query(`SELECT * FROM notes WHERE id = ?`, [noteId]);
    if (noteRows.length === 0) return res.status(404).json({ success: false, message: "Note not found" });
    const [itemRows] = await pool.query(`SELECT * FROM note_items WHERE noteId = ?`, [noteId]);
    res.json({ success: true, note: noteRows[0], items: itemRows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
