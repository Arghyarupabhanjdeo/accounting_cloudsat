import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import pool from "../db.js";

/**
 * Generates a professional PDF document for Credit/Debit Notes (Exact Tally-style as format.js)
 * @param {Object} data - structured data for the PDF
 * @param {string} type - 'CREDIT NOTE' or 'DEBIT NOTE'
 * @param {string} fileName - output filename
 * @param {string} subDir - subdirectory in uploads
 * @returns {Promise<string>} - Path to the generated PDF
 */
const getStateCode = (gstin) => {
    if (gstin && gstin.length >= 2) {
        const code = gstin.substring(0, 2);
        if (/^\d+$/.test(code)) {
            return code;
        }
    }
    return "";
};

export const generateNotePDF = async (data, type, fileName, subDir) => {
    let logoPath = null;
    if (data.sender && (data.sender.email || data.sender.phone)) {
        try {
            const [users] = await pool.query(
                `SELECT company_logo FROM users WHERE email = ? OR phone = ?`,
                [data.sender.email, data.sender.phone]
            );
            if (users.length > 0 && users[0].company_logo) {
                logoPath = path.resolve(users[0].company_logo);
                if (!fs.existsSync(logoPath)) {
                    logoPath = path.join("uploads/company-logos", path.basename(users[0].company_logo));
                }
            }
        } catch (error) {
            console.error("Error fetching logo:", error);
        }
    }

    return new Promise((resolve, reject) => {
        try {
            const uploadDir = path.join("uploads", subDir);
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, fileName);
            const doc = new PDFDocument({ size: "A4", margin: 30 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // --- CONSTANTS ---
            const MARGIN = 30;
            const PAGE_WIDTH = 595.28;
            const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
            const COL_LEFT_DIVIDER = MARGIN + (CONTENT_WIDTH * 0.5);
            const RIGHT_INNER_DIVIDER_OFFSET = CONTENT_WIDTH * 0.25;

            const formatCurrency = (amount) => {
                return "Rs. " + Number(amount || 0).toFixed(2);
            };

            const formatDate = (dateStr) => {
                if (!dateStr) return "-";
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            };

            const numberToWords = (num) => {
                if (typeof num === "undefined" || num === null || isNaN(num) || !isFinite(num)) return "Zero Only";
                const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
                    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
                const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
                const inWords = (n) => {
                    if (!n || isNaN(n) || n === 0) return '';
                    if (n < 20) return a[n];
                    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
                    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + inWords(n % 100);
                    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
                    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
                    return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
                };
                const amount = Math.floor(Math.abs(num));
                const paisa = Math.round((Math.abs(num) - amount) * 100);
                if (amount === 0 && paisa === 0) return "Zero Only";
                let res = "INR " + (amount === 0 ? "" : inWords(amount)) + "Only";
                if (paisa > 0) res = "INR " + (amount === 0 ? "Zero " : inWords(amount)) + "and " + inWords(paisa) + " Paisa Only";
                return res;
            };

            // ─────────────────────────────────────────────
            // HEADER & TITLE
            // ─────────────────────────────────────────────
            let y = MARGIN;

            // Centered Document Type Title
            doc.fontSize(12).font("Helvetica-Bold").text(type, MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
            y = doc.y + 8;

            // ─────────────────────────────────────────────
            // HEADER BOX
            // ─────────────────────────────────────────────
            const headerStartY = y;
            const logisticsRowHeight = 39;
            const logisticsRows = 8;
            const headerHeight = logisticsRowHeight * logisticsRows; // 312

            doc.lineWidth(1).strokeColor("#000000").rect(MARGIN, headerStartY, CONTENT_WIDTH, headerHeight).stroke();
            doc.moveTo(COL_LEFT_DIVIDER, headerStartY).lineTo(COL_LEFT_DIVIDER, headerStartY + headerHeight).stroke();

            // Symmetrical division of the Left Column into 3 boxes:
            // 1. Company (Sender) details: [headerStartY, headerStartY + 104]
            // 2. Consignee (Ship to) details: [headerStartY + 104, headerStartY + 208]
            // 3. Buyer (Bill to) details: [headerStartY + 208, headerStartY + 312]
            const boxHeight = 104;
            const consigneeStartY = headerStartY + boxHeight;
            const buyerStartY = headerStartY + boxHeight * 2;

            doc.moveTo(MARGIN, consigneeStartY).lineTo(COL_LEFT_DIVIDER, consigneeStartY).stroke();
            doc.moveTo(MARGIN, buyerStartY).lineTo(COL_LEFT_DIVIDER, buyerStartY).stroke();

            // ----------------------------------------------------
            // 1. SENDER / COMPANY DETAILS (Top-Left Box)
            // ----------------------------------------------------
            let companyY = headerStartY + 5;
            doc.fontSize(9).font("Helvetica-Bold").text(data.sender.company_name || "Cloudsat Private Limited", MARGIN + 5, companyY, { width: (CONTENT_WIDTH * 0.5) - 10 });
            companyY = doc.y + 3;

            doc.fontSize(8).font("Helvetica").text(data.sender.address || "", MARGIN + 5, companyY, { width: (CONTENT_WIDTH * 0.5) - 10 });
            companyY = doc.y + 4;

            if (data.sender.gst) {
                doc.fontSize(8).font("Helvetica-Bold").text("GSTIN/UIN: ", MARGIN + 5, companyY, { continued: true });
                doc.font("Helvetica").text(data.sender.gst);
                companyY = doc.y + 2;
            }

            const senderState = data.sender.state || "";
            const senderStateCode = getStateCode(data.sender.gst);
            if (senderState) {
                doc.fontSize(8).font("Helvetica-Bold").text("State Name : ", MARGIN + 5, companyY, { continued: true });
                doc.font("Helvetica").text(senderState + (senderStateCode ? `, Code : ${senderStateCode}` : ""));
            }

            // ----------------------------------------------------
            // 2. CONSIGNEE DETAILS (Middle-Left Box)
            // ----------------------------------------------------
            let consigneeY = consigneeStartY + 5;
            doc.fontSize(8).font("Helvetica").text("Consignee (Ship to):", MARGIN + 5, consigneeY);
            consigneeY = doc.y + 2;

            const consigneeName = data.dispatchDetails.consigneeSameAsBilling ? data.partyDetails.mailingName : data.dispatchDetails.consigneeName;
            if (consigneeName) {
                doc.fontSize(9).font("Helvetica-Bold").text(consigneeName, MARGIN + 5, consigneeY, { width: (CONTENT_WIDTH * 0.5) - 10 });
                consigneeY = doc.y + 3;
            }

            const consigneeAddress = data.dispatchDetails.consigneeSameAsBilling ? data.partyDetails.address : data.dispatchDetails.consigneeAddress;
            if (consigneeAddress) {
                doc.fontSize(8).font("Helvetica").text(consigneeAddress, MARGIN + 5, consigneeY, { width: (CONTENT_WIDTH * 0.5) - 10 });
                consigneeY = doc.y + 4;
            }

            const consigneeGSTIN = data.dispatchDetails.consigneeSameAsBilling ? data.partyDetails.gstin : data.dispatchDetails.consigneeGSTIN;
            if (consigneeGSTIN) {
                doc.fontSize(8).font("Helvetica-Bold").text("GSTIN/UIN: ", MARGIN + 5, consigneeY, { continued: true });
                doc.font("Helvetica").text(consigneeGSTIN);
                consigneeY = doc.y + 2;
            }

            const consigneeState = data.dispatchDetails.consigneeSameAsBilling ? data.partyDetails.state : data.dispatchDetails.consigneeState;
            const consigneeStateCode = getStateCode(consigneeGSTIN);
            if (consigneeState) {
                doc.fontSize(8).font("Helvetica-Bold").text("State Name : ", MARGIN + 5, consigneeY, { continued: true });
                doc.font("Helvetica").text(consigneeState + (consigneeStateCode ? `, Code : ${consigneeStateCode}` : ""));
            }

            // ----------------------------------------------------
            // 3. BUYER DETAILS (Bottom-Left Box)
            // ----------------------------------------------------
            let buyerY = buyerStartY + 5;
            doc.fontSize(8).font("Helvetica").text("Buyer (Bill to):", MARGIN + 5, buyerY);
            buyerY = doc.y + 2;

            if (data.partyDetails.mailingName) {
                doc.fontSize(9).font("Helvetica-Bold").text(data.partyDetails.mailingName, MARGIN + 5, buyerY, { width: (CONTENT_WIDTH * 0.5) - 10 });
                buyerY = doc.y + 3;
            }

            if (data.partyDetails.address) {
                doc.fontSize(8).font("Helvetica").text(data.partyDetails.address, MARGIN + 5, buyerY, { width: (CONTENT_WIDTH * 0.5) - 10 });
                buyerY = doc.y + 4;
            }

            if (data.partyDetails.gstin) {
                doc.fontSize(8).font("Helvetica-Bold").text("GSTIN/UIN: ", MARGIN + 5, buyerY, { continued: true });
                doc.font("Helvetica").text(data.partyDetails.gstin);
                buyerY = doc.y + 2;
            }

            const buyerState = data.partyDetails.state || "";
            const buyerStateCode = getStateCode(data.partyDetails.gstin);
            if (buyerState) {
                doc.fontSize(8).font("Helvetica-Bold").text("State Name : ", MARGIN + 5, buyerY, { continued: true });
                doc.font("Helvetica").text(buyerState + (buyerStateCode ? `, Code : ${buyerStateCode}` : ""));
            }

            // LOGISTICS (RIGHT SIDE)
            let currentRightY = headerStartY;
            const drawLogisticsRow = (label1, value1, label2, value2, height = logisticsRowHeight) => {
                const innerDivX = COL_LEFT_DIVIDER + RIGHT_INNER_DIVIDER_OFFSET;
                doc.moveTo(COL_LEFT_DIVIDER, currentRightY + height).lineTo(MARGIN + CONTENT_WIDTH, currentRightY + height).stroke();
                if (label2 !== null) doc.moveTo(innerDivX, currentRightY).lineTo(innerDivX, currentRightY + height).stroke();
                doc.fontSize(8).font("Helvetica").text(label1, COL_LEFT_DIVIDER + 3, currentRightY + 3, { width: RIGHT_INNER_DIVIDER_OFFSET - 5 });
                doc.fontSize(8).font("Helvetica-Bold").text(value1 || "-", COL_LEFT_DIVIDER + 3, currentRightY + 13, { width: RIGHT_INNER_DIVIDER_OFFSET - 5 });
                if (label2 !== null) {
                    doc.fontSize(8).font("Helvetica").text(label2 || "", innerDivX + 3, currentRightY + 3, { width: RIGHT_INNER_DIVIDER_OFFSET - 5 });
                    doc.fontSize(8).font("Helvetica-Bold").text(value2 || "-", innerDivX + 3, currentRightY + 13, { width: RIGHT_INNER_DIVIDER_OFFSET - 5 });
                }
                currentRightY += height;
            };

            drawLogisticsRow("Note No.", data.voucherNo, "Dated", formatDate(data.date));
            drawLogisticsRow("Original Invoice No.", data.dispatchDetails.originalInvoiceNo || "-", "Original Invoice Date", formatDate(data.dispatchDetails.originalInvoiceDate));
            drawLogisticsRow("Reference No.", data.dispatchDetails.referenceNo || "-", "Reference Date", formatDate(data.dispatchDetails.referenceDate));
            drawLogisticsRow("Other References", data.dispatchDetails.otherReferences || "-", "Destination", data.dispatchDetails.destination || "-");
            drawLogisticsRow("Buyer Order No.", data.dispatchDetails.buyerOrderNo || "-", "Dated", formatDate(data.dispatchDetails.buyerOrderDate));
            drawLogisticsRow("Dispatch Doc No.", data.dispatchDetails.dispatchDocNo || "-", "Dispatched through", data.dispatchDetails.dispatchedThrough || "-");

            doc.fontSize(8).font("Helvetica").text("Terms of Delivery", COL_LEFT_DIVIDER + 3, currentRightY + 3);
            doc.fontSize(8).font("Helvetica-Bold").text(data.dispatchDetails.termsOfDelivery || "-", COL_LEFT_DIVIDER + 3, currentRightY + 13, { width: (CONTENT_WIDTH * 0.5) - 8 });
            currentRightY = headerStartY + headerHeight;

            y = headerStartY + headerHeight;

            // ─────────────────────────────────────────────
            // ITEMS TABLE
            // ─────────────────────────────────────────────
            const colSI = MARGIN;
            const colDesc = MARGIN + 20;
            const colHSN = MARGIN + 200;
            const colQty = MARGIN + 260;
            const colRate = MARGIN + 320;
            const colPer = MARGIN + 380;
            const colDisc = MARGIN + 420;
            const colAmount = MARGIN + 460;

            const drawTableHeader = (yPos) => {
                doc.rect(MARGIN, yPos, CONTENT_WIDTH, 20).stroke();
                [colDesc, colHSN, colQty, colRate, colPer, colDisc, colAmount].forEach(x => doc.moveTo(x, yPos).lineTo(x, yPos + 20).stroke());
                doc.fontSize(8).font("Helvetica-Bold");
                doc.text("SI", colSI + 2, yPos + 6);
                doc.text("Description of Goods", colDesc + 4, yPos + 6);
                doc.text("HSN/SAC", colHSN + 2, yPos + 6, { width: colQty - colHSN - 4, align: 'center' });
                doc.text("Quantity", colQty + 2, yPos + 6, { width: colRate - colQty - 4, align: 'center' });
                doc.text("Rate", colRate + 2, yPos + 6, { width: colPer - colRate - 4, align: 'center' });
                doc.text("per", colPer + 2, yPos + 6, { width: colDisc - colPer - 4, align: 'center' });
                doc.text("Disc%", colDisc + 2, yPos + 6, { width: colAmount - colDisc - 4, align: 'center' });
                doc.text("Amount", colAmount + 2, yPos + 6, { width: MARGIN + CONTENT_WIDTH - colAmount - 4, align: 'right' });
                return yPos + 20;
            };

            const drawVerticalLines = (startY, endY) => {
                [MARGIN, colDesc, colHSN, colQty, colRate, colPer, colDisc, colAmount, MARGIN + CONTENT_WIDTH].forEach(x => {
                    doc.moveTo(x, startY).lineTo(x, endY).stroke();
                });
            };

            let currentTableTop = y;
            let currentItemY = drawTableHeader(currentTableTop);

            data.items.forEach((item, i) => {
                const rowHeight = 20;
                if (currentItemY + rowHeight > 760) {
                    drawVerticalLines(currentTableTop, currentItemY);
                    doc.moveTo(MARGIN, currentItemY).lineTo(MARGIN + CONTENT_WIDTH, currentItemY).stroke();
                    doc.addPage();
                    currentItemY = MARGIN;
                    currentTableTop = currentItemY;
                    currentItemY = drawTableHeader(currentTableTop);
                }
                const rowStartY = currentItemY;
                doc.fontSize(9).font("Helvetica").text(`${i + 1}`, colSI + 2, rowStartY + 5, { width: colDesc - colSI - 4, align: 'center' });
                doc.font("Helvetica-Bold").text(item.itemName || "-", colDesc + 4, rowStartY + 5, { width: colHSN - colDesc - 8 });
                doc.fontSize(9).font("Helvetica").text(item.hsn_code || "-", colHSN + 2, rowStartY + 5, { width: colQty - colHSN - 4, align: 'center' });
                doc.font("Helvetica-Bold").text(`${item.qty}`, colQty + 2, rowStartY + 5, { width: colRate - colQty - 4, align: 'center' });
                doc.text(Number(item.rate || 0).toFixed(2), colRate + 2, rowStartY + 5, { width: colPer - colRate - 4, align: 'right' });
                doc.font("Helvetica").text(item.per || '', colPer + 2, rowStartY + 5, { width: colDisc - colPer - 4, align: 'center' });
                doc.text(item.discount + "%", colDisc + 2, rowStartY + 5, { width: colAmount - colDisc - 4, align: 'center' });
                doc.font("Helvetica-Bold").text(Number(item.amount || 0).toFixed(2), colAmount + 2, rowStartY + 5, { width: MARGIN + CONTENT_WIDTH - colAmount - 4, align: 'right' });
                doc.moveTo(MARGIN, rowStartY + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, rowStartY + rowHeight).stroke();
                currentItemY += rowHeight;
            });

            // Space filler
            const FIXED_TABLE_HEIGHT = 100;
            if (currentItemY - currentTableTop < FIXED_TABLE_HEIGHT) {
                const remaining = FIXED_TABLE_HEIGHT - (currentItemY - currentTableTop);
                drawVerticalLines(currentItemY, currentItemY + remaining);
                currentItemY += remaining;
            }
            drawVerticalLines(currentTableTop, currentItemY);
            doc.moveTo(MARGIN, currentItemY).lineTo(MARGIN + CONTENT_WIDTH, currentItemY).stroke();

            // GST lines
            let gstTextY = currentItemY + 5;
            const adjs = [];
            if (data.igst_amount > 0) adjs.push({ label: `OUTPUT IGST @ ${data.igst_rate}%`, val: data.igst_amount });
            if (data.cgst_amount > 0) adjs.push({ label: `OUTPUT CGST @ ${data.cgst_rate}%`, val: data.cgst_amount });
            if (data.sgst_amount > 0) adjs.push({ label: `OUTPUT SGST @ ${data.sgst_rate}%`, val: data.sgst_amount });
            
            doc.fontSize(9).font("Helvetica-Bold");
            adjs.forEach(adj => {
                doc.text(adj.label, colDesc + 20, gstTextY);
                doc.text(formatCurrency(adj.val), colAmount + 2, gstTextY, { width: MARGIN + CONTENT_WIDTH - colAmount - 10, align: "right" });
                gstTextY += 15;
            });
            if (adjs.length > 0) {
                drawVerticalLines(currentItemY, gstTextY + 5);
                currentItemY = gstTextY + 5;
                doc.moveTo(MARGIN, currentItemY).lineTo(MARGIN + CONTENT_WIDTH, currentItemY).stroke();
            }

            // TOTAL ROW
            doc.rect(MARGIN, currentItemY, CONTENT_WIDTH, 20).stroke();
            [colDesc, colHSN, colQty, colRate, colPer, colDisc, colAmount].forEach(x => doc.moveTo(x, currentItemY).lineTo(x, currentItemY + 20).stroke());
            doc.fontSize(9).font("Helvetica-Bold").text("Total", colDesc + 4, currentItemY + 5);
            const totalQty = data.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
            doc.text(`${totalQty}`, colQty + 2, currentItemY + 5, { width: colRate - colQty - 4, align: 'center' });
            doc.text(formatCurrency(data.grand_total), colAmount + 2, currentItemY + 5, { width: MARGIN + CONTENT_WIDTH - colAmount - 10, align: 'right' });
            y = currentItemY + 20;

            // Amount in words
            doc.rect(MARGIN, y, CONTENT_WIDTH, 30).stroke();
            doc.fontSize(8).font("Helvetica-Bold").text("Amount Chargeable (in words)", MARGIN + 5, y + 3);
            doc.fontSize(9).font("Helvetica-Bold").text(numberToWords(data.grand_total), MARGIN + 5, y + 14, { width: CONTENT_WIDTH - 10 });
            y += 30;

            // GST Table
            const hsnGroups = {};
            data.items.forEach(item => {
                const hsn = item.hsnno || "N/A";
                if (!hsnGroups[hsn]) hsnGroups[hsn] = { taxable: 0 };
                hsnGroups[hsn].taxable += Number(item.amount || 0);
            });
            const hsnEntries = Object.entries(hsnGroups);
            const gstTableH = 30 + (hsnEntries.length * 18) + 18;
            if (y + gstTableH > 720) { doc.addPage(); y = MARGIN; }
            doc.rect(MARGIN, y, CONTENT_WIDTH, gstTableH).stroke();
            const gstX = [MARGIN, MARGIN + 80, MARGIN + 160, MARGIN + 215, MARGIN + 280, MARGIN + 335, MARGIN + 400];
            [gstX[1], gstX[2], gstX[6]].forEach(x => doc.moveTo(x, y).lineTo(x, y + gstTableH).stroke());
            if (data.igst_amount > 0) {
                doc.moveTo(gstX[2] + 120, y + 14).lineTo(gstX[2] + 120, y + gstTableH).stroke();
            } else {
                [gstX[3], gstX[5]].forEach(x => doc.moveTo(x, y + 14).lineTo(x, y + gstTableH).stroke());
            }
            doc.moveTo(MARGIN, y + 30).lineTo(MARGIN + CONTENT_WIDTH, y + 30).stroke();
            doc.moveTo(gstX[2], y + 13).lineTo(gstX[6], y + 13).stroke();

            doc.fontSize(7).font("Helvetica-Bold");
            doc.text("HSN/SAC", gstX[0] + 2, y + 10, { width: 76, align: 'center' });
            doc.text("Taxable Value", gstX[1] + 2, y + 10, { width: 76, align: 'center' });
            if (data.igst_amount > 0) {
                doc.text(`Integrated Tax @ ${data.igst_rate}%`, gstX[2] + 2, y + 3, { width: 240, align: 'center' });
                doc.text("Rate", gstX[2] + 2, y + 16, { width: 120, align: 'center' });
                doc.text("Amount", gstX[2] + 120, y + 16, { width: 120, align: 'center' });
            } else {
                doc.text(`Central Tax @ ${data.cgst_rate}%`, gstX[2] + 2, y + 3, { width: 120, align: 'center' });
                doc.text("Rate", gstX[2] + 2, y + 16, { width: 55, align: 'center' });
                doc.text("Amount", gstX[3] + 2, y + 16, { width: 65, align: 'center' });
                doc.text(`State Tax @ ${data.sgst_rate}%`, gstX[4] + 2, y + 3, { width: 120, align: 'center' });
                doc.text("Rate", gstX[4] + 2, y + 16, { width: 55, align: 'center' });
                doc.text("Amount", gstX[5] + 2, y + 16, { width: 65, align: 'center' });
            }
            doc.text("Total Tax Amount", gstX[6] + 2, y + 10, { width: CONTENT_WIDTH - 400 - MARGIN, align: 'center' });

            let gstRowY = y + 30;
            let totalTaxSum = 0;
            hsnEntries.forEach(([hsn, group]) => {
                let rowTax = data.igst_amount > 0 ? (group.taxable * data.igst_rate / 100) : (group.taxable * (data.cgst_rate + data.sgst_rate) / 100);
                totalTaxSum += rowTax;
                doc.fontSize(8).font("Helvetica").text(hsn, gstX[0] + 2, gstRowY + 4, { width: 76, align: 'center' });
                doc.text(group.taxable.toFixed(2), gstX[1] + 2, gstRowY + 4, { width: 70, align: 'right' });
                if (data.igst_amount > 0) {
                    doc.text(`${data.igst_rate}%`, gstX[2] + 2, gstRowY + 4, { width: 120, align: 'center' });
                    doc.text(rowTax.toFixed(2), gstX[2] + 120, gstRowY + 4, { width: 110, align: 'right' });
                } else {
                    doc.text(`${data.cgst_rate}%`, gstX[2] + 2, gstRowY + 4, { width: 55, align: 'center' });
                    doc.text((group.taxable * data.cgst_rate / 100).toFixed(2), gstX[3] + 2, gstRowY + 4, { width: 60, align: 'right' });
                    doc.text(`${data.sgst_rate}%`, gstX[4] + 2, gstRowY + 4, { width: 55, align: 'center' });
                    doc.text((group.taxable * data.sgst_rate / 100).toFixed(2), gstX[5] + 2, gstRowY + 4, { width: 60, align: 'right' });
                }
                doc.text(rowTax.toFixed(2), gstX[6] + 2, gstRowY + 4, { width: 120, align: 'right' });
                gstRowY += 18;
                doc.moveTo(MARGIN, gstRowY).lineTo(MARGIN + CONTENT_WIDTH, gstRowY).stroke();
            });
            y = gstRowY + 20;

            // Narration
            if (y + 30 > 720) { doc.addPage(); y = MARGIN; }
            doc.fontSize(8).font("Helvetica-Bold").text("Narration: " + (data.narration || "-"), MARGIN, y);
            y += 20;

            // Footer
            const footerY = doc.page.height - 110;
            doc.rect(MARGIN, footerY, CONTENT_WIDTH, 80).stroke();
            doc.moveTo(MARGIN + (CONTENT_WIDTH * 0.6), footerY).lineTo(MARGIN + (CONTENT_WIDTH * 0.6), footerY + 80).stroke();
            doc.fontSize(8).font("Helvetica").text("Declaration:", MARGIN + 5, footerY + 5);
            doc.text("We declare that this note shows the actual price of the goods described and that all particulars are true and correct.", MARGIN + 5, footerY + 15, { width: CONTENT_WIDTH * 0.55 });
            doc.fontSize(9).font("Helvetica-Bold").text("For " + (data.sender.company_name || "Cloudsat Private Limited"), MARGIN + (CONTENT_WIDTH * 0.6) + 5, footerY + 5, { width: CONTENT_WIDTH * 0.38, align: 'right' });
            doc.text("Authorised Signatory", MARGIN + (CONTENT_WIDTH * 0.6) + 5, footerY + 65, { width: CONTENT_WIDTH * 0.38, align: 'right' });

            doc.end();
            stream.on("finish", () => resolve(filePath));
            stream.on("error", reject);
        } catch (err) { reject(err); }
    });
};
