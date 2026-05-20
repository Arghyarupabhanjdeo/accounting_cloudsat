import pool from "../db.js";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { generateDocumentPDF } from "../utils/format.js";
import { logAction } from "./auditLogController.js";

// 🔵 CREATE PURCHASE VOUCHER
export const createPurchaseVoucher = async (req, res) => {
  const { companyId } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      date,
      customer,
      ledger,
      subtotal,
      gst_percentage,
      gst_amount,
      igst,
      cgst,
      sgst,
      igst_rate,
      cgst_rate,
      sgst_rate,
      grand_total,
      narration,
      invoiceNo,
      items,

      mailingName, address, state, country, pincode, gstRegistrationType, gstin, placeOfSupply,
      deliveryNoteNo, deliveryNoteDate, dispatchDocNo, dispatchedThrough, destination,
      billOfLading, motorVehicleNo, dispatchDate,
      receiptNoteNo, receiptDate, receiptDocNo, billOfLadingDate,
      supplierInvoiceNo, supplierInvoiceDate,
      paymentTerms, otherReferences, termsOfDelivery, referenceNo, referenceDate, buyerOrderNo, buyerOrderDate,
      consigneeSameAsBilling, consigneeName, consigneeGSTIN, consigneeAddress, consigneeState, consigneePincode,
      consignorName, consignorGSTIN, consignorState, consignorPincode, consignorAddress, consignorEmail,
      carrierName
    } = req.body;

    const [companyRows] = await conn.query(
      `SELECT name, address, pinCode, gstin, state, email, mobile, city FROM companies WHERE id = ?`,
      [companyId]
    );
    const company = companyRows[0] || {};

    const finalConsigneeName = consigneeSameAsBilling ? (company.name || "") : (consigneeName || "");
    const finalConsigneeGSTIN = consigneeSameAsBilling ? (company.gstin || "") : (consigneeGSTIN || "");
    const finalConsigneeState = consigneeSameAsBilling ? (company.state || "") : (consigneeState || "");
    const finalConsigneePincode = consigneeSameAsBilling ? (company.pinCode || "") : (consigneePincode || "");
    const finalConsigneeAddress = consigneeSameAsBilling ? (company.address || "") : (consigneeAddress || "");

    const insertVoucherQuery = `
      INSERT INTO purchase_vouchers (
        companyId, ledgerId, date, customer, subtotal, gst_percentage,
        gst_amount, grand_total, narration, invoiceNo, igst, cgst, sgst,
        consignorName, consignorGSTIN, consignorState,
        consignorPincode, consignorAddress, consignorEmail,
        consigneeName, consigneeGSTIN, consigneeState,
        consigneePincode, consigneeAddress,
        deliveryNoteNo, deliveryNoteDate, dispatchDocNo, dispatchedThrough, destination,
        billOfLading, motorVehicleNo, dispatchDate,
        receiptNoteNo, receiptDate, receiptDocNo, billOfLadingDate,
        supplierInvoiceNo, supplierInvoiceDate,
        paymentTerms, otherReferences, termsOfDelivery, referenceNo, referenceDate, buyerOrderNo, buyerOrderDate,
        consigneeSameAsBilling,
        mailingName, address, state, country, pincode,
        gstRegistrationType, gstin, placeOfSupply,
        igst_rate, cgst_rate, sgst_rate, carrierName
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [voucherResult] = await conn.query(insertVoucherQuery, [
      companyId,
      ledger,
      date,
      customer,
      subtotal,
      gst_percentage,
      gst_amount,
      grand_total,
      narration,
      invoiceNo,
      igst || 0,
      cgst || 0,
      sgst || 0,
      consignorName || null,
      consignorGSTIN || null,
      consignorState || null,
      consignorPincode || null,
      consignorAddress || null,
      consignorEmail || null,
      finalConsigneeName || null,
      finalConsigneeGSTIN || null,
      finalConsigneeState || null,
      finalConsigneePincode || null,
      finalConsigneeAddress || null,
      deliveryNoteNo || null,
      deliveryNoteDate || null,
      dispatchDocNo || null,
      dispatchedThrough || null,
      destination || null,
      billOfLading || null,
      motorVehicleNo || null,
      dispatchDate || null,
      receiptNoteNo || null,
      receiptDate || null,
      receiptDocNo || null,
      billOfLadingDate || null,
      supplierInvoiceNo || null,
      supplierInvoiceDate || null,
      paymentTerms || null,
      otherReferences || null,
      termsOfDelivery || null,
      referenceNo || null,
      referenceDate || null,
      buyerOrderNo || null,
      buyerOrderDate || null,
      consigneeSameAsBilling ? 1 : 0,
      mailingName || null,
      address || null,
      state || null,
      country || null,
      pincode || null,
      gstRegistrationType || null,
      gstin || null,
      placeOfSupply || null,
      igst_rate || 0,
      cgst_rate || 0,
      sgst_rate || 0,
      carrierName || null
    ]);

    const voucherId = voucherResult.insertId;

    // Insert voucher transaction
    const [ledgerRow] = await conn.query(`SELECT name, underGroup FROM ledgers WHERE id = ? AND companyId = ?`, [ledger, companyId]);
    let transactionAccountType = 'ledger';
    if (ledgerRow.length > 0) {
      const underGroup = (ledgerRow[0].underGroup || "").toLowerCase();
      if (underGroup.includes('cash-in-hand') || ledgerRow[0].name.toLowerCase() === 'cash') {
        transactionAccountType = 'cash';
      } else if (underGroup.includes('bank accounts')) {
        transactionAccountType = 'bank';
      }
    }

    await conn.query(
      `INSERT INTO voucher_transactions 
       (companyId, ledgerId, voucherType, voucherId, debit, credit, date, accountType)
       VALUES (?, ?, 'Purchase', ?, 0, ?, ?, ?)`,
      [companyId, ledger, voucherId, grand_total, date, transactionAccountType]
    );

    // Insert items + Update Stock
    for (let item of items) {
      await conn.query(
        `INSERT INTO purchase_voucher_items 
        (voucher_id, item_name, qty, rate, amount, hsn_code)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [voucherId, item.item, item.qty, item.rate, item.amount, item.hsn_code || '']
      );

      const [stockCheck] = await conn.query(
        `SELECT id, openingBalanceQty 
         FROM stocks 
         WHERE name = ? AND companyId = ? AND isDeleted = 0`,
        [item.item, companyId]
      );

      if (stockCheck.length > 0) {
        const stockId = stockCheck[0].id;
        const newQty = stockCheck[0].openingBalanceQty + item.qty;
        await conn.query(
          `UPDATE stocks SET openingBalanceQty = ? WHERE id = ?`,
          [newQty, stockId]
        );
      } else {
        await conn.query(
          `INSERT INTO stocks 
            (companyId, name, alias, under, units, maintainInBatches, trackDateOfManufacture, expiryDateOfBatches,
             rateOfDuty, gstApplicable, hsn, openingBalanceQty, openingBalanceRate, openingBalanceValue)
           VALUES (?, ?, '', 'Purchases', 'Nos', 0, 0, 0, 0, 0, ?, ?, ?, ?)`,
          [
            companyId,
            item.item,
            item.hsn_code || '',
            Number(item.qty),
            Number(item.rate),
            Number(item.amount)
          ]
        );
      }
    }

    // PDF generation
    const [clientRows] = await conn.query(
      `SELECT name, address, pincode, gstin as gst, state FROM ledgers WHERE id = ?`,
      [ledger]
    );
    const client = clientRows[0] || {};

    const pdfFileName = `Purchase_${voucherId}_${Date.now()}.pdf`;

    const pdfData = {
      date: date,
      customer: customer,
      ledgerId: ledger,
      subtotal: Number(subtotal) || 0,
      gst_percentage: Number(gst_percentage) || 0,
      gst_amount: Number(gst_amount) || 0,
      igst: Number(igst) || 0,
      cgst: Number(cgst) || 0,
      sgst: Number(sgst) || 0,
      igst_rate: Number(igst_rate) || 0,
      cgst_rate: Number(cgst_rate) || 0,
      sgst_rate: Number(sgst_rate) || 0,
      grand_total: Number(grand_total) || 0,
      narration: narration,
      invoiceNo: invoiceNo,
      sender: {
        company_name: consignorName || client.name || customer || "",
        address: consignorAddress || client.address || "",
        city: "",
        pincode: consignorPincode || client.pincode || "",
        gst: consignorGSTIN || client.gst || "",
        state_name: consignorState || client.state || "",
        email: consignorEmail || "",
        phone: ""
      },
      client: {
        name: company.name || "Cloudsat Private Limited",
        address: company.address || "",
        city: company.city || "",
        pincode: company.pinCode || "",
        gst: company.gstin || "",
        state_name: company.state || ""
      },
      supplier: {
        name: mailingName || customer || client.name || "",
        address: address || client.address || "",
        gst: gstin || client.gst || "",
        state_name: state || client.state || "",
        pincode: pincode || client.pincode || ""
      },
      items: items.map(item => ({
        itemname: item.item,
        hsnno: item.hsn_code,
        quantity: Number(item.qty) || 0,
        unitprice: Number(item.rate) || 0,
        per: item.per || '',
        total: Number(item.amount) || 0
      })),
      total: Number(grand_total) || 0,
      subtotal: Number(subtotal) || 0,
      docNumber: invoiceNo || `PURCHASE-${voucherId}`,
      paymentTerms: paymentTerms || "",
      shipping_details: {
        delivery_note: deliveryNoteNo || '',
        delivery_note_date: deliveryNoteDate || '',
        reference_no: referenceNo || "",
        reference_date: referenceDate || "",
        other_ref: otherReferences || "",
        buyer_order_no: buyerOrderNo || "",
        buyer_order_date: buyerOrderDate || "",
        dispatched_through: dispatchedThrough || '',
        payment_terms: paymentTerms || "",
        destination: destination || '',
        dispatch_doc_no: dispatchDocNo || "",
        bill_of_lading: billOfLading || "",
        motor_vehicle_no: motorVehicleNo || "",
        delivery_terms: termsOfDelivery || "",
        carrier_name: carrierName || "",
        dispatch_date: dispatchDate || "",
        consigneeName: finalConsigneeName || "",
        consigneeGSTIN: finalConsigneeGSTIN || "",
        consigneeState: finalConsigneeState || "",
        consigneePincode: finalConsigneePincode || "",
        consigneeAddress: finalConsigneeAddress || "",
        supplier_invoice_no: supplierInvoiceNo || "",
        supplier_invoice_date: supplierInvoiceDate || ""
      }
    };

    const generatedPdfPath = await generateDocumentPDF(pdfData, "PURCHASE VOUCHER", pdfFileName, "purchase");

    await conn.query(
      `UPDATE purchase_vouchers SET pdf_path = ? WHERE id = ?`,
      [generatedPdfPath, voucherId]
    );

    await conn.commit();
    res.json({ message: "Purchase Voucher Saved + Stock Updated", voucherId, pdf_path: generatedPdfPath });

  } catch (err) {
    await conn.rollback();
    console.log("purchase voucher error:", err);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    conn.release();
  }
};

// 🔵 UPDATE PURCHASE VOUCHER
export const updatePurchaseVoucher = async (req, res) => {
  const { id } = req.params;
  const { companyId } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      date,
      customer,
      ledger,
      subtotal,
      gst_percentage,
      gst_amount,
      igst,
      cgst,
      sgst,
      igst_rate,
      cgst_rate,
      sgst_rate,
      grand_total,
      narration,
      invoiceNo,
      items,

      mailingName, address, state, country, pincode, gstRegistrationType, gstin, placeOfSupply,
      deliveryNoteNo, deliveryNoteDate, dispatchDocNo, dispatchedThrough, destination,
      billOfLading, motorVehicleNo, dispatchDate,
      receiptNoteNo, receiptDate, receiptDocNo, billOfLadingDate,
      supplierInvoiceNo, supplierInvoiceDate,
      paymentTerms, otherReferences, termsOfDelivery, referenceNo, referenceDate, buyerOrderNo, buyerOrderDate,
      consigneeSameAsBilling, consigneeName, consigneeGSTIN, consigneeAddress, consigneeState, consigneePincode,
      consignorName, consignorGSTIN, consignorState, consignorPincode, consignorAddress, consignorEmail,
      carrierName
    } = req.body;

    // 1. Revert old stock — subtract quantities that were purchased
    const [oldItems] = await conn.query(`SELECT * FROM purchase_voucher_items WHERE voucher_id = ?`, [id]);
    for (let item of oldItems) {
      const purchaseQty = parseFloat(item.qty) || 0;
      const [tradingRows] = await conn.query(
        `SELECT id, openingBalanceQty FROM stocks WHERE companyId = ? AND LOWER(name) = LOWER(?) AND isDeleted = 0 LIMIT 1`,
        [companyId, item.item_name]
      );
      if (tradingRows.length > 0) {
        await conn.query(`UPDATE stocks SET openingBalanceQty = GREATEST(0, openingBalanceQty - ?) WHERE id = ?`, [purchaseQty, tradingRows[0].id]);
      }
    }

    const [companyRows] = await conn.query(
      `SELECT name, address, pinCode, gstin, state, email, mobile, city FROM companies WHERE id = ?`,
      [companyId]
    );
    const company = companyRows[0] || {};

    const finalConsigneeName = consigneeSameAsBilling ? (company.name || "") : (consigneeName || "");
    const finalConsigneeGSTIN = consigneeSameAsBilling ? (company.gstin || "") : (consigneeGSTIN || "");
    const finalConsigneeState = consigneeSameAsBilling ? (company.state || "") : (consigneeState || "");
    const finalConsigneePincode = consigneeSameAsBilling ? (company.pinCode || "") : (consigneePincode || "");
    const finalConsigneeAddress = consigneeSameAsBilling ? (company.address || "") : (consigneeAddress || "");

    const updateVoucherQuery = `
      UPDATE purchase_vouchers SET
        ledgerId = ?, date = ?, customer = ?, subtotal = ?, gst_percentage = ?,
        gst_amount = ?, grand_total = ?, narration = ?, invoiceNo = ?, igst = ?, cgst = ?, sgst = ?,
        consignorName = ?, consignorGSTIN = ?, consignorState = ?,
        consignorPincode = ?, consignorAddress = ?, consignorEmail = ?,
        consigneeName = ?, consigneeGSTIN = ?, consigneeState = ?,
        consigneePincode = ?, consigneeAddress = ?,
        deliveryNoteNo = ?, deliveryNoteDate = ?, dispatchDocNo = ?, dispatchedThrough = ?, destination = ?,
        billOfLading = ?, motorVehicleNo = ?, dispatchDate = ?,
        receiptNoteNo = ?, receiptDate = ?, receiptDocNo = ?, billOfLadingDate = ?,
        supplierInvoiceNo = ?, supplierInvoiceDate = ?,
        paymentTerms = ?, otherReferences = ?, termsOfDelivery = ?, referenceNo = ?, referenceDate = ?, buyerOrderNo = ?, buyerOrderDate = ?,
        consigneeSameAsBilling = ?,
        mailingName = ?, address = ?, state = ?, country = ?, pincode = ?,
        gstRegistrationType = ?, gstin = ?, placeOfSupply = ?,
        igst_rate = ?, cgst_rate = ?, sgst_rate = ?, carrierName = ?
      WHERE id = ?
    `;

    await conn.query(updateVoucherQuery, [
      ledger,
      date,
      customer,
      subtotal,
      gst_percentage,
      gst_amount,
      grand_total,
      narration,
      invoiceNo,
      igst || 0,
      cgst || 0,
      sgst || 0,
      consignorName || null,
      consignorGSTIN || null,
      consignorState || null,
      consignorPincode || null,
      consignorAddress || null,
      consignorEmail || null,
      finalConsigneeName || null,
      finalConsigneeGSTIN || null,
      finalConsigneeState || null,
      finalConsigneePincode || null,
      finalConsigneeAddress || null,
      deliveryNoteNo || null,
      deliveryNoteDate || null,
      dispatchDocNo || null,
      dispatchedThrough || null,
      destination || null,
      billOfLading || null,
      motorVehicleNo || null,
      dispatchDate || null,
      receiptNoteNo || null,
      receiptDate || null,
      receiptDocNo || null,
      billOfLadingDate || null,
      supplierInvoiceNo || null,
      supplierInvoiceDate || null,
      paymentTerms || null,
      otherReferences || null,
      termsOfDelivery || null,
      referenceNo || null,
      referenceDate || null,
      buyerOrderNo || null,
      buyerOrderDate || null,
      consigneeSameAsBilling ? 1 : 0,
      mailingName || null,
      address || null,
      state || null,
      country || null,
      pincode || null,
      gstRegistrationType || null,
      gstin || null,
      placeOfSupply || null,
      igst_rate || 0,
      cgst_rate || 0,
      sgst_rate || 0,
      carrierName || null,
      id
    ]);

    // Update voucher transaction
    await conn.query(
      `DELETE FROM voucher_transactions WHERE voucherType = 'Purchase' AND voucherId = ?`,
      [id]
    );

    const [ledgerRow] = await conn.query(`SELECT name, underGroup FROM ledgers WHERE id = ? AND companyId = ?`, [ledger, companyId]);
    let transactionAccountType = 'ledger';
    if (ledgerRow.length > 0) {
      const underGroup = (ledgerRow[0].underGroup || "").toLowerCase();
      if (underGroup.includes('cash-in-hand') || ledgerRow[0].name.toLowerCase() === 'cash') {
        transactionAccountType = 'cash';
      } else if (underGroup.includes('bank accounts')) {
        transactionAccountType = 'bank';
      }
    }

    await conn.query(
      `INSERT INTO voucher_transactions 
       (companyId, ledgerId, voucherType, voucherId, debit, credit, date, accountType)
       VALUES (?, ?, 'Purchase', ?, 0, ?, ?, ?)`,
      [companyId, ledger, id, grand_total, date, transactionAccountType]
    );

    // Delete existing purchase items and add new items + Update stock
    await conn.query(`DELETE FROM purchase_voucher_items WHERE voucher_id = ?`, [id]);
    for (let item of items) {
      await conn.query(
        `INSERT INTO purchase_voucher_items 
        (voucher_id, item_name, qty, rate, amount, hsn_code)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.item, item.qty, item.rate, item.amount, item.hsn_code || '']
      );

      const [stockCheck] = await conn.query(
        `SELECT id, openingBalanceQty 
         FROM stocks 
         WHERE name = ? AND companyId = ? AND isDeleted = 0`,
        [item.item, companyId]
      );

      if (stockCheck.length > 0) {
        const stockId = stockCheck[0].id;
        const newQty = stockCheck[0].openingBalanceQty + item.qty;
        await conn.query(
          `UPDATE stocks SET openingBalanceQty = ? WHERE id = ?`,
          [newQty, stockId]
        );
      } else {
        await conn.query(
          `INSERT INTO stocks 
            (companyId, name, alias, under, units, maintainInBatches, trackDateOfManufacture, expiryDateOfBatches,
             rateOfDuty, gstApplicable, hsn, openingBalanceQty, openingBalanceRate, openingBalanceValue)
           VALUES (?, ?, '', 'Purchases', 'Nos', 0, 0, 0, 0, 0, ?, ?, ?, ?)`,
          [
            companyId,
            item.item,
            item.hsn_code || '',
            Number(item.qty),
            Number(item.rate),
            Number(item.amount)
          ]
        );
      }
    }

    // PDF generation
    const [clientRows] = await conn.query(
      `SELECT name, address, pincode, gstin as gst, state FROM ledgers WHERE id = ?`,
      [ledger]
    );
    const client = clientRows[0] || {};

    const pdfFileName = `Purchase_${id}_${Date.now()}.pdf`;

    const pdfData = {
      date: date,
      customer: customer,
      ledgerId: ledger,
      subtotal: Number(subtotal) || 0,
      gst_percentage: Number(gst_percentage) || 0,
      gst_amount: Number(gst_amount) || 0,
      igst: Number(igst) || 0,
      cgst: Number(cgst) || 0,
      sgst: Number(sgst) || 0,
      igst_rate: Number(igst_rate) || 0,
      cgst_rate: Number(cgst_rate) || 0,
      sgst_rate: Number(sgst_rate) || 0,
      grand_total: Number(grand_total) || 0,
      narration: narration,
      invoiceNo: invoiceNo,
      sender: {
        company_name: consignorName || client.name || customer || "",
        address: consignorAddress || client.address || "",
        city: "",
        pincode: consignorPincode || client.pincode || "",
        gst: consignorGSTIN || client.gst || "",
        state_name: consignorState || client.state || "",
        email: consignorEmail || "",
        phone: ""
      },
      client: {
        name: company.name || "Cloudsat Private Limited",
        address: company.address || "",
        city: company.city || "",
        pincode: company.pinCode || "",
        gst: company.gstin || "",
        state_name: company.state || ""
      },
      supplier: {
        name: mailingName || customer || client.name || "",
        address: address || client.address || "",
        gst: gstin || client.gst || "",
        state_name: state || client.state || "",
        pincode: pincode || client.pincode || ""
      },
      items: items.map(item => ({
        itemname: item.item,
        hsnno: item.hsn_code,
        quantity: Number(item.qty) || 0,
        unitprice: Number(item.rate) || 0,
        per: item.per || '',
        total: Number(item.amount) || 0
      })),
      total: Number(grand_total) || 0,
      subtotal: Number(subtotal) || 0,
      docNumber: invoiceNo || `PURCHASE-${id}`,
      paymentTerms: paymentTerms || "",
      shipping_details: {
        delivery_note: deliveryNoteNo || '',
        delivery_note_date: deliveryNoteDate || '',
        reference_no: referenceNo || "",
        reference_date: referenceDate || "",
        other_ref: otherReferences || "",
        buyer_order_no: buyerOrderNo || "",
        buyer_order_date: buyerOrderDate || "",
        dispatched_through: dispatchedThrough || '',
        payment_terms: paymentTerms || "",
        destination: destination || '',
        dispatch_doc_no: dispatchDocNo || "",
        bill_of_lading: billOfLading || "",
        motor_vehicle_no: motorVehicleNo || "",
        delivery_terms: termsOfDelivery || "",
        carrier_name: carrierName || "",
        dispatch_date: dispatchDate || "",
        consigneeName: finalConsigneeName || "",
        consigneeGSTIN: finalConsigneeGSTIN || "",
        consigneeState: finalConsigneeState || "",
        consigneePincode: finalConsigneePincode || "",
        consigneeAddress: finalConsigneeAddress || "",
        supplier_invoice_no: supplierInvoiceNo || "",
        supplier_invoice_date: supplierInvoiceDate || ""
      }
    };

    const generatedPdfPath = await generateDocumentPDF(pdfData, "PURCHASE VOUCHER", pdfFileName, "purchase");

    await conn.query(
      `UPDATE purchase_vouchers SET pdf_path = ? WHERE id = ?`,
      [generatedPdfPath, id]
    );

    await conn.commit();
    res.json({ message: "Purchase Voucher updated successfully", pdf_path: generatedPdfPath });

  } catch (err) {
    await conn.rollback();
    console.log("purchase voucher update error:", err);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    conn.release();
  }
};

// 🔵 DELETE PURCHASE VOUCHER
export const deletePurchaseVoucher = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [oldRows] = await connection.query(`SELECT * FROM purchase_vouchers WHERE id = ?`, [id]);
    const oldValue = oldRows.length > 0 ? oldRows[0] : null;

    if (!oldValue) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const companyId = oldValue.companyId;

    // Revert stock quantities (subtract purchased quantities from stocks)
    const [oldItems] = await connection.query(`SELECT * FROM purchase_voucher_items WHERE voucher_id = ?`, [id]);
    for (let item of oldItems) {
      const purchaseQty = parseFloat(item.qty) || 0;
      const [tradingRows] = await connection.query(
        `SELECT id, openingBalanceQty FROM stocks WHERE companyId = ? AND LOWER(name) = LOWER(?) AND isDeleted = 0 LIMIT 1`,
        [companyId, item.item_name]
      );
      if (tradingRows.length > 0) {
        await connection.query(`UPDATE stocks SET openingBalanceQty = GREATEST(0, openingBalanceQty - ?) WHERE id = ?`, [purchaseQty, tradingRows[0].id]);
      }
    }

    // Delete items first
    await connection.query(`DELETE FROM purchase_voucher_items WHERE voucher_id = ?`, [id]);
    // Delete transactions
    await connection.query(`DELETE FROM voucher_transactions WHERE voucherType = 'Purchase' AND voucherId = ?`, [id]);
    // Delete voucher
    await connection.query(`DELETE FROM purchase_vouchers WHERE id = ?`, [id]);

    // Audit Log
    await logAction({
      company_id: oldValue.companyId,
      action: "DELETE",
      entity_type: "PURCHASE_VOUCHER",
      entity_id: id,
      old_value: oldValue
    });

    await connection.commit();
    res.json({ success: true, message: "Purchase Voucher deleted successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DELETE PURCHASE VOUCHER ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to delete voucher" });
  } finally {
    connection.release();
  }
};

// 🔵 GET PURCHASE VOUCHER BY ID
export const getPurchaseVoucherById = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(
      `SELECT * FROM purchase_vouchers WHERE id = ?`,
      [id]
    );

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const [items] = await pool.query(
      `SELECT id, item_name as item, qty, rate, amount, hsn_code FROM purchase_voucher_items WHERE voucher_id = ?`,
      [id]
    );

    res.json({ ...voucher, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching voucher details" });
  }
};

// 🔵 DOWNLOAD PURCHASE VOUCHER PDF
export const downloadPurchaseVoucherPDF = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(
      `SELECT * FROM purchase_vouchers WHERE id = ?`,
      [id]
    );

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const [items] = await pool.query(
      `SELECT id, item_name as item, qty, rate, amount, hsn_code FROM purchase_voucher_items WHERE voucher_id = ?`,
      [id]
    );

    const [[company]] = await pool.query(
      `SELECT * FROM companies WHERE id = ?`,
      [voucher.companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [[clientInfo]] = await pool.query(
      `SELECT name, address, pincode, gstin as gst, state FROM ledgers WHERE id = ?`,
      [voucher.ledgerId]
    );
    const client = clientInfo || {};

    const pdfFileName = `Purchase_${voucher.id}_${Date.now()}.pdf`;

    const pdfData = {
      date: voucher.date,
      customer: voucher.customer,
      ledgerId: voucher.ledgerId,
      subtotal: Number(voucher.subtotal) || 0,
      gst_percentage: Number(voucher.gst_percentage) || 0,
      gst_amount: Number(voucher.gst_amount) || 0,
      igst: Number(voucher.igst) || 0,
      cgst: Number(voucher.cgst) || 0,
      sgst: Number(voucher.sgst) || 0,
      igst_rate: Number(voucher.igst_rate) || 0,
      cgst_rate: Number(voucher.cgst_rate) || 0,
      sgst_rate: Number(voucher.sgst_rate) || 0,
      grand_total: Number(voucher.grand_total) || 0,
      narration: voucher.narration,
      invoiceNo: voucher.invoiceNo,
      sender: {
        company_name: voucher.consignorName || client.name || voucher.customer || "",
        address: voucher.consignorAddress || client.address || "",
        city: "",
        pincode: voucher.consignorPincode || client.pincode || "",
        gst: voucher.consignorGSTIN || client.gst || "",
        state_name: voucher.consignorState || client.state || "",
        email: voucher.consignorEmail || "",
        phone: ""
      },
      client: {
        name: company.name || "Cloudsat Private Limited",
        address: company.address || "",
        city: company.city || "",
        pincode: company.pinCode || "",
        gst: company.gstin || "",
        state_name: company.state || ""
      },
      supplier: {
        name: voucher.mailingName || voucher.customer || client.name || "",
        address: voucher.address || client.address || "",
        gst: voucher.gstin || client.gst || "",
        state_name: voucher.state || client.state || "",
        pincode: voucher.pincode || client.pincode || ""
      },
      items: items.map(item => ({
        itemname: item.item,
        hsnno: item.hsn_code,
        quantity: Number(item.qty) || 0,
        unitprice: Number(item.rate) || 0,
        per: item.per || '',
        total: Number(item.amount) || 0
      })),
      total: Number(voucher.grand_total) || 0,
      subtotal: Number(voucher.subtotal) || 0,
      docNumber: voucher.invoiceNo || `PURCHASE-${voucher.id}`,
      paymentTerms: voucher.paymentTerms || "",
      shipping_details: {
        delivery_note: voucher.deliveryNoteNo || '',
        delivery_note_date: voucher.deliveryNoteDate || '',
        reference_no: voucher.referenceNo || "",
        reference_date: voucher.referenceDate || "",
        other_ref: voucher.otherReferences || "",
        buyer_order_no: voucher.buyerOrderNo || "",
        buyer_order_date: voucher.buyerOrderDate || "",
        dispatched_through: voucher.dispatchedThrough || '',
        payment_terms: voucher.paymentTerms || "",
        destination: voucher.destination || '',
        dispatch_doc_no: voucher.dispatchDocNo || "",
        bill_of_lading: voucher.billOfLading || "",
        motor_vehicle_no: voucher.motorVehicleNo || "",
        delivery_terms: voucher.termsOfDelivery || "",
        carrier_name: voucher.carrierName || "",
        dispatch_date: voucher.dispatchDate || "",
        consigneeName: voucher.consigneeName || "",
        consigneeGSTIN: voucher.consigneeGSTIN || "",
        consigneeState: voucher.consigneeState || "",
        consigneePincode: voucher.consigneePincode || "",
        consigneeAddress: voucher.consigneeAddress || "",
        supplier_invoice_no: voucher.supplierInvoiceNo || "",
        supplier_invoice_date: voucher.supplierInvoiceDate || ""
      }
    };

    const generatedPdfPath = await generateDocumentPDF(pdfData, "PURCHASE VOUCHER", pdfFileName, "purchase");

    await pool.query(
      `UPDATE purchase_vouchers SET pdf_path = ? WHERE id = ?`,
      [generatedPdfPath, id]
    );

    res.download(path.join(process.cwd(), generatedPdfPath));
  } catch (error) {
    console.error("Error downloading purchase voucher PDF:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 🔵 GET ALL VOUCHERS OF COMPANY
export const getAllVouchers = async (req, res) => {

  const { companyId } = req.params;
  console.log(companyId);

  console.log("HELLO WORLD");

  try {
    const [rows] = await pool.query(
      `SELECT * FROM purchase_vouchers WHERE companyId = ? ORDER BY created_at DESC`,
      [companyId]
    );
    console.log(rows);

    res.json(rows);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Unable to fetch vouchers" });
  }
};

// 🔵 GET ALL VOUCHERS OF COMPANY WRAPPED IN DATA (MATCHING SALES)
export const getPurchaseVouchersAll = async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM purchase_vouchers WHERE companyId = ? ORDER BY created_at DESC`,
      [companyId]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        message: "No data found",
        data: []
      });
    }

    return res.status(200).json({
      message: "Data fetched successfully",
      data: rows
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Unable to fetch vouchers" });
  }
};


export const getPurchaseVoucherItems = async (req, res) => {
  const { voucherId } = req.params
  try {
    const [rows] = await pool.query(`SELECT * FROM purchase_voucher_items WHERE voucher_id = ?`, [voucherId])
    res.status(200).json({
      message: "Items fetched SuccessFully ",
      items: rows
    })
  } catch (error) {
    console.log(error);

  }
}

export const uploadFromExcel = async (req, res) => {
  const { companyId } = req.params;
  const conn = await pool.getConnection();

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    /* ===============================
       READ EXCEL AS ARRAY
    =============================== */
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });
    console.log(rows);


    if (rows.length < 2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Excel file is empty" });
    }

    await conn.beginTransaction();

    let insertedVouchers = 0;
    let insertedItems = 0;

    /* ===============================
       GROUP ROWS BY VOUCHER
    =============================== */
    const vouchers = {};

    for (let i = 1; i < rows.length; i++) {
      const [
        date,
        customer,
        ledgerId,
        item,
        qty,
        rate,
        amount,
        narration,
      ] = rows[i];

      if (!date || !item || !qty) continue;

      const key = `${date}_${customer}`;

      if (!vouchers[key]) {
        vouchers[key] = {
          date,
          customer,
          ledgerId,
          narration,
          items: [],
        };
      }

      vouchers[key].items.push({
        item,
        qty: Number(qty),
        rate: Number(rate),
        amount: Number(amount),
      });
    }

    /* ===============================
       INSERT VOUCHERS
    =============================== */
    for (const key in vouchers) {
      const v = vouchers[key];

      const subtotal = v.items.reduce((s, i) => s + i.amount, 0);
      const gst_percentage = 0;
      const gst_amount = 0;
      const grand_total = subtotal;

      // 1️⃣ INSERT PURCHASE VOUCHER
      const [voucherRes] = await conn.query(
        `
        INSERT INTO purchase_vouchers
        (companyId, ledgerId, date, customer, subtotal, gst_percentage, gst_amount, grand_total, narration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          companyId,
          v.ledgerId,
          v.date,
          v.customer,
          subtotal,
          gst_percentage,
          gst_amount,
          grand_total,
          v.narration || "",
        ]
      );

      const voucherId = voucherRes.insertId;
      insertedVouchers++;

      /* ===============================
         INSERT ITEMS + UPDATE STOCK
      =============================== */
      for (const it of v.items) {
        // Insert item
        await conn.query(
          `
          INSERT INTO purchase_voucher_items
          (voucher_id, item_name, qty, rate, amount)
          VALUES (?, ?, ?, ?, ?)
          `,
          [voucherId, it.item, it.qty, it.rate, it.amount]
        );

        insertedItems++;

        // Check stock
        const [stock] = await conn.query(
          `
          SELECT id, openingBalanceQty
          FROM stocks
          WHERE name = ? AND companyId = ? AND isDeleted = 0
          `,
          [it.item, companyId]
        );

        if (stock.length) {
          // Update qty
          await conn.query(
            `
            UPDATE stocks
            SET openingBalanceQty = ?
            WHERE id = ?
            `,
            [stock[0].openingBalanceQty + it.qty, stock[0].id]
          );
        } else {
          // Create stock
          await conn.query(
            `
            INSERT INTO stocks
            (
              companyId, name, under, units,
              openingBalanceQty, openingBalanceRate, openingBalanceValue
            )
            VALUES (?, ?, 'Purchases', 'Nos', ?, ?, ?)
            `,
            [
              companyId,
              it.item,
              it.qty,
              it.rate,
              it.amount,
            ]
          );
        }
      }
    }

    await conn.commit();
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      message: "Excel Purchase Upload Successful",
      vouchersInserted: insertedVouchers,
      itemsInserted: insertedItems,
    });

  } catch (error) {
    await conn.rollback();
    console.error(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: "Purchase Excel upload failed",
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

export const bulkCreatePurchaseVoucher = async (req, res) => {
  const { companyId, vouchers } = req.body; // vouchers is an array of voucher objects

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const voucher of vouchers) {
      const {
        date,
        customer,
        ledger,
        subtotal,
        gst_percentage,
        gst_amount,
        grand_total,
        narration,
        items,
        igst,
        cgst,
        sgst
      } = voucher;

      // 1️⃣ Insert voucher
      const [result] = await conn.query(
        `INSERT INTO purchase_vouchers 
        (companyId, ledgerId, date, customer, subtotal, gst_percentage, gst_amount, grand_total, narration, igst, cgst, sgst)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          ledger,
          date,
          customer,
          subtotal,
          gst_percentage,
          gst_amount,
          grand_total,
          narration,
          igst || 0,
          cgst || 0,
          sgst || 0
        ]
      );

      const voucherId = result.insertId;

      // 2️⃣ Insert items + Update Stock
      for (let item of items) {
        // Insert voucher items
        await conn.query(
          `INSERT INTO purchase_voucher_items 
          (voucher_id, item_name, qty, rate, amount, hsn_code)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [voucherId, item.item, item.qty, item.rate, item.amount, item.hsn_code]
        );

        // 3️⃣ Check if item exists in stock
        const [rows] = await conn.query(
          `SELECT * FROM stocks WHERE companyId = ? AND name = ?`,
          [companyId, item.item]
        );

        if (rows.length > 0) {
          // Update existing stock
          const newQty = parseFloat(rows[0].openingBalanceQty) + parseFloat(item.qty);
          await conn.query(
            `UPDATE stocks SET openingBalanceQty = ? WHERE id = ?`,
            [newQty, rows[0].id]
          );
        } else {
          // Create new stock entry
          await conn.query(
            `INSERT INTO stocks 
              (companyId, name, alias, under, units, maintainInBatches, trackDateOfManufacture, expiryDateOfBatches,
               rateOfDuty, gstApplicable, hsn, openingBalanceQty, openingBalanceRate, openingBalanceValue)
             VALUES (?, ?, '', 'Purchases', 'Nos', 0, 0, 0, 0, 0, ?, ?, ?, ?)`,
            [
              companyId,
              item.item,
              item.hsn_code || '',
              item.qty,
              item.rate,
              item.amount
            ]
          );
        }
      }
    }

    await conn.commit();
    res.json({ message: "Bulk Purchase Vouchers Saved Successfully" });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Something went wrong during bulk import" });
  } finally {
    conn.release();
  }
};