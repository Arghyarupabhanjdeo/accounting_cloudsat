



import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import pool from "../db.js";

/**
 * Generates a professional PDF document (Tally-style)
 * @param {Object} data - structured data for the PDF
 * @param {string} type - 'INVOICE', 'CHALLAN', 'QUOTATION', 'PROFORMA'
 * @param {string} fileName - output filename
 * @param {string} subDir - subdirectory in uploads
 * @returns {Promise<string>} - Path to the generated PDF
 */

export const generateDocumentPDF = async (data, type, fileName, subDir) => {
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

            doc.registerFont('Roboto', path.join('assets', 'fonts', 'Roboto-Regular.ttf'));
            doc.registerFont('Roboto-Bold', path.join('assets', 'fonts', 'Roboto-Bold.ttf'));

            // --- CONSTANTS ---
            const MARGIN = 30;
            const PAGE_WIDTH = 595.28;
            const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

            // Left half ends / right half starts at 50% split
            const COL_LEFT_DIVIDER = MARGIN + (CONTENT_WIDTH * 0.5);

            // RIGHT inner divider: splits the right half (CONTENT_WIDTH * 0.5) into two equal parts
            // FIX: was CONTENT_WIDTH * 0.2 (40% of right col), now CONTENT_WIDTH * 0.25 (50% of right col)
            const RIGHT_INNER_DIVIDER_OFFSET = CONTENT_WIDTH * 0.25;

            // const formatCurrency = (amount) =>
            //     `\u20B9 ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

            const formatCurrency = (amount) => {
                return "₹ " + Number(amount || 0).toFixed(2);
            };

            const formatDate = (dateStr) => {
                if (!dateStr) return "-";
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            };

            const numberToWords = (num) => {
                if (typeof num === "undefined" || num === null || isNaN(num) || !isFinite(num)) {
                    return "Zero Only";
                }

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
                if (paisa > 0) {
                    res = "INR " + (amount === 0 ? "Zero " : inWords(amount)) + "and " + inWords(paisa) + " Paisa Only";
                }
                return res;
            };

            // ─────────────────────────────────────────────
            // DOCUMENT TITLE
            // ─────────────────────────────────────────────
            let y = MARGIN;
            doc.fontSize(12).font("Roboto-Bold").text(type || "Tax Invoice", MARGIN, y, { align: 'center', width: CONTENT_WIDTH });
            y += 18;

            // ─────────────────────────────────────────────
            // HEADER BOX
            // ─────────────────────────────────────────────
            const headerStartY = y;

            // We'll calculate header height dynamically based on content rows
            // Fixed row heights on RIGHT side:
            const logisticsRowHeight = 39;
            const logisticsRows = 8; // Including Terms of Delivery
            const headerHeight = logisticsRowHeight * logisticsRows;

            // Draw outer header box
            doc.lineWidth(1).strokeColor("#000000").rect(MARGIN, headerStartY, CONTENT_WIDTH, headerHeight).stroke();

            // Main vertical divider (left | right)
            doc.moveTo(COL_LEFT_DIVIDER, headerStartY).lineTo(COL_LEFT_DIVIDER, headerStartY + headerHeight).stroke();

            // ── LEFT SIDE ──

            // Seller info
            doc.fontSize(11).font("Roboto-Bold").text(data.sender.company_name || "Cloudsat Private Limited", MARGIN + 5, headerStartY + 5);

            let sellerAddrY = headerStartY + 18;
           let sellerAddressStr = data.sender.address || "";

if (data.sender.city)
  sellerAddressStr += (sellerAddressStr ? ", " : "") + data.sender.city;

if (data.sender.state_name)
  sellerAddressStr += (sellerAddressStr ? ", " : "") + data.sender.state_name;

if (data.sender.country)
  sellerAddressStr += (sellerAddressStr ? ", " : "") + data.sender.country;

if (data.sender.pincode)
  sellerAddressStr += (sellerAddressStr ? " - " : "") + data.sender.pincode;
            doc.fontSize(8).font("Roboto").text(sellerAddressStr, MARGIN + 5, sellerAddrY, { width: (CONTENT_WIDTH * 0.5) - 10 });
            sellerAddrY = doc.y;

            let currentLeftY = sellerAddrY + 2;
            if (data.sender.gst) {
                doc.fontSize(8).font("Roboto-Bold").text("GSTIN/UIN: ", MARGIN + 5, currentLeftY, { continued: true });
                doc.font("Roboto").text(data.sender.gst);
                currentLeftY = doc.y;
            }
            if (data.sender.state_name) {
                doc.fontSize(8).font("Roboto-Bold").text("State Name : ", MARGIN + 5, currentLeftY, { continued: true });
                // doc.font("Roboto").text(`${data.sender.state_name}, Code : `);
             doc.font("Roboto").text(
  `${data.sender.state_name || ""}`
);
                currentLeftY = doc.y;
            }

            // Horizontal line: below Seller → before Consignee
            // Align with bottom of 2nd row on right
            const consigneeStartY = headerStartY + logisticsRowHeight * 2;
            doc.moveTo(MARGIN, consigneeStartY).lineTo(COL_LEFT_DIVIDER, consigneeStartY).stroke();

            doc.fontSize(8).font("Roboto").text("Consignee (Ship to):", MARGIN + 5, consigneeStartY + 2);
            doc.fontSize(9).font("Roboto-Bold").text(
                data.shipping_details?.consigneeName || data.client.name, MARGIN + 5, consigneeStartY + 12
            );

            let consAddrY = consigneeStartY + 23;
            const shipCity = data.shipping_details?.consigneeCity || data.client?.city;
            const shipPin = data.shipping_details?.consigneePincode || data.client?.pincode;
            
            let consAddressStr = data.shipping_details?.consigneeAddress || data.client.address || "";
            if (shipCity) consAddressStr += (consAddressStr ? ", " : "") + shipCity;
            if (data.client?.country) consAddressStr += (consAddressStr ? ", " : "") + data.client.country;
            if (shipPin) consAddressStr += (consAddressStr ? " - " : "") + shipPin;

            doc.fontSize(8).font("Roboto").text(consAddressStr, MARGIN + 5, consAddrY, { width: (CONTENT_WIDTH * 0.5) - 10 });
            consAddrY = doc.y;

            let consigneeGstY = Math.max(consigneeStartY + 55, consAddrY + 2);
            if (data.shipping_details?.consigneeGSTIN || data.client?.gst) {
                doc.fontSize(8).font("Roboto-Bold").text("GSTIN/UIN : ", MARGIN + 5, consigneeGstY, { continued: true });
                doc.font("Roboto").text(data.shipping_details?.consigneeGSTIN || data.client?.gst);
                consigneeGstY = doc.y;
            }
            if (data.shipping_details?.consigneeState || data.client?.state_name) {
                doc.fontSize(8).font("Roboto-Bold").text("State Name : ", MARGIN + 5, consigneeGstY, { continued: true });
                doc.font("Roboto").text(data.shipping_details?.consigneeState || data.client?.state_name);
            }

            const isPurchase = type?.toUpperCase().includes("PURCHASE");

            // Horizontal line: below Consignee → before Buyer/Supplier
            // Align with bottom of 5th row on right
            const buyerStartY = headerStartY + logisticsRowHeight * 5;
            doc.moveTo(MARGIN, buyerStartY).lineTo(COL_LEFT_DIVIDER, buyerStartY).stroke();

            doc.fontSize(8).font("Roboto").text(isPurchase ? "Supplier (Bill from):" : "Buyer (Bill to):", MARGIN + 5, buyerStartY + 2);
            doc.fontSize(9).font("Roboto-Bold").text(isPurchase ? (data.supplier?.name || data.customer || "") : data.client.name, MARGIN + 5, buyerStartY + 12);

            let buyerAddrY = buyerStartY + 23;
            let buyerAddressStr = "";
            if (isPurchase) {
                buyerAddressStr = data.supplier?.address || "";
                const supplierCity = data.supplier?.city;
                const supplierPin = data.supplier?.pincode;
                if (supplierCity) buyerAddressStr += (buyerAddressStr ? ", " : "") + supplierCity;
                if (supplierPin) buyerAddressStr += (buyerAddressStr ? " - " : "") + supplierPin;
            } else {
                buyerAddressStr = data.client.address || "";
                if (data.client.city) buyerAddressStr += (buyerAddressStr ? ", " : "") + data.client.city;
                if (data.client.country) buyerAddressStr += (buyerAddressStr ? ", " : "") + data.client.country;
                if (data.client.pincode) buyerAddressStr += (buyerAddressStr ? " - " : "") + data.client.pincode;
            }

            doc.fontSize(8).font("Roboto").text(buyerAddressStr, MARGIN + 5, buyerAddrY, { width: (CONTENT_WIDTH * 0.5) - 10 });
            buyerAddrY = doc.y;

            let buyerGstY = Math.max(buyerStartY + 55, buyerAddrY + 2);
            if (isPurchase ? data.supplier?.gst : data.client.gst) {
                doc.fontSize(8).font("Roboto-Bold").text("GSTIN/UIN : ", MARGIN + 5, buyerGstY, { continued: true });
                doc.font("Roboto").text(isPurchase ? data.supplier?.gst : data.client.gst);
                buyerGstY = doc.y;
            }
            if (isPurchase ? data.supplier?.state_name : data.client.state_name) {
                doc.fontSize(8).font("Roboto-Bold").text("State Name : ", MARGIN + 5, buyerGstY, { continued: true });
                doc.font("Roboto").text(isPurchase ? data.supplier?.state_name : data.client.state_name);
            }

            // ── RIGHT SIDE (Logistics Rows) ──
            let currentRightY = headerStartY;

            /**
             * FIX: drawLogisticsRow
             * - The right column spans from COL_LEFT_DIVIDER to MARGIN + CONTENT_WIDTH
             *   i.e. total right width = CONTENT_WIDTH * 0.5
             * - Inner vertical divider should split this 50/50:
             *   x = COL_LEFT_DIVIDER + (CONTENT_WIDTH * 0.25)
             * - The horizontal bottom line must span the FULL right column
             * - Last row (Terms of Delivery) still draws its bottom line
             */
            const drawLogisticsRow = (label1, value1, label2, value2, height = logisticsRowHeight) => {
                const innerDivX = COL_LEFT_DIVIDER + RIGHT_INNER_DIVIDER_OFFSET;
                const rightEndX = MARGIN + CONTENT_WIDTH;

                // Bottom horizontal line for this row
                doc.moveTo(COL_LEFT_DIVIDER, currentRightY + height)
                    .lineTo(rightEndX, currentRightY + height).stroke();

                // Inner vertical divider (only when there's a second column)
                if (label2 !== null) {
                    doc.moveTo(innerDivX, currentRightY)
                        .lineTo(innerDivX, currentRightY + height).stroke();
                }

                // Left sub-column content
                doc.fontSize(8).font("Roboto").text(label1, COL_LEFT_DIVIDER + 3, currentRightY + 3, {
                    width: RIGHT_INNER_DIVIDER_OFFSET - 5
                });
                doc.fontSize(8).font("Roboto-Bold").text(value1 || "-", COL_LEFT_DIVIDER + 3, currentRightY + 13, {
                    width: RIGHT_INNER_DIVIDER_OFFSET - 5
                });

                // Right sub-column content
                if (label2 !== null) {
                    doc.fontSize(8).font("Roboto").text(label2 || "", innerDivX + 3, currentRightY + 3, {
                        width: RIGHT_INNER_DIVIDER_OFFSET - 5
                    });
                    doc.fontSize(8).font("Roboto-Bold").text(value2 || "-", innerDivX + 3, currentRightY + 13, {
                        width: RIGHT_INNER_DIVIDER_OFFSET - 5
                    });
                }
                
                currentRightY += height;
            };

            let supplierInvoiceVal = "-";
            if (isPurchase) {
                const sNo = data.shipping_details?.supplier_invoice_no;
                const sDate = data.shipping_details?.supplier_invoice_date;
                 if (sNo && sDate) {
                   supplierInvoiceVal = `No: ${sNo}   |   Date: ${formatDate(sDate)}`;
                 } else if (sNo) {
                    supplierInvoiceVal = sNo;
                 } else if (sDate) {
                    supplierInvoiceVal = formatDate(sDate);
                 }
            } else {
                supplierInvoiceVal = data.shipping_details?.dispatch_doc_no || "-";
            }

            drawLogisticsRow("Invoice No.", data.quotationNo || data.docNumber, "Dated", formatDate(data.date));
            drawLogisticsRow("Delivery Note", data.shipping_details?.delivery_note || "-", "Mode/Terms of Payment", data.paymentTerms || data.shipping_details?.payment_terms || "-");
            drawLogisticsRow("Reference No. & Date.", data.shipping_details?.reference_no || "-", "Other References", data.shipping_details?.other_ref || "-");
            drawLogisticsRow("Purchase Order No.", data.shipping_details?.buyer_order_no || "-", "Dated", formatDate(data.shipping_details?.buyer_order_date));
            drawLogisticsRow(isPurchase ? "Supplier Invoice No. & Date." : "Dispatch Doc No.", supplierInvoiceVal, "Delivery Note Date", formatDate(data.shipping_details?.delivery_note_date));
            drawLogisticsRow("Bill of Lading/LR-RR No.", data.shipping_details?.bill_of_lading || "-", "Motor Vehicle No.", data.shipping_details?.motor_vehicle_no || "-");
            drawLogisticsRow("Dispatched through", data.shipping_details?.dispatched_through || "-", "Destination", data.shipping_details?.destination || "-");



            // Terms of Delivery row: full-width, no inner divider
            // Height is the same as other logistics rows
            doc.fontSize(8).font("Roboto").text("Terms of Delivery", COL_LEFT_DIVIDER + 3, currentRightY + 3);
            doc.fontSize(8).font("Roboto-Bold").text(
                data.shipping_details?.delivery_terms || data.terms || "-",
                COL_LEFT_DIVIDER + 3, currentRightY + 13,
                { width: (CONTENT_WIDTH * 0.5) - 8 }
            );

            // Note: The bottom line for this row is the bottom of the outer header box,
            // but we draw it anyway to be safe.
            doc.moveTo(COL_LEFT_DIVIDER, currentRightY + logisticsRowHeight).lineTo(MARGIN + CONTENT_WIDTH, currentRightY + logisticsRowHeight).stroke();
            currentRightY += logisticsRowHeight;
            const finalRightY = currentRightY;

            // finalLeftY: find the lowest point of the left side (Party Details)
            const finalLeftY = Math.max(buyerGstY + 5, consigneeGstY + 5, currentLeftY + 5);

            // Table starts below both sides
            y = Math.max(finalLeftY, finalRightY);

            // ─────────────────────────────────────────────
            // ITEMS TABLE
            // ─────────────────────────────────────────────

            // Column X positions
            const colSI = MARGIN;
            const colDesc = MARGIN + 35;
            const colHSN = MARGIN + 200;
            const colQty = MARGIN + 260;
            const colRate = MARGIN + 330;
            const colPer = MARGIN + 400;
            const colAmount = MARGIN + 445;

            const tableHeaderHeight = 20;
            const PAGE_BOTTOM_LIMIT = 760;

            const drawTableHeader = (yPos) => {
                doc.rect(MARGIN, yPos, CONTENT_WIDTH, tableHeaderHeight).stroke();
                [colDesc, colHSN, colQty, colRate, colPer, colAmount].forEach(x =>
                    doc.moveTo(x, yPos).lineTo(x, yPos + tableHeaderHeight).stroke()
                );
                doc.fontSize(8).font("Roboto-Bold");
                doc.text("Sl No.", colSI + 2, yPos + 6, { width: colDesc - colSI - 4, align: 'center' });
                doc.text("Description of Goods", colDesc + 4, yPos + 6);
                doc.text("HSN/SAC", colHSN + 2, yPos + 6, { width: colQty - colHSN - 4, align: 'center' });
                doc.text("Quantity", colQty + 2, yPos + 6, { width: colRate - colQty - 4, align: 'center' });
                doc.text("Rate", colRate + 2, yPos + 6, { width: colPer - colRate - 4, align: 'center' });
                doc.text("per", colPer + 2, yPos + 6, { width: colAmount - colPer - 4, align: 'center' });
                doc.text("Amount (₹)", colAmount + 2, yPos + 6, { width: MARGIN + CONTENT_WIDTH - colAmount - 4, align: 'right' });
                return yPos + tableHeaderHeight;
            };

            const drawVerticalLines = (startY, endY) => {
                [MARGIN, colDesc, colHSN, colQty, colRate, colPer, colAmount, MARGIN + CONTENT_WIDTH].forEach(x => {
                    doc.moveTo(x, startY).lineTo(x, endY).stroke();
                });
            };

            let currentTableTop = y;
            let currentItemY = drawTableHeader(currentTableTop);

            data.items.forEach((item, i) => {
                // Calculate item row height
                doc.fontSize(9).font("Roboto-Bold");
                const nameH = doc.heightOfString(item.itemname || "-", { width: colHSN - colDesc - 8 });
                doc.fontSize(8).font("Roboto");
                const descH = item.description ? doc.heightOfString(item.description, { width: colHSN - colDesc - 8 }) : 0;
                const rowHeight = Math.max(nameH + descH + 8, 20);

                // CHECK PAGE BREAK
                if (currentItemY + rowHeight > PAGE_BOTTOM_LIMIT) {
                    // Close the current table
                    drawVerticalLines(currentTableTop, currentItemY);
                    doc.moveTo(MARGIN, currentItemY).lineTo(MARGIN + CONTENT_WIDTH, currentItemY).stroke();

                    doc.addPage();
                    currentItemY = MARGIN; // Reset Y for new page
                    currentTableTop = currentItemY;
                    currentItemY = drawTableHeader(currentTableTop);
                }

                const rowStartY = currentItemY;

                // Draw Row content
                doc.fontSize(9).font("Roboto").text(`${i + 1}`, colSI + 2, rowStartY + 5, { width: colDesc - colSI - 4, align: 'center' });
                doc.font("Roboto-Bold").text(item.itemname || "-", colDesc + 4, rowStartY + 5, { width: colHSN - colDesc - 8 });
                if (item.description) {
                    doc.fontSize(8).font("Roboto");
                    const currentNameH = doc.heightOfString(item.itemname || "-", { width: colHSN - colDesc - 8, font: "Roboto-Bold", fontSize: 9 });
                    doc.text(item.description, colDesc + 4, rowStartY + 5 + currentNameH, { width: colHSN - colDesc - 8 });
                }
                doc.fontSize(9).font("Roboto").text(item.hsnno || "-", colHSN + 2, rowStartY + 5, { width: colQty - colHSN - 4, align: 'center' });
                doc.font("Roboto-Bold").text(`${item.quantity}${item.per ? ' ' + item.per : ''}`, colQty + 2, rowStartY + 5, { width: colRate - colQty - 4, align: 'center' });
                doc.text(Number(item.unitprice || 0).toFixed(2), colRate + 2, rowStartY + 5, { width: colPer - colRate - 12, align: 'right' });
                doc.font("Roboto").text(item.per || '', colPer + 2, rowStartY + 5, { width: colAmount - colPer - 4, align: 'center' });
                doc.font("Roboto-Bold").text(Number(item.total || 0).toFixed(2), colAmount + 2, rowStartY + 5, { width: MARGIN + CONTENT_WIDTH - colAmount - 12, align: 'right' });

                // Draw cell dividers (horizontal)
                doc.moveTo(MARGIN, rowStartY + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, rowStartY + rowHeight).stroke();

                currentItemY += rowHeight;
            });

            // Blank Space Filler (to keep a consistent minimum height on the last page)
            // Dynamically calculate available space to avoid pushing content to next page unnecessarily
            const SPACE_NEEDED_BELOW = 300; 
            const dynamicFixedTableHeight = Math.max(0, PAGE_BOTTOM_LIMIT - currentTableTop - SPACE_NEEDED_BELOW);
            const FIXED_TABLE_HEIGHT = Math.min(240, dynamicFixedTableHeight);
            
            const currentTableHeight = currentItemY - currentTableTop;

            if (currentTableHeight < FIXED_TABLE_HEIGHT) {
                const remaining = FIXED_TABLE_HEIGHT - currentTableHeight;
                // Continue vertical lines through the blank space
                drawVerticalLines(currentItemY, currentItemY + remaining);
                currentItemY += remaining;
            }

            // Draw the final bottom line for the items table
            // doc.moveTo(MARGIN, currentItemY).lineTo(MARGIN + CONTENT_WIDTH, currentItemY).stroke();
            // Ensure vertical lines are drawn for the entire current table block on this page
            drawVerticalLines(currentTableTop, currentItemY);

            // ─────────────────────────────────────────────
            // GST OUTPUT LINES (LIKE TALLY)
            // ─────────────────────────────────────────────

            // GST rate calculation (prefer explicit rates if provided)
            let fullTaxRate = Number(data.gst_percentage || 0);
            let igstRate = Number(data.igst_rate || data.igst_percentage || 0);
            let cgstRate = Number(data.cgst_rate || data.cgst_percentage || 0);
            let sgstRate = Number(data.sgst_rate || data.sgst_percentage || 0);

            if (fullTaxRate === 0 && (igstRate || cgstRate || sgstRate)) {
                fullTaxRate = igstRate || (cgstRate + sgstRate);
            }

            if (fullTaxRate === 0 && Number(data.subtotal) > 0) {
                const totalTaxAmt = Number(data.igst || 0) + Number(data.cgst || 0) + Number(data.sgst || 0);
                if (totalTaxAmt > 0) {
                    fullTaxRate = (totalTaxAmt / Number(data.subtotal)) * 100;
                    fullTaxRate = Math.round(fullTaxRate * 100) / 100;
                }
            }

            // Fallback for split rates
            if (cgstRate === 0 && sgstRate === 0 && !igstRate) {
                cgstRate = fullTaxRate / 2;
                sgstRate = fullTaxRate / 2;
            }
            if (igstRate === 0 && fullTaxRate > 0 && Number(data.igst || 0) > 0) {
                igstRate = fullTaxRate;
            }
            let splitTaxRate = fullTaxRate / 2;

            let cgstAmount = Number(data.cgst || 0);
            let sgstAmount = Number(data.sgst || 0);
            let igstAmount = Number(data.igst || 0);

            // Force recalculation based on rate to ensure consistency
            if (fullTaxRate > 0) {
                const totalTaxAmt = (Number(data.subtotal) * fullTaxRate) / 100;
                if (igstAmount > 0 || (igstAmount === 0 && cgstAmount === 0 && sgstAmount === 0 && Boolean(data.igst))) {
                    // If it was already IGST or we suspect it should be
                    igstAmount = totalTaxAmt;
                    cgstAmount = 0;
                    sgstAmount = 0;
                } else {
                    cgstAmount = totalTaxAmt / 2;
                    sgstAmount = totalTaxAmt / 2;
                    igstAmount = 0;
                }
            }

            const shippingAmount = Number(data.shipping || 0);
            const discountAmount = Number(data.discount || 0);

            // Calculate total adjustments to show
            const adjs = [];
            if (igstAmount > 0) {
                adjs.push({ label: `OUTPUT IGST @ ${fullTaxRate}%`, val: igstAmount });
            } else {
                if (cgstAmount > 0) adjs.push({ label: `OUTPUT CGST @ ${splitTaxRate}%`, val: cgstAmount });
                if (sgstAmount > 0) adjs.push({ label: `OUTPUT SGST @ ${splitTaxRate}%`, val: sgstAmount });
            }
            if (shippingAmount > 0) adjs.push({ label: "SHIPPING CHARGE", val: shippingAmount });
            if (discountAmount > 0) adjs.push({ label: "DISCOUNT", val: discountAmount, neg: true });

            // Calculate total adjustments height
            const lineH = 20;
            const totalAdjHeight = adjs.length * lineH;

            // PAGE BREAK CHECK for adjustments
            if (currentItemY + totalAdjHeight + 20 > PAGE_BOTTOM_LIMIT) {
                // Close current table
                drawVerticalLines(currentTableTop, currentItemY);
                doc.moveTo(MARGIN, currentItemY).lineTo(MARGIN + CONTENT_WIDTH, currentItemY).stroke();

                doc.addPage();
                currentTableTop = MARGIN;
                currentItemY = drawTableHeader(currentTableTop);
            }

            // Decide Y position: 
            // 1. At least 10px below items
            // 2. But ideally at the bottom of the 240px block
            const tableBottomY = currentTableTop + FIXED_TABLE_HEIGHT;
            let gstTextY = tableBottomY - totalAdjHeight - 5;

            if (gstTextY < currentItemY + 10) {
                gstTextY = currentItemY + 10;
            }

            doc.fontSize(9).font("Roboto-Bold");

            adjs.forEach(adj => {
                doc.text(adj.label, colDesc + 20, gstTextY);
                const displayVal = adj.neg ? `- ${formatCurrency(adj.val)}` : formatCurrency(adj.val);
                doc.text(displayVal, colAmount + 2, gstTextY, {
                    width: MARGIN + CONTENT_WIDTH - colAmount - 15,
                    align: "right"
                });
                gstTextY += lineH;
            });

            // Update currentItemY to reflect the new bottom
            if (gstTextY > currentItemY) {
                currentItemY = gstTextY + 5;
            }

            // Final closing lines
            drawVerticalLines(currentTableTop, currentItemY);
            doc.moveTo(MARGIN, currentItemY).lineTo(MARGIN + CONTENT_WIDTH, currentItemY).stroke();

            // ─────────────────────────────────────────────
            // TOTAL ROW
            // ─────────────────────────────────────────────
            const totalRowHeight = 30;
            if (currentItemY + totalRowHeight > PAGE_BOTTOM_LIMIT) {
                doc.addPage();
                currentItemY = MARGIN;
            }

            doc.rect(MARGIN, currentItemY, CONTENT_WIDTH, totalRowHeight).stroke();
            [colDesc, colHSN, colQty, colRate, colPer, colAmount].forEach(x =>
                doc.moveTo(x, currentItemY).lineTo(x, currentItemY + totalRowHeight).stroke()
            );
            drawVerticalLines(currentItemY, currentItemY + totalRowHeight);

            doc.fontSize(9).font("Roboto-Bold").text("Total", colDesc + 4, currentItemY + 10);
            const totalQty = data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            doc.text(`${totalQty} Nos`, colQty + 2, currentItemY + 10, { width: colRate - colQty - 4, align: 'center' });
            doc.text(formatCurrency(data.total), colAmount + 2, currentItemY + 10, { width: MARGIN + CONTENT_WIDTH - colAmount - 15, align: 'right' });

            y = currentItemY + totalRowHeight;

            // ─────────────────────────────────────────────
            // AMOUNT IN WORDS
            // ─────────────────────────────────────────────
            const amountInWordsText = numberToWords(data.total);
            doc.fontSize(9).font("Roboto-Bold");
            const wordsHeight = doc.heightOfString(amountInWordsText, { width: CONTENT_WIDTH - 10 });
            const amountInWordsH = Math.max(35, 25 + wordsHeight);

            if (y + amountInWordsH > PAGE_BOTTOM_LIMIT) {
                doc.addPage();
                y = MARGIN;
            }
            doc.rect(MARGIN, y, CONTENT_WIDTH, amountInWordsH).stroke();
            doc.fontSize(8).font("Roboto-Bold").text("Amount Chargeable (in words)", MARGIN + 5, y + 3);
            doc.fontSize(9).font("Roboto-Bold").text(amountInWordsText, MARGIN + 5, y + 14, { width: CONTENT_WIDTH - 10 });
            y += amountInWordsH;

            // ─────────────────────────────────────────────
            // GST TAX TABLE
            // ─────────────────────────────────────────────
            const hsnGroups = {};
            data.items.forEach(item => {
                const hsn = item.hsnno || item.hsn || "N/A";
                if (!hsnGroups[hsn]) hsnGroups[hsn] = { taxable: 0 };
                hsnGroups[hsn].taxable += Number(item.total || 0);
            });
            const hsnEntries = Object.entries(hsnGroups);
            const gstHeaderH = 30;
            const gstDataRowH = 18;
            const gstTotalRowH = 18;
            const gstTableTotalH = gstHeaderH + (hsnEntries.length * gstDataRowH) + gstTotalRowH;

            // Page break check for GST Table
            if (y + gstTableTotalH > doc.page.height - 100) {
                doc.addPage();
                y = MARGIN;
            }

            const gstTableTop = y;
            const gstCols = [80, 80, 55, 65, 55, 65, CONTENT_WIDTH - 80 - 80 - 55 - 65 - 55 - 65];
            const gstX = [MARGIN];
            gstCols.forEach((w, i) => gstX.push(gstX[i] + w));

            const isIGST = Number(data.igst || 0) > 0 || Number(data.igst_rate || 0) > 0;

            doc.rect(MARGIN, gstTableTop, CONTENT_WIDTH, gstTableTotalH).stroke();

            // Vertical lines
            const verticalLines = isIGST
                ? [gstX[1], gstX[2], gstX[6]]
                : [gstX[1], gstX[2], gstX[4], gstX[6]];

            verticalLines.forEach(x => {
                doc.moveTo(x, gstTableTop).lineTo(x, gstTableTop + gstTableTotalH).stroke();
            });

            // Inner split for rates/amounts below headers
            if (isIGST) {
                doc.moveTo(gstX[2] + 120, gstTableTop + 14).lineTo(gstX[2] + 120, gstTableTop + gstTableTotalH).stroke();
            } else {
                [gstX[3], gstX[5]].forEach(x => {
                    doc.moveTo(x, gstTableTop + 14).lineTo(x, gstTableTop + gstTableTotalH).stroke();
                });
            }

            doc.moveTo(MARGIN, gstTableTop + gstHeaderH).lineTo(MARGIN + CONTENT_WIDTH, gstTableTop + gstHeaderH).stroke();
            doc.moveTo(gstX[2], gstTableTop + 13).lineTo(gstX[6], gstTableTop + 13).stroke();


            doc.fontSize(7).font("Roboto-Bold");
            doc.text("HSN/SAC", gstX[0] + 2, gstTableTop + 10, { width: gstCols[0] - 4, align: 'center' });
            doc.text("Taxable\nValue (₹)", gstX[1] + 2, gstTableTop + 5, { width: gstCols[1] - 4, align: 'center' });

            if (isIGST) {
                doc.text(`Integrated Tax @ ${igstRate || fullTaxRate}%`, gstX[2] + 2, gstTableTop + 3, { width: CONTENT_WIDTH - gstCols[0] - gstCols[1] - (CONTENT_WIDTH - gstX[6]) - 4, align: 'center' });
                doc.text("Rate", gstX[2] + 2, gstTableTop + 16, { width: 120, align: 'center' });
                doc.text("Amount (₹)", gstX[2] + 120, gstTableTop + 16, { width: 120, align: 'center' });
            } else {
                doc.text(`Central Tax @ ${cgstRate}%`, gstX[2] + 2, gstTableTop + 3, { width: gstCols[2] + gstCols[3] - 4, align: 'center' });
                doc.text("Rate", gstX[2] + 2, gstTableTop + 16, { width: gstCols[2] - 4, align: 'center' });
                doc.text("Amount (₹)", gstX[3] + 2, gstTableTop + 16, { width: gstCols[3] - 4, align: 'center' });
                doc.text(`State Tax @ ${sgstRate}%`, gstX[4] + 2, gstTableTop + 3, { width: gstCols[4] + gstCols[5] - 4, align: 'center' });
                doc.text("Rate", gstX[4] + 2, gstTableTop + 16, { width: gstCols[4] - 4, align: 'center' });
                doc.text("Amount (₹)", gstX[5] + 2, gstTableTop + 16, { width: gstCols[5] - 4, align: 'center' });
            }
            doc.text("Total Tax\nAmount (₹)", gstX[6] + 2, gstTableTop + 5, { width: gstCols[6] - 4, align: 'center' });

            let gstRowY = gstTableTop + gstHeaderH;
            let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalTaxSum = 0;

            hsnEntries.forEach(([hsn, group]) => {
                let rowTax = 0;
                let cgstAmt = 0;
                let sgstAmt = 0;
                let igstAmt = 0;

                if (isIGST) {
                    igstAmt = group.taxable * ((igstRate || fullTaxRate) / 100);
                    rowTax = igstAmt;
                    totalTaxSum += igstAmt;
                } else {
                    cgstAmt = group.taxable * (cgstRate / 100);
                    sgstAmt = group.taxable * (sgstRate / 100);
                    rowTax = cgstAmt + sgstAmt;
                    totalCGST += cgstAmt;
                    totalSGST += sgstAmt;
                    totalTaxSum += rowTax;
                }
                totalTaxable += group.taxable;

                doc.fontSize(8).font("Roboto");
                doc.text(hsn, gstX[0] + 2, gstRowY + 4, { width: gstCols[0] - 4, align: 'center' });
                doc.text(group.taxable.toFixed(2), gstX[1] + 2, gstRowY + 4, { width: gstCols[1] - 12, align: 'right' });

                if (isIGST) {
                    doc.text(`${igstRate || fullTaxRate}%`, gstX[2] + 2, gstRowY + 4, { width: 120, align: 'center' });
                    doc.text(igstAmt.toFixed(2), gstX[2] + 120, gstRowY + 4, { width: 110, align: 'right' });
                } else {
                    doc.text(`${cgstRate}%`, gstX[2] + 2, gstRowY + 4, { width: gstCols[2] - 4, align: 'center' });
                    doc.text(cgstAmt.toFixed(2), gstX[3] + 2, gstRowY + 4, { width: gstCols[3] - 12, align: 'right' });
                    doc.text(`${sgstRate}%`, gstX[4] + 2, gstRowY + 4, { width: gstCols[4] - 4, align: 'center' });
                    doc.text(sgstAmt.toFixed(2), gstX[5] + 2, gstRowY + 4, { width: gstCols[5] - 12, align: 'right' });
                }
                doc.text(rowTax.toFixed(2), gstX[6] + 2, gstRowY + 4, { width: gstCols[6] - 12, align: 'right' });

                gstRowY += gstDataRowH;
                doc.moveTo(MARGIN, gstRowY).lineTo(MARGIN + CONTENT_WIDTH, gstRowY).stroke();
            });

            doc.fontSize(8).font("Roboto-Bold");
            doc.text("Total", gstX[0] + 2, gstRowY + 4, { width: gstCols[0] - 4, align: 'center' });
            doc.text(totalTaxable.toFixed(2), gstX[1] + 2, gstRowY + 4, { width: gstCols[1] - 12, align: 'right' });
            if (isIGST) {
                doc.text(totalTaxSum.toFixed(2), gstX[2] + 120, gstRowY + 4, { width: 110, align: 'right' });
            } else {
                doc.text(totalCGST.toFixed(2), gstX[3] + 2, gstRowY + 4, { width: gstCols[3] - 12, align: 'right' });
                doc.text(totalSGST.toFixed(2), gstX[5] + 2, gstRowY + 4, { width: gstCols[5] - 12, align: 'right' });
            }
            doc.text(totalTaxSum.toFixed(2), gstX[6] + 2, gstRowY + 4, { width: gstCols[6] - 12, align: 'right' });

            y = gstTableTop + gstTableTotalH;

            // ─────────────────────────────────────────────
            // TAX AMOUNT IN WORDS
            // ─────────────────────────────────────────────
            y += 5;
            if (y + 15 > doc.page.height - 40) { doc.addPage(); y = MARGIN; }
            doc.fontSize(8).font("Roboto-Bold").text("Tax Amount (in words) : ", MARGIN + 5, y, { continued: true });
            doc.font("Roboto").text(numberToWords(totalTaxSum));
            y += 15;
            // ─────────────────────────────────────────────
            // FOOTER (Declaration + Signatory)
            // ─────────────────────────────────────────────

            // STEP 1: Prepare text
            const declarationText =
                data.declaration ||
                "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";

            // STEP 2: Measure height
            doc.fontSize(8).font("Roboto");

            const declarationHeight = doc.heightOfString(declarationText, {
                width: CONTENT_WIDTH * 0.55
            });

            // STEP 3: Calculate real footer height
            const footerBoxHeight = Math.max(80, declarationHeight + 30);

            // STEP 4: 🔥 CORRECT PAGE BREAK CHECK (USE REAL HEIGHT)
            if (y + footerBoxHeight > doc.page.height - 40) {
                doc.addPage();
                y = 40;
            }

            // STEP 5: Draw box
            doc.rect(MARGIN, y, CONTENT_WIDTH, footerBoxHeight).stroke();

            doc.moveTo(MARGIN + (CONTENT_WIDTH * 0.6), y)
                .lineTo(MARGIN + (CONTENT_WIDTH * 0.6), y + footerBoxHeight)
                .stroke();

            // LEFT
            doc.fontSize(9).font("Roboto-Bold")
                .text("Declaration:", MARGIN + 5, y + 5);

            doc.fontSize(8).font("Roboto")
                .text(declarationText, MARGIN + 5, y + 15, {
                    width: CONTENT_WIDTH * 0.57
                });

            // RIGHT
            const sigX = MARGIN + (CONTENT_WIDTH * 0.6) + 5;
            const sigWidth = CONTENT_WIDTH * 0.38;

            doc.fontSize(8).font("Roboto").text(
                "For Cloudsat Private Limited",
                sigX,
                y + footerBoxHeight - 70, // 👈 bottom position
                {
                    width: sigWidth,
                    align: "right" // 👈 force right side
                }
            );



            // 🔥 FINAL FIX (IMPORTANT)
            doc.font("Roboto-Bold").text(
                "Authorised Signatory",
                sigX,
                y + footerBoxHeight - 20, // keep inside
                {
                    width: sigWidth,
                    align: "right"
                }
            );

            // move cursor
            y += footerBoxHeight + 10;

            doc.end();
            stream.on("finish", () => resolve(filePath));
            stream.on("error", reject);

        } catch (err) {
            reject(err);
        }
    });
};




