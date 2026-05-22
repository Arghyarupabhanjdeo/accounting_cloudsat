import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import pool from "../db.js";


/**
 * Converts a number into its word representation (Indian numbering system).
 */
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

    let res = (amount === 0 ? "" : inWords(amount));
    if (paisa > 0) {
        res = (amount === 0 ? "Zero " : inWords(amount)) + "and " + inWords(paisa) + " Paisa";
    }
    return res + " Only";
};

/**
 * Generates a professional boxy-format PDF for a Payment Voucher.
 */
export const generatePaymentPDF = async (data, filePath) => {
   return new Promise(async (resolve, reject) => {
        try {
            const fullPath = path.join(process.cwd(), filePath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const doc = new PDFDocument({ size: "A4", margin: 40 });
            const stream = fs.createWriteStream(fullPath);
            doc.pipe(stream);

            const { voucherNo, date, total, items, narration, customer , accountType} = data;
          let accountName = customer || accountType || "N/A";

try {

  // BANK ACCOUNT
  if (String(accountName).startsWith("bank_")) {

    const bankId = accountName.replace("bank_", "");

    const [banks] = await pool.query(
      "SELECT * FROM bank_accounts WHERE id = ?",
      [bankId]
    );

    if (banks.length > 0) {
      accountName = banks[0].bankName
        ? `${banks[0].accountName} (${banks[0].bankName})`
        : banks[0].accountName;
    }
  }

  // CASH LEDGER
  else if (String(accountName).startsWith("ledger_")) {

    const ledgerId = accountName.replace("ledger_", "");

    const [ledgers] = await pool.query(
      "SELECT * FROM ledgers WHERE id = ?",
      [ledgerId]
    );

    if (ledgers.length > 0) {
      accountName = ledgers[0].name || ledgers[0].ledgerName;
    }
  }

  // NORMAL CASH
  else if (accountName === "cash") {
    accountName = "Cash";
  }

} catch (err) {
  console.error("PDF Account Fetch Error:", err);
}
            const companyName = "Cloudsat Private Limited";

            

            /* ================= HEADER ================= */
            doc.fontSize(16).font("Helvetica-Bold").text(companyName, { align: "center" });
            doc.moveDown(0.5);
            
            doc.fontSize(14).font("Helvetica-Bold").text("PAYMENT VOUCHER", { align: "center", underline: true });
            doc.moveDown(1.5);

            /* ================= TOP INFO ================= */
            const topInfoY = doc.y;
            doc.fontSize(10).font("Helvetica");
            doc.text(`No.: ${voucherNo || "N/A"}`, 40, topInfoY);
            doc.text(`Dated: ${new Date(date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}`, 400, topInfoY, { align: "right", width: 155 });
            doc.moveDown(1.5);

            /* ================= ACCOUNT INFO ================= */
            doc.fontSize(10).font("Helvetica-Bold").text("Account:", 40, doc.y);
          doc.font("Helvetica").text(accountName || "N/A", 90, doc.y - 12);
            doc.moveDown(1);

            /* ================= TABLE HEADER ================= */
            const tableY = doc.y;
            doc.moveTo(40, tableY).lineTo(555, tableY).stroke();
            doc.fontSize(9).font("Helvetica-Bold");
            doc.text("S.No", 45, tableY + 5);
            doc.text("Particulars", 85, tableY + 5);
            doc.text("Amount", 450, tableY + 5, { align: "right", width: 100 });
            doc.moveTo(40, tableY + 20).lineTo(555, tableY + 20).stroke();

            /* ================= CONTENT BOX ================= */
            const contentStartY = tableY + 20;
            const contentHeight = 300;
            doc.rect(40, contentStartY, 515, contentHeight).stroke();
            
            // Vertical Dividers
            doc.moveTo(80, contentStartY).lineTo(80, contentStartY + contentHeight).stroke();
            doc.moveTo(445, contentStartY).lineTo(445, contentStartY + contentHeight).stroke();

            let currentY = contentStartY + 15;
            
            doc.fontSize(9).font("Helvetica");
            if (items && items.length > 0) {
                items.forEach((item, index) => {
                    const amountStr = `Rs. ${parseFloat(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
                    
                    doc.text(`${index + 1}`, 45, currentY, { width: 30, align: 'center' });
                    doc.text(item.description || "N/A", 85, currentY, { width: 350 });
                    doc.text(amountStr, 450, currentY, { align: "right", width: 95 });
                    
                    currentY = doc.y + 10;
                });
            }

            /* ================= TOTAL DISPLAY ================= */
            const totalBoxY = contentStartY + contentHeight - 40;
            doc.fontSize(11).font("Helvetica-Bold").text(`Total: Rs. ${parseFloat(total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 410, totalBoxY + 10, { align: "right", width: 135 });

            /* ================= FOOTER SECTION ================= */
            let footerY = contentStartY + contentHeight + 20;
            
            // Global Narration
            doc.fontSize(10).font("Helvetica-Bold").text("Narration:", 40, footerY);
            doc.fontSize(10).font("Helvetica").text(narration || "N/A", 110, footerY, { width: 420 });
            footerY = doc.y + 20;

            // Amount in words
            doc.fontSize(10).font("Helvetica-Bold").text("Amount (in words):", 40, footerY);
            doc.fontSize(10).font("Helvetica").text(`INR ${numberToWords(total)}`, 135, footerY, { width: 380 });
            
            // Authorised Signatory
            doc.fontSize(10).font("Helvetica").text("Authorised Signatory", 400, 600, { align: "center", width: 155 });

            doc.end();

            stream.on("finish", () => {
                resolve(filePath);
            });

            stream.on("error", (err) => {
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
};
