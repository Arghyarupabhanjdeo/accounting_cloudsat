import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import pool from "../db.js";

/**
 * Generates a professional PDF document for Manufacturing Journal
 * @param {Object} data - structured data for the PDF
 * @param {string} fileName - output filename
 * @param {string} subDir - subdirectory in uploads
 * @returns {Promise<string>} - Path to the generated PDF
 */
export const generateManufacturingPDF = async (data, fileName, subDir) => {
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
            const LEFT_COL_WIDTH = CONTENT_WIDTH * 0.48;
            const RIGHT_COL_WIDTH = CONTENT_WIDTH - LEFT_COL_WIDTH;

            const formatCurrency = (amount) => {
                return "Rs. " + Number(amount || 0).toFixed(2);
            };

            const formatDate = (dateStr) => {
                if (!dateStr) return "-";
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            };

            // ─────────────────────────────────────────────
            // HEADER BAR (Tally Style)
            // ─────────────────────────────────────────────
            let y = MARGIN - 10;
            const HEADER_BAR_HEIGHT = 18;
            
            // Draw dark blue bar
            doc.rect(MARGIN, y, CONTENT_WIDTH, HEADER_BAR_HEIGHT).fill("#2d5a88");
            
            doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
            doc.text("Cloudsat Private Limited", MARGIN, y + 5, { width: CONTENT_WIDTH, align: 'center' });
            
            y += HEADER_BAR_HEIGHT + 10;
            doc.fillColor("#000000"); // Reset color

            // Stock Journal No & Date Row
            doc.fontSize(10).font("Helvetica-Bold").text("Voucher No :", MARGIN, y, { continued: true });
            doc.font("Helvetica").text(data.voucherNo);

            const dateStr = formatDate(data.date);
            const dayStr = new Date(data.date).toLocaleDateString('en-IN', { weekday: 'long' });
            doc.fontSize(10).font("Helvetica-Bold").text(dateStr, MARGIN + CONTENT_WIDTH - 120, y, { width: 120, align: 'right' });
            doc.fontSize(9).font("Helvetica").text(dayStr, MARGIN + CONTENT_WIDTH - 120, y + 12, { width: 120, align: 'right' });

            y += 35;

            // Centered Title
            doc.fontSize(11).font("Helvetica-Bold").text("Manufacture of Materials", MARGIN, y, { align: 'center', width: CONTENT_WIDTH, underline: true });
            y = doc.y + 15; // Increased spacing to prevent overlap

            // Product Details
            doc.rect(MARGIN, y, CONTENT_WIDTH, 42).stroke();
            doc.fontSize(8).font("Helvetica-Bold").text("Name of product:", MARGIN + 5, y + 5);
            doc.font("Helvetica").text(data.productName, MARGIN + 80, y + 5, { width: 150 });
            
            doc.font("Helvetica-Bold").text("Name of BOM:", MARGIN + 240, y + 5);
            doc.font("Helvetica").text(data.bomName || "Not Applicable", MARGIN + 310, y + 5);

            doc.font("Helvetica-Bold").text("Qty:", MARGIN + CONTENT_WIDTH - 100, y + 5);
            doc.font("Helvetica").text(data.finishedQty.toString(), MARGIN + CONTENT_WIDTH - 70, y + 5);

            // Row 2: Batch & Allocation
            doc.font("Helvetica-Bold").text("% Cost allocation:", MARGIN + 5, y + 22);
            doc.font("Helvetica").text(`${data.costAllocation || 100}%`, MARGIN + 75, y + 22);

            doc.font("Helvetica-Bold").text("Batch:", MARGIN + 120, y + 22);
            doc.font("Helvetica").text(data.batchName || "-", MARGIN + 150, y + 22);
            
            doc.font("Helvetica-Bold").text("MFG:", MARGIN + 260, y + 22);
            doc.font("Helvetica").text(formatDate(data.mfgDate), MARGIN + 285, y + 22);
            
            doc.font("Helvetica-Bold").text("EXP:", MARGIN + 380, y + 22);
            doc.font("Helvetica").text(formatDate(data.expDate), MARGIN + 405, y + 22);

            y += 47;

            // ─────────────────────────────────────────────
            // SIDE-BY-SIDE TABLES
            // ─────────────────────────────────────────────
            const tableTop = y;
            const tableBottom = 700; // Fixed bottom for the table area
            
            doc.rect(MARGIN, tableTop, CONTENT_WIDTH, tableBottom - tableTop).stroke();
            doc.moveTo(MARGIN + LEFT_COL_WIDTH, tableTop).lineTo(MARGIN + LEFT_COL_WIDTH, tableBottom).stroke();

            // Headers
            doc.fontSize(9).font("Helvetica-Bold");
            doc.text("Components (Consumption)", MARGIN, tableTop + 5, { width: LEFT_COL_WIDTH, align: 'center' });
            doc.text("Co-Product/By-Product/Scrap", MARGIN + LEFT_COL_WIDTH, tableTop + 5, { width: RIGHT_COL_WIDTH, align: 'center' });
            
            y = tableTop + 20;
            doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).stroke();
            
            // Sub-headers
            doc.fontSize(7);
            doc.text("Name of Item", MARGIN + 5, y + 3);
            doc.text("Quantity", MARGIN + LEFT_COL_WIDTH - 140, y + 3, { width: 40, align: 'right' });
            doc.text("Rate", MARGIN + LEFT_COL_WIDTH - 95, y + 3, { width: 40, align: 'right' });
            doc.text("Amount", MARGIN + LEFT_COL_WIDTH - 50, y + 3, { width: 40, align: 'right' });

            doc.text("Name of Item", MARGIN + LEFT_COL_WIDTH + 5, y + 3);
            doc.text("% Allocation", MARGIN + CONTENT_WIDTH - 150, y + 3, { width: 45, align: 'right' });
            doc.text("Quantity", MARGIN + CONTENT_WIDTH - 100, y + 3, { width: 30, align: 'right' });
            doc.text("Rate", MARGIN + CONTENT_WIDTH - 65, y + 3, { width: 30, align: 'right' });
            doc.text("Amount", MARGIN + CONTENT_WIDTH - 35, y + 3, { width: 30, align: 'right' });

            y += 15;
            doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).stroke();
            
            // Render Components
            let compY = y + 5;
            doc.font("Helvetica").fontSize(8);
            const ROW_HEIGHT = 20; // Increased for 2 lines
            
            data.components.forEach(c => {
                const startY = compY;
                doc.text(c.itemName, MARGIN + 5, startY, { width: LEFT_COL_WIDTH - 150, lineBreak: true });
                doc.text(c.qty.toString(), MARGIN + LEFT_COL_WIDTH - 140, startY, { width: 40, align: 'right' });
                doc.text(Number(c.rate).toFixed(2), MARGIN + LEFT_COL_WIDTH - 95, startY, { width: 40, align: 'right' });
                doc.text(Number(c.amount).toFixed(2), MARGIN + LEFT_COL_WIDTH - 50, startY, { width: 40, align: 'right' });
                compY += ROW_HEIGHT;
            });

            // Render By-Products
            let byY = y + 5;
            data.byProducts.forEach(b => {
                const startY = byY;
                doc.text(b.itemName, MARGIN + LEFT_COL_WIDTH + 5, startY, { width: RIGHT_COL_WIDTH - 165, lineBreak: true });
                doc.text(`${b.pctOfCost || 0}%`, MARGIN + CONTENT_WIDTH - 150, startY, { width: 45, align: 'right' });
                doc.text(b.qty.toString(), MARGIN + CONTENT_WIDTH - 100, startY, { width: 30, align: 'right' });
                doc.text(Number(b.rate).toFixed(2), MARGIN + CONTENT_WIDTH - 65, startY, { width: 30, align: 'right' });
                doc.text(Number(b.amount).toFixed(2), MARGIN + CONTENT_WIDTH - 35, startY, { width: 30, align: 'right' });
                byY += ROW_HEIGHT;
            });

            // Summary section on the right side
            let summaryY = Math.max(compY, byY) + 15;
            if (summaryY < tableBottom - 140) summaryY = tableBottom - 140;
            
            doc.fontSize(8).font("Helvetica-Bold");
            
            // 1. Cost of components header
            doc.text("Cost of components:", MARGIN + LEFT_COL_WIDTH + 5, summaryY);
            summaryY += 12;

            // Render Additional Costs
            let costsArray = [];
            try {
                costsArray = Array.isArray(data.additionalCosts) 
                    ? data.additionalCosts 
                    : (typeof data.additionalCosts === 'string' ? JSON.parse(data.additionalCosts) : []);
            } catch (e) {
                console.error("Error parsing additionalCosts:", e);
                if (data.addlCost > 0) {
                    costsArray = [{ type: data.addlCostType || "Addl. Cost", percentage: data.addlCostPct || 0, amount: data.addlCost }];
                }
            }

            if (costsArray.length > 0) {
                costsArray.forEach(cost => {
                    doc.fontSize(7).font("Helvetica-Oblique");
                    doc.text(cost.type || "Addl. Cost", MARGIN + LEFT_COL_WIDTH + 15, summaryY);
                    doc.text(cost.percentage ? `${cost.percentage}%` : "-", MARGIN + LEFT_COL_WIDTH + 140, summaryY, { align: 'right', width: 50 });
                    summaryY += 12;

                    doc.fontSize(7).font("Helvetica");
                    doc.text("Amount:", MARGIN + LEFT_COL_WIDTH + 15, summaryY);
                    doc.text(formatCurrency(cost.amount), MARGIN + CONTENT_WIDTH - 100, summaryY, { align: 'right', width: 95 });
                    summaryY += 12;
                });
            } else if (data.addlCost > 0) {
                 // Fallback for old data
                 doc.fontSize(7).font("Helvetica-Oblique");
                 doc.text(data.addlCostType || "Addl. Cost", MARGIN + LEFT_COL_WIDTH + 15, summaryY);
                 doc.text(data.addlCostPct ? `${data.addlCostPct}%` : "-", MARGIN + LEFT_COL_WIDTH + 140, summaryY, { align: 'right', width: 50 });
                 summaryY += 12;

                 doc.fontSize(7).font("Helvetica");
                 doc.text("Amount:", MARGIN + LEFT_COL_WIDTH + 15, summaryY);
                 doc.text(formatCurrency(data.addlCost), MARGIN + CONTENT_WIDTH - 100, summaryY, { align: 'right', width: 95 });
                 summaryY += 12;
            }

            // Move final totals to the very bottom of the table area
            summaryY = tableBottom - 65;
            
            const drawSummaryRow = (label, value) => {
                const COLON_X = MARGIN + LEFT_COL_WIDTH + 140; // Fixed X for colon
                doc.fontSize(7).font("Helvetica").text(label, MARGIN + LEFT_COL_WIDTH + 5, summaryY);
                doc.text(":", COLON_X, summaryY);
                doc.fontSize(7).font("Helvetica-Bold").text(value, MARGIN + CONTENT_WIDTH - 120, summaryY, { align: 'right', width: 115 });
                summaryY += 12;
            };

            const totalCompAmount = data.components.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            drawSummaryRow("Total Addl. Cost", formatCurrency(data.addlCost));
            drawSummaryRow("Effective Cost", formatCurrency(data.grandTotal));
            drawSummaryRow("Allocation to Primary Item", `${data.costAllocation || 100}%`);
            drawSummaryRow("Effective rate of Primary Item", formatCurrency(data.effectiveRatePerFinished));

            // Narration at the bottom
            y = tableBottom + 10;
            doc.fontSize(8).font("Helvetica-Bold").text("Narration:", MARGIN, y);
            doc.font("Helvetica").text(data.narration || "N/A", MARGIN + 50, y, { width: CONTENT_WIDTH - 60 });

            // Footer / Signatory
            const footerY = doc.page.height - 70;
            doc.fontSize(9).font("Helvetica-Bold").text("Authorised Signatory", MARGIN + CONTENT_WIDTH - 150, footerY, { align: 'right' });
            doc.moveTo(MARGIN + CONTENT_WIDTH - 150, footerY - 5).lineTo(MARGIN + CONTENT_WIDTH, footerY - 5).stroke();

            doc.end();
            stream.on("finish", () => resolve(filePath));
            stream.on("error", reject);
        } catch (err) { reject(err); }
    });
};
