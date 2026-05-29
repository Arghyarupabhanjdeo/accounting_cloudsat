import pool from "../db.js";
import path from "path";
// import { generatePDF } from "../utils/pdfUtils.js";
import { generateDocumentPDF } from "../utils/format.js";
import { logAction } from "./auditLogController.js";
import { ensureCreatorColumns, getCreatorFromRequest } from "../utils/creatorTracking.js";

export const createSalesVoucher = async (req, res) => {
  const creator = getCreatorFromRequest(req);
  const {
    companyId,
    date,
    customer,
    ledgerId,
    subtotal,
    gst_percentage,
    gst_amount,
    grand_total,
    narration,
    invoiceNo,
    items,

    ewayBillDetails = {},
    igst,
    cgst,
    sgst,
    paymentTerms,
    otherReferences,
    buyerOrderNo,
    buyerOrderDate,
    deliveryNoteDate,
    termsOfDelivery,
    consigneeName: reqBodyConsigneeName,
    consigneeGSTIN: reqBodyConsigneeGSTIN,
    consigneeAddress: reqBodyConsigneeAddress,
    consigneeState: reqBodyConsigneeState,
    consigneePincode: reqBodyConsigneePincode,
    mailingName,
    address,
    state,
    gstin,
    pincode,
    deliveryNoteNo,
    dispatchDocNo,
    dispatchedThrough,
    destination,
   
    billOfLading,
    motorVehicleNo,
    dispatchDate,
    referenceNo,
    referenceDate,
    country,
    placeOfSupply,
    igst_rate,
    cgst_rate,
    sgst_rate,
    carrierName,
    consigneeSameAsBilling,
    gstRegistrationType
  } = req.body;

  console.log("SALES-VOUCHER-BODY => ", req.body);

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    await ensureCreatorColumns(connection, "sales_vouchers");
    /* ================= SENDER/COMPANY INFO ================= */
   const [companyRows] = await connection.query(
  `SELECT name, address, city, pinCode, gstin, state, email, mobile FROM companies WHERE id = ?`,
  [companyId]
);
    const company = companyRows[0] || {};

    /* ================= E-WAY BILL & FALLBACKS ================= */
    const {
      ewayBillNo,
      ewayBillDate,
      subType,
      consignorName = company.name,
      consignorGSTIN = company.gstin,
      consignorState = company.state,
      consignorPincode = company.pinCode,
      consignorAddress = company.address,
      consignorEmail = company.email,
      consigneeName: ewayConsigneeName,
      consigneeGSTIN: ewayConsigneeGSTIN,
      consigneeState: ewayConsigneeState,
      consigneePincode: ewayConsigneePincode,
      consigneeAddress: ewayConsigneeAddress,
      distanceKM,
      vehicleNumber
    } = ewayBillDetails;

    // Consignee Fallback: reqBody -> Party Billing -> eWayBill
    const finalConsigneeName = reqBodyConsigneeName || ewayConsigneeName || mailingName || customer;
    const finalConsigneeGSTIN = reqBodyConsigneeGSTIN || ewayConsigneeGSTIN || gstin;
    const finalConsigneeState = reqBodyConsigneeState || ewayConsigneeState || state;
    const finalConsigneePincode = reqBodyConsigneePincode || ewayConsigneePincode || pincode;
    const finalConsigneeAddress = reqBodyConsigneeAddress || ewayConsigneeAddress || address;

    /* ================= INSERT SALES VOUCHER ================= */
    const insertVoucherQuery = `
      INSERT INTO sales_vouchers (
        companyId, date, customer, ledgerId, subtotal, gst_percentage,
        gst_amount, grand_total, narration, invoiceNo, igst, cgst, sgst,
        ewayBillNo, ewayBillDate,
        consignorName, consignorGSTIN, consignorState,
        consignorPincode, consignorAddress, consignorEmail,
        consigneeName, consigneeGSTIN, consigneeState,
        consigneePincode, consigneeAddress,
        distanceKM,
        vehicleNumber, 
        buyerOrderNo,
        buyerOrderDate, deliveryNoteDate, termsOfDelivery,
        dispatchDocNo, referenceNo, referenceDate,
        deliveryNoteNo, dispatchedThrough, destination,
        billOfLading, motorVehicleNo, dispatchDate,
        mailingName, address, state, country, pincode,
        gstRegistrationType, gstin, placeOfSupply,
        igst_rate, cgst_rate, sgst_rate, carrierName,
        consigneeSameAsBilling, paymentTerms, otherReferences
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?,
              ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [voucherResult] = await connection.query(insertVoucherQuery, [
      companyId,
      date,
      customer,
      ledgerId,
      subtotal,
      gst_percentage,
      gst_amount,
      grand_total,
      narration,
      invoiceNo,
      igst || 0,
      cgst || 0,
      sgst || 0,
      ewayBillNo || null,
      ewayBillDate || null,
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
      distanceKM || null,
      vehicleNumber || null,
      buyerOrderNo || null,
      buyerOrderDate || null,
      deliveryNoteDate || null,
      termsOfDelivery || null,
      dispatchDocNo || null,
      referenceNo || null,
      referenceDate || null,
      deliveryNoteNo || null,
      dispatchedThrough || null,
      destination || null,
      billOfLading || null,
      motorVehicleNo || null,
      dispatchDate || null,
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
      consigneeSameAsBilling ? 1 : 0,
      paymentTerms || null,
      otherReferences || null
    ]);

    const voucherId = voucherResult.insertId;
    await connection.query(
      `UPDATE sales_vouchers SET created_by_user_id = ?, created_by_employee_id = ? WHERE id = ?`,
      [creator.userId, creator.employeeId, voucherId]
    );

    /* ================= SALES ITEMS INSERT ================= */
    const insertItemQuery = `
      INSERT INTO sales_items (voucherId, item, qty, rate, per, amount, hsn_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    /* ================= STOCK QUERIES ================= */
    const getTotalMJStockQuery = `
      SELECT SUM(finishedQty) AS totalQty
      FROM manufacturing_journal
      WHERE companyId = ? AND LOWER(productName) = LOWER(?)
    `;

    const getTotalTradingStockQuery = `
      SELECT SUM(openingBalanceQty) AS totalQty
      FROM stocks
      WHERE companyId = ? AND LOWER(name) = LOWER(?) AND isDeleted = 0
    `;

    const getFifoMJStockRowsQuery = `
      SELECT id, finishedQty
      FROM manufacturing_journal
      WHERE companyId = ? AND LOWER(productName) = LOWER(?) AND finishedQty > 0
      ORDER BY id ASC
    `;

    const getFifoTradingStockRowsQuery = `
      SELECT id, openingBalanceQty
      FROM stocks
      WHERE companyId = ? AND LOWER(name) = LOWER(?) AND openingBalanceQty > 0 AND isDeleted = 0
      ORDER BY id ASC
    `;

    const updateMJStockQuery = `
      UPDATE manufacturing_journal
      SET finishedQty = ?
      WHERE id = ?
    `;

    const updateTradingStockQuery = `
      UPDATE stocks
      SET openingBalanceQty = ?
      WHERE id = ?
    `;

    /* ================= PROCESS EACH SOLD ITEM ================= */
    for (const sold of items) {
      const soldQty = Number(sold.qty);

      // 1️⃣ Check total available stock (MJ + Trading)
      const [mjStockResult] = await connection.query(getTotalMJStockQuery, [companyId, sold.item]);
      const [tradingStockResult] = await connection.query(getTotalTradingStockQuery, [companyId, sold.item]);

      const mjAvailable = parseFloat(mjStockResult[0]?.totalQty || 0);
      const tradingAvailable = parseFloat(tradingStockResult[0]?.totalQty || 0);
      const totalAvailable = mjAvailable + tradingAvailable;

      if (totalAvailable < soldQty) {
        throw new Error(
          `Insufficient stock for "${sold.item}". Available: ${totalAvailable} (MJ: ${mjAvailable}, Trading: ${tradingAvailable}), Required: ${soldQty}`
        );
      }

      // 2️⃣ Insert sales item
      await connection.query(insertItemQuery, [
        voucherId,
        sold.item,
        sold.qty,
        sold.rate,
        sold.per || '',
        sold.amount,
        sold.hsn_code || ''
      ]);

      // 3️⃣ FIFO stock deduction
      let requiredQty = soldQty;

      // First deduct from MJ
      if (mjAvailable > 0) {
        const [journalRows] = await connection.query(getFifoMJStockRowsQuery, [companyId, sold.item]);
        for (const row of journalRows) {
          if (requiredQty <= 0) break;
          const currentQty = parseFloat(row.finishedQty);
          if (currentQty >= requiredQty) {
            await connection.query(updateMJStockQuery, [currentQty - requiredQty, row.id]);
            requiredQty = 0;
          } else {
            requiredQty -= currentQty;
            await connection.query(updateMJStockQuery, [0, row.id]);
          }
        }
      }

      // Then deduct from Trading
      if (requiredQty > 0 && tradingAvailable > 0) {
        const [stockRows] = await connection.query(getFifoTradingStockRowsQuery, [companyId, sold.item]);
        for (const row of stockRows) {
          if (requiredQty <= 0) break;
          const currentQty = parseFloat(row.openingBalanceQty);
          if (currentQty >= requiredQty) {
            await connection.query(updateTradingStockQuery, [currentQty - requiredQty, row.id]);
            requiredQty = 0;
          } else {
            requiredQty -= currentQty;
            await connection.query(updateTradingStockQuery, [0, row.id]);
          }
        }
      }
    }

    const sender = company;

    // 2️⃣ Fetch client info (Buyer) if not provided in body
    const [clientRows] = await connection.query(
      `SELECT name, address, pincode, gstin as gst, state FROM ledgers WHERE id = ?`,
      [ledgerId]
    );
    const clientInfo = clientRows[0] || {};

    // 3️⃣ Map data for professional PDF
    const pdfFileName = `Sales_${voucherId}_${Date.now()}.pdf`;

    const pdfData = {
      ...req.body,
      sender: {
        company_name: consignorName || sender.name || "",
        address: consignorAddress || sender.address || "",
       city: sender.city || "",

country: sender.country || "",
        pincode: consignorPincode || sender.pinCode || "",
        gst: consignorGSTIN || sender.gstin || "",
        state_name: consignorState || sender.state || "",
        email: consignorEmail || sender.email || "",
        phone: sender.mobile || ""
      },
      client: {
        name: req.body.mailingName || req.body.customer || clientInfo.name || "",
        address: req.body.address || clientInfo.address || "",
        city: req.body.city || "",
        pincode: req.body.pincode || clientInfo.pincode || "",
        gst: req.body.gstin || clientInfo.gst || "",
        state_name: req.body.state || clientInfo.state || ""
      },
      items: items.map(item => ({
        itemname: item.item,
        hsnno: item.hsn_code,
        quantity: item.qty,
        unitprice: item.rate,
        per: item.per || '',
        total: item.amount
      })),
      total: grand_total,
      subtotal: subtotal,
      date: date,
      docNumber: invoiceNo || `SALES-${voucherId}`,
      paymentTerms: paymentTerms || "",
      shipping_details: {
        ...(req.body.ewayBillDetails || {}),
        delivery_note: req.body.deliveryNoteNo,
        delivery_note_date: deliveryNoteDate || req.body.dispatchDate,
        reference_no: req.body.referenceNo || "",
        reference_date: req.body.referenceDate || "",
        other_ref: otherReferences || "",
        buyer_order_no: buyerOrderNo || "",
        buyer_order_date: buyerOrderDate || "",
        dispatched_through: req.body.dispatchedThrough,
        payment_terms: paymentTerms || "",
        destination: req.body.destination,
        dispatch_doc_no: req.body.dispatchDocNo || "",
        bill_of_lading: req.body.billOfLading || "",
        motor_vehicle_no: req.body.motorVehicleNo || "",
        delivery_terms: termsOfDelivery || "",
        carrier_name: carrierName || "",
        dispatch_date: dispatchDate || "",
        consigneeName: finalConsigneeName || "",
        consigneeGSTIN: finalConsigneeGSTIN || "",
        consigneeState: finalConsigneeState || "",
        consigneePincode: finalConsigneePincode || "",
        consigneeAddress: finalConsigneeAddress || ""
      }
    };

    // 4️⃣ Generate PDF using professional format
    const generatedPdfPath = await generateDocumentPDF(pdfData, "TAX INVOICE", pdfFileName, "sales");

    // Update DB with PDF path
    await connection.query(
      `UPDATE sales_vouchers SET pdf_path = ? WHERE id = ?`,
      [generatedPdfPath, voucherId]
    );

    /* ================= COMMIT ================= */
    await connection.commit();

    // 5️⃣ Record in voucher_transactions for reports
    const [ledgerRow] = await pool.query(`SELECT name, underGroup FROM ledgers WHERE id = ? AND companyId = ?`, [ledgerId, companyId]);
    if (ledgerRow.length > 0) {
      const underGroup = (ledgerRow[0].underGroup || "").toLowerCase();
      let transactionAccountType = 'ledger';
      if (underGroup.includes('cash-in-hand') || ledgerRow[0].name.toLowerCase() === 'cash') {
        transactionAccountType = 'cash';
      } else if (underGroup.includes('bank accounts')) {
        transactionAccountType = ledgerRow[0].name;
      }

      await ensureCreatorColumns(pool, "voucher_transactions");
      await pool.query(
        `INSERT INTO voucher_transactions 
        (companyId, ledgerId, voucherType, voucherId, debit, credit, date, narration, accountType, created_by_user_id, created_by_employee_id)
        VALUES (?, ?, 'Sales', ?, ?, 0, ?, ?, ?, ?, ?)`,
        [companyId, ledgerId, voucherId, grand_total, date, narration, transactionAccountType, creator.userId, creator.employeeId]
      );
    }

    res.json({
      success: true,
      voucherId,
      pdf_path: generatedPdfPath,
      message: "Sales voucher created successfully and PDF generated",
    });

  } catch (error) {
    await connection.rollback();
    console.error("SALES VOUCHER ERROR:", error);

    res.status(400).json({
      success: false,
      message: error.message || "Failed to create sales voucher",
    });
  } finally {
    connection.release();
  }
};

export const updateSaleVoucher = async (req, res) => {
  const { id } = req.params;
  const {
    companyId, date, customer, ledgerId, subtotal, gst_percentage, gst_amount,
    grand_total, narration, invoiceNo, igst, cgst, sgst, items, ewayBillDetails = {},
    paymentTerms, otherReferences, buyerOrderNo, buyerOrderDate, deliveryNoteDate, termsOfDelivery,
    consigneeName: reqBodyConsigneeName,
    consigneeGSTIN: reqBodyConsigneeGSTIN,
    consigneeAddress: reqBodyConsigneeAddress,
    consigneeState: reqBodyConsigneeState,
    consigneePincode: reqBodyConsigneePincode,
    mailingName,
    address,
    state,
    gstin,
    pincode,
    deliveryNoteNo,
    dispatchDocNo,
    dispatchedThrough,
    destination,
    billOfLading,
    motorVehicleNo,
    dispatchDate,
    referenceNo,
    referenceDate,
    country,
    placeOfSupply,
    igst_rate,
    cgst_rate,
    sgst_rate,
    carrierName,
    consigneeSameAsBilling,
    gstRegistrationType
  } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Revert old stock — add back quantities that were previously sold
    const [oldItems] = await connection.query(`SELECT * FROM sales_items WHERE voucherId = ?`, [id]);
    for (let item of oldItems) {
      const soldQty = parseFloat(item.qty) || 0;
      const [tradingRows] = await connection.query(
        `SELECT id, openingBalanceQty FROM stocks WHERE companyId = ? AND LOWER(name) = LOWER(?) AND isDeleted = 0 LIMIT 1`,
        [companyId, item.item]
      );
      if (tradingRows.length > 0) {
        await connection.query(`UPDATE stocks SET openingBalanceQty = openingBalanceQty + ? WHERE id = ?`, [soldQty, tradingRows[0].id]);
      } else {
        await connection.query(
          `UPDATE manufacturing_journal SET finishedQty = finishedQty + ? WHERE companyId = ? AND LOWER(productName) = LOWER(?) LIMIT 1`,
          [soldQty, companyId, item.item]
        );
      }
    }

    // 2. Update header
    const [companyRows] = await connection.query(
      `SELECT name, address, pinCode, gstin, state, email, mobile, city, country FROM companies WHERE id = ?`,
      [companyId]
    );
    const company = companyRows[0] || {};

    const {
      ewayBillNo, ewayBillDate,
      consignorName = company.name,
      consignorGSTIN = company.gstin,
      consignorState = company.state,
      consignorPincode = company.pinCode,
      consignorAddress = company.address,
      consignorEmail = company.email,
      consigneeName: ewayConsigneeName,
      consigneeGSTIN: ewayConsigneeGSTIN,
      consigneeState: ewayConsigneeState,
      consigneePincode: ewayConsigneePincode,
      consigneeAddress: ewayConsigneeAddress,
      distanceKM, 
      vehicleNumber
    } = ewayBillDetails;

    // Consignee Fallback: reqBody -> Party Billing -> eWayBill
    const finalConsigneeName = reqBodyConsigneeName || ewayConsigneeName || mailingName || customer;
    const finalConsigneeGSTIN = reqBodyConsigneeGSTIN || ewayConsigneeGSTIN || gstin;
    const finalConsigneeState = reqBodyConsigneeState || ewayConsigneeState || state;
    const finalConsigneePincode = reqBodyConsigneePincode || ewayConsigneePincode || pincode;
    const finalConsigneeAddress = reqBodyConsigneeAddress || ewayConsigneeAddress || address;

    await connection.query(
      `UPDATE sales_vouchers 
       SET date=?, customer=?, ledgerId=?, subtotal=?, gst_percentage=?, gst_amount=?, grand_total=?,
           narration=?, invoiceNo=?, pincode=?, igst=?, cgst=?, sgst=?,
           ewayBillNo=?, ewayBillDate=?, 
           consignorName=?, consignorGSTIN=?, consignorState=?, consignorPincode=?, consignorAddress=?, consignorEmail=?,
           consigneeName=?, consigneeGSTIN=?, consigneeState=?, consigneePincode=?, consigneeAddress=?,
           distanceKM=?, 
           vehicleNumber=?,  
           paymentTerms=?, otherReferences=?, buyerOrderNo=?, buyerOrderDate=?, deliveryNoteDate=?, termsOfDelivery=?,
           dispatchDocNo=?, referenceNo=?, referenceDate=?,
           deliveryNoteNo=?, dispatchedThrough=?, destination=?,
           billOfLading=?, motorVehicleNo=?, dispatchDate=?,
           mailingName=?, address=?, state=?, country=?, pincode=?,
           gstRegistrationType=?, gstin=?, placeOfSupply=?,
           igst_rate=?, cgst_rate=?, sgst_rate=?, carrierName=?,
           consigneeSameAsBilling=?
       WHERE id=?`,
      [
        date, customer, ledgerId, subtotal, gst_percentage, gst_amount, grand_total,
        narration, invoiceNo, pincode || null, igst || 0, cgst || 0, sgst || 0,
        ewayBillNo, ewayBillDate,
        consignorName, consignorGSTIN, consignorState, consignorPincode, consignorAddress, consignorEmail,
        finalConsigneeName, finalConsigneeGSTIN, finalConsigneeState, finalConsigneePincode, finalConsigneeAddress,
        distanceKM,
        vehicleNumber, 
        paymentTerms, otherReferences, buyerOrderNo, buyerOrderDate || null, deliveryNoteDate || null, termsOfDelivery,
        dispatchDocNo || null, referenceNo || null, referenceDate || null,
        deliveryNoteNo || null, dispatchedThrough || null, destination || null,
        billOfLading || null, motorVehicleNo || null, dispatchDate || null,
        mailingName || null, address || null, state || null, country || null, pincode || null,
        gstRegistrationType || null, gstin || null, placeOfSupply || null,
        igst_rate || 0, cgst_rate || 0, sgst_rate || 0, carrierName || null,
        consigneeSameAsBilling ? 1 : 0,
        id
      ]
    );

    // 3. Replace items & deduct stock (FIFO)
    await connection.query(`DELETE FROM sales_items WHERE voucherId = ?`, [id]);
    for (let sold of items) {
      const soldQty = Number(sold.qty);
      await connection.query(
        `INSERT INTO sales_items (voucherId, item, qty, rate, per, amount, hsn_code) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, sold.item, sold.qty, sold.rate, sold.per || '', sold.amount, sold.hsn_code || '']
      );

      let remaining = soldQty;

      // Deduct from trading stock first
      const [tradingRows] = await connection.query(
        `SELECT id, openingBalanceQty FROM stocks WHERE companyId = ? AND LOWER(name) = LOWER(?) AND openingBalanceQty > 0 AND isDeleted = 0 ORDER BY id ASC`,
        [companyId, sold.item]
      );
      for (let row of tradingRows) {
        if (remaining <= 0) break;
        const cur = parseFloat(row.openingBalanceQty);
        if (cur >= remaining) {
          await connection.query(`UPDATE stocks SET openingBalanceQty = ? WHERE id = ?`, [cur - remaining, row.id]);
          remaining = 0;
        } else {
          remaining -= cur;
          await connection.query(`UPDATE stocks SET openingBalanceQty = 0 WHERE id = ?`, [row.id]);
        }
      }

      // Then deduct from manufacturing_journal
      if (remaining > 0) {
        const [mjRows] = await connection.query(
          `SELECT id, finishedQty FROM manufacturing_journal WHERE companyId = ? AND LOWER(productName) = LOWER(?) AND finishedQty > 0 ORDER BY id ASC`,
          [companyId, sold.item]
        );
        for (let row of mjRows) {
          if (remaining <= 0) break;
          const cur = parseFloat(row.finishedQty);
          if (cur >= remaining) {
            await connection.query(`UPDATE manufacturing_journal SET finishedQty = ? WHERE id = ?`, [cur - remaining, row.id]);
            remaining = 0;
          } else {
            remaining -= cur;
            await connection.query(`UPDATE manufacturing_journal SET finishedQty = 0 WHERE id = ?`, [row.id]);
          }
        }
      }
    }

    const sender = company;

    const [clientRows] = await connection.query(
      `SELECT name, address, city, pincode, gstin as gst, state FROM ledgers WHERE id = ?`,
      [ledgerId]
    );
    const clientInfo = clientRows[0] || {};

    const pdfFileName = `Sales_${id}_${Date.now()}.pdf`;
    const pdfData = {
      ...req.body,
      sender: {
        company_name: consignorName || sender.name || "",
        address: consignorAddress || sender.address || "",
        city: sender.city || "",
        pincode: consignorPincode || sender.pinCode || "",
        gst: consignorGSTIN || sender.gstin || sender.gst || "",
        state_name: consignorState || sender.state || "",
        email: consignorEmail || sender.email || "",
        phone: sender.mobile || "",
        country: sender.country || ""
      },
      client: {
        name: req.body.mailingName || req.body.customer || clientInfo.name || "",
        address: req.body.address || clientInfo.address || "",
        city: req.body.city || "",
        pincode: req.body.pincode || clientInfo.pincode || "",
        gst: req.body.gstin || clientInfo.gst || "",
        state_name: req.body.state || clientInfo.state || "",
        country: req.body.country || ""
      },
      items: items.map(item => ({
        itemname: item.item,
        hsnno: item.hsn_code,
        quantity: item.qty,
        unitprice: item.rate,
        per: item.per || '',
        total: item.amount
      })),
      total: grand_total,
      subtotal: subtotal,
      date: date,
      docNumber: invoiceNo || `SALES-${id}`,
      paymentTerms: paymentTerms || "",
      shipping_details: {
        ...(req.body.ewayBillDetails || {}),
        delivery_note: req.body.deliveryNoteNo,
        delivery_note_date: deliveryNoteDate || req.body.dispatchDate,
        reference_no: req.body.referenceNo || "",
        reference_date: req.body.referenceDate || "",
        other_ref: otherReferences || "",
        buyer_order_no: buyerOrderNo || "",
        buyer_order_date: buyerOrderDate || "",
        dispatched_through: req.body.dispatchedThrough,
        destination: req.body.destination,
        dispatch_doc_no: req.body.dispatchDocNo || "",
        bill_of_lading: req.body.billOfLading || "",
        motor_vehicle_no: req.body.motorVehicleNo || "",
        delivery_terms: termsOfDelivery || "",
        carrier_name: carrierName || "",
        dispatch_date: dispatchDate || "",
        consigneeName: finalConsigneeName || "",
        consigneeGSTIN: finalConsigneeGSTIN || "",
        consigneeState: finalConsigneeState || "",
        consigneePincode: finalConsigneePincode || "",
        consigneeAddress: finalConsigneeAddress || ""
      }
    };

    const generatedPdfPath = await generateDocumentPDF(pdfData, "TAX INVOICE", pdfFileName, "sales");

    await connection.query(
      `UPDATE sales_vouchers SET pdf_path = ? WHERE id = ?`,
      [generatedPdfPath, id]
    );

    await connection.commit();
    res.json({ message: "Sale Voucher updated successfully", pdf_path: generatedPdfPath });
  } catch (error) {
    await connection.rollback();
    console.error("UPDATE SALE VOUCHER ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

export const getSaleVoucher = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM sales_vouchers WHERE companyId = ?`,
      [companyId]
    );
    console.log("data is =>", rows);

    if (rows.length === 0) {
      return res.status(404).json({
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
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// 🔵 GET SALE VOUCHER ITEMS BY VOUCHER ID
export const getSaleVoucherItems = async (req, res) => {
  const { voucherId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM sales_items WHERE voucherId = ?`,
      [voucherId]
    );
    return res.status(200).json({ message: "Items fetched successfully", items: rows });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error fetching items" });
  }
};

export const ewaybill = async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, invoiceNo, date, customer, grand_total, ewayBillNo, ewayBillDate, consignorName, consignorGSTIN, consignorState, consignorPincode, consignorAddress, consigneeName, consigneeGSTIN, consigneeState, consigneePincode, consigneeAddress, distanceKM, vehicleNumber FROM sales_vouchers WHERE companyId = ? AND ewayBillNo IS NOT NULL AND ewayBillNo != ''`,
      [companyId]
    );

    return res.status(200).json({
      success: true,
      message: "E-Way Bill vouchers fetched successfully",
      data: rows
    });

  } catch (error) {
    console.error("EWAY BILL ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

export const bulkCreateSalesVoucher = async (req, res) => {
  const { companyId, vouchers } = req.body;
  const creator = getCreatorFromRequest(req);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureCreatorColumns(connection, "sales_vouchers");

    /* ================= SENDER/COMPANY INFO ================= */
    const [companyRows] = await connection.query(
      `SELECT name, address, pinCode, gstin, state FROM companies WHERE id = ?`,
      [companyId]
    );
    const company = companyRows[0] || {};

    /* ================= STOCK QUERIES ================= */
    const getTotalStockQuery = `
      SELECT SUM(finishedQty) AS totalQty
      FROM manufacturing_journal
      WHERE companyId = ? AND LOWER(productName) = LOWER(?)
    `;

    const getFifoStockRowsQuery = `
      SELECT id, finishedQty
      FROM manufacturing_journal
      WHERE companyId = ? AND LOWER(productName) = LOWER(?) AND finishedQty > 0
      ORDER BY id ASC
    `;

    const updateStockQuery = `
      UPDATE manufacturing_journal
      SET finishedQty = ?
      WHERE id = ?
    `;

    const insertVoucherQuery = `
      INSERT INTO sales_vouchers (
        companyId, date, customer, ledgerId, subtotal, gst_percentage,
        gst_amount, grand_total, narration, invoiceNo, igst, cgst, sgst,
        ewayBillNo, ewayBillDate, 
        consignorName, consignorGSTIN, consignorState,
        consignorPincode, consignorAddress,
        consigneeName, consigneeGSTIN, consigneeState,
        consigneePincode, consigneeAddress,
        distanceKM,
        vehicleNumber,
        paymentTerms, otherReferences, buyerOrderNo,
        buyerOrderDate, deliveryNoteDate, termsOfDelivery,
        dispatchDocNo, referenceNo, referenceDate,
        deliveryNoteNo, dispatchedThrough, destination,
        billOfLading, motorVehicleNo, dispatchDate,
        mailingName, address, state, country, pincode,
        gstRegistrationType, gstin, placeOfSupply,
        igst_rate, cgst_rate, sgst_rate, carrierName,
        consigneeSameAsBilling, created_by_user_id, created_by_employee_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?)
    `;

    const insertItemQuery = `
      INSERT INTO sales_items (voucherId, item, qty, rate, amount, hsn_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const voucher of vouchers) {
      const {
        date,
        customer,
        ledgerId,
        subtotal,
        gst_percentage,
        gst_amount,
        grand_total,
        narration,
        invoiceNo,
        items,
        ewayBillDetails = {},
        igst,
        cgst,
        sgst,
        paymentTerms,
        otherReferences,
        buyerOrderNo,
        buyerOrderDate,
        deliveryNoteDate,
        termsOfDelivery,
        deliveryNoteNo,
        dispatchDocNo,
        dispatchedThrough,
        destination,
        billOfLading,
        motorVehicleNo,
        dispatchDate,
        referenceNo,
        referenceDate,
        mailingName, address, state, gstin, pincode, country, placeOfSupply,
        gstRegistrationType, igst_rate, cgst_rate, sgst_rate, carrierName,
        consigneeName: reqBodyConsigneeName,
        consigneeGSTIN: reqBodyConsigneeGSTIN,
        consigneeAddress: reqBodyConsigneeAddress,
        consigneeState: reqBodyConsigneeState,
        consigneePincode: reqBodyConsigneePincode,
        consigneeSameAsBilling
      } = voucher;

      const {
        ewayBillNo, ewayBillDate,
        consignorName = company.name,
        consignorGSTIN = company.gstin,
        consignorState = company.state,
        consignorPincode = company.pinCode,
        consignorAddress = company.address,
        consigneeName: ewayConsigneeName,
        consigneeGSTIN: ewayConsigneeGSTIN,
        consigneeState: ewayConsigneeState,
        consigneePincode: ewayConsigneePincode,
        consigneeAddress: ewayConsigneeAddress,
        distanceKM, 
        vehicleNumber
      } = ewayBillDetails;

      // Consignee Fallback: reqBody -> Party Billing -> eWayBill
      const finalConsigneeName = reqBodyConsigneeName || mailingName || customer || ewayConsigneeName;
      const finalConsigneeGSTIN = reqBodyConsigneeGSTIN || gstin || ewayConsigneeGSTIN;
      const finalConsigneeState = reqBodyConsigneeState || state || ewayConsigneeState;
      const finalConsigneePincode = reqBodyConsigneePincode || pincode || ewayConsigneePincode;
      const finalConsigneeAddress = reqBodyConsigneeAddress || address || ewayConsigneeAddress;

      const [voucherResult] = await connection.query(insertVoucherQuery, [
        companyId,
        date,
        customer,
        ledgerId,
        subtotal,
        gst_percentage,
        gst_amount,
        grand_total,
        narration,
        invoiceNo,
        igst || 0,
        cgst || 0,
        sgst || 0,
        ewayBillNo || null,
        ewayBillDate || null,
     
        consignorName || null,
        consignorGSTIN || null,
        consignorState || null,
        consignorPincode || null,
        consignorAddress || null,

        finalConsigneeName || null,
        finalConsigneeGSTIN || null,
        finalConsigneeState || null,
        finalConsigneePincode || null,
        finalConsigneeAddress || null,
      
        distanceKM || null,
      
        vehicleNumber || null,
     
        paymentTerms || null,
        otherReferences || null,
        buyerOrderNo || null,
        buyerOrderDate || null,
        deliveryNoteDate || null,
        termsOfDelivery || null,

        dispatchDocNo || null,
        referenceNo || null,
        referenceDate || null,
        deliveryNoteNo || null,
        dispatchedThrough || null,
        destination || null,
        billOfLading || null,
        motorVehicleNo || null,
        dispatchDate || null,
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
        consigneeSameAsBilling ? 1 : 0,
        creator.userId,
        creator.employeeId
      ]);

      const voucherId = voucherResult.insertId;

      // Insert voucher transaction for balance sheet and Cash/Bank books
      const [ledgerRow] = await connection.query(`SELECT name, underGroup FROM ledgers WHERE id = ? AND companyId = ?`, [ledgerId, companyId]);
      let transactionAccountType = 'ledger';
      if (ledgerRow.length > 0) {
        const underGroup = (ledgerRow[0].underGroup || "").toLowerCase();
        if (underGroup.includes('cash-in-hand') || ledgerRow[0].name.toLowerCase() === 'cash') {
          transactionAccountType = 'cash';
        } else if (underGroup.includes('bank accounts')) {
          transactionAccountType = 'bank';
        }
      }

      await ensureCreatorColumns(connection, "voucher_transactions");
      await connection.query(
        `INSERT INTO voucher_transactions 
         (companyId, ledgerId, voucherType, voucherId, debit, credit, date, accountType, created_by_user_id, created_by_employee_id)
         VALUES (?, ?, 'Sales', ?, ?, 0, ?, ?, ?, ?)`,
        [companyId, ledgerId, voucherId, grand_total, date, transactionAccountType, creator.userId, creator.employeeId]
      );

      for (const sold of items) {
        const soldQty = Number(sold.qty);

        // 1️⃣ Check if item exists in manufacturing_journal
        const [stockResult] = await connection.query(getTotalStockQuery, [
          companyId,
          sold.item,
        ]);

        const totalAvailable = stockResult[0]?.totalQty || 0;

        // 2️⃣ If item doesn't exist or has insufficient stock, create/add stock
        if (totalAvailable < soldQty) {
          const requiredToAdd = soldQty - totalAvailable;

          // Insert new manufacturing journal entry with required stock
          const insertStockQuery = `
            INSERT INTO manufacturing_journal 
            (companyId, productName, finishedQty, createdAt)
            VALUES (?, ?, ?, NOW())
          `;

          await connection.query(insertStockQuery, [
            companyId,
            sold.item,
            requiredToAdd
          ]);

          console.log(`Auto-created item "${sold.item}" with quantity ${requiredToAdd}`);
        }

        // 3️⃣ Insert sales item
        await connection.query(insertItemQuery, [
          voucherId,
          sold.item,
          sold.qty,
          sold.rate,
          sold.amount,
          sold.hsn_code || ''
        ]);

        // 4️⃣ FIFO stock deduction
        let requiredQty = soldQty;
        const [journalRows] = await connection.query(getFifoStockRowsQuery, [
          companyId,
          sold.item,
        ]);

        for (const row of journalRows) {
          if (requiredQty <= 0) break;

          if (row.finishedQty >= requiredQty) {
            await connection.query(updateStockQuery, [
              row.finishedQty - requiredQty,
              row.id,
            ]);
            requiredQty = 0;
          } else {
            requiredQty -= row.finishedQty;
            await connection.query(updateStockQuery, [0, row.id]);
          }
        }
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Bulk Sales Vouchers Created Successfully" });

  } catch (error) {
    await connection.rollback();
    console.error("BULK SALES VOUCHER ERROR:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create bulk sales vouchers",
    });
  } finally {
    connection.release();
  }
};

/* ================= DELETE SALES VOUCHER ================= */
export const deleteSalesVoucher = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [oldRows] = await connection.query(`SELECT * FROM sales_vouchers WHERE id = ?`, [id]);
    const oldValue = oldRows.length > 0 ? oldRows[0] : null;

    if (!oldValue) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    const companyId = oldValue.companyId;

    // Revert stock quantities
    const [oldItems] = await connection.query(`SELECT * FROM sales_items WHERE voucherId = ?`, [id]);
    for (let item of oldItems) {
      const soldQty = parseFloat(item.qty) || 0;
      const [tradingRows] = await connection.query(
        `SELECT id, openingBalanceQty FROM stocks WHERE companyId = ? AND LOWER(name) = LOWER(?) AND isDeleted = 0 LIMIT 1`,
        [companyId, item.item]
      );
      if (tradingRows.length > 0) {
        await connection.query(`UPDATE stocks SET openingBalanceQty = openingBalanceQty + ? WHERE id = ?`, [soldQty, tradingRows[0].id]);
      } else {
        await connection.query(
          `UPDATE manufacturing_journal SET finishedQty = finishedQty + ? WHERE companyId = ? AND LOWER(productName) = LOWER(?) LIMIT 1`,
          [soldQty, companyId, item.item]
        );
      }
    }

    // Delete items first
    await connection.query(`DELETE FROM sales_items WHERE voucherId = ?`, [id]);
    // Delete transactions
    await connection.query(`DELETE FROM voucher_transactions WHERE voucherType = 'Sales' AND voucherId = ?`, [id]);
    // Delete voucher
    await connection.query(`DELETE FROM sales_vouchers WHERE id = ?`, [id]);

    // Audit Log
    await logAction({
      company_id: oldValue.companyId,
      action: "DELETE",
      entity_type: "SALES_VOUCHER",
      entity_id: id,
      old_value: oldValue
    });

    await connection.commit();
    res.json({ success: true, message: "Sales Voucher deleted successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DELETE SALES VOUCHER ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to delete voucher" });
  } finally {
    connection.release();
  }
};

export const getSaleVoucherById = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(
      `SELECT * FROM sales_vouchers WHERE id = ?`,
      [id]
    );

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const [items] = await pool.query(
      `SELECT * FROM sales_items WHERE voucherId = ?`,
      [id]
    );

    res.json({ ...voucher, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching voucher details" });
  }
};

export const downloadSaleVoucherPDF = async (req, res) => {
  const { id } = req.params;
  try {
    const [[voucher]] = await pool.query(
      `SELECT * FROM sales_vouchers WHERE id = ?`,
      [id]
    );

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const [items] = await pool.query(
      `SELECT * FROM sales_items WHERE voucherId = ?`,
      [id]
    );

    const [[company]] = await pool.query(
      `SELECT * FROM companies WHERE id = ?`,
      [voucher.companyId]
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Fetch client/buyer info
    const [[clientInfo]] = await pool.query(
      `SELECT name, address, pincode, gstin as gst, state FROM ledgers WHERE id = ?`,
      [voucher.ledgerId]
    );
    const client = clientInfo || {};

    const pdfFileName = `Sales_${voucher.id}_${Date.now()}.pdf`;

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
        company_name: voucher.consignorName || company.name || "Cloudsat Private Limited",
        address: voucher.consignorAddress || company.address || "",
        city: company.city || "",
        pincode: voucher.consignorPincode || company.pinCode || "",
        gst: voucher.consignorGSTIN || company.gstin || "",
        state_name: voucher.consignorState || company.state || "",
        email: voucher.consignorEmail || company.email || "",
        phone: company.mobile || "",
        country: company.country || ""
      },
      client: {
        name: voucher.mailingName || voucher.customer || client.name || "",
        address: voucher.address || client.address || "",
        city: "",
        pincode: voucher.pincode || client.pincode || "",
        gst: voucher.gstin || client.gst || "",
        state_name: voucher.state || client.state || "",
        country: voucher.country || ""
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
      docNumber: voucher.invoiceNo || `SALES-${voucher.id}`,
      paymentTerms: voucher.paymentTerms || "",
      shipping_details: {
        ewayBillNo: voucher.ewayBillNo || '',
        ewayBillDate: voucher.ewayBillDate || '',
        distanceKM: voucher.distanceKM || '',
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
        consigneeAddress: voucher.consigneeAddress || ""
      }
    };

    const generatedPdfPath = await generateDocumentPDF(pdfData, "TAX INVOICE", pdfFileName, "sales");

    await pool.query(
      `UPDATE sales_vouchers SET pdf_path = ? WHERE id = ?`,
      [generatedPdfPath, id]
    );

    res.download(path.join(process.cwd(), generatedPdfPath));
  } catch (error) {
    console.error("Error downloading sale voucher PDF:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
