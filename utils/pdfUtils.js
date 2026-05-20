import PDFDocument from "pdfkit-table";
import fs from "fs";
import path from "path";

/**
 * Generates a PDF for a voucher/invoice and saves it to the specified path.
 * @param {Object} data - The data to include in the PDF.
 * @param {string} type - The type of document (Sales, Purchase, Payment, Receipt, Invoice).
 * @param {string} filePath - The relative path where the PDF should be saved.
 */
export const generatePDF = async (data, type, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const fullPath = path.join(process.cwd(), filePath);
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text(`${type.toUpperCase()} VOUCHER`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Voucher No: ${data.voucherNo || data.invoiceNo || 'N/A'}`);
      doc.text(`Date: ${new Date(data.date).toLocaleDateString()}`);
      doc.text(`Customer/Supplier: ${data.customer || 'N/A'}`);
      doc.moveDown();

      // Table
      if (data.items && data.items.length > 0) {
        const table = {
          title: "Items",
          headers: ["Description", "Quantity", "Rate", "Amount"],
          rows: data.items.map(item => [
            item.description || item.item || item.item_name || 'N/A',
            item.quantity || item.qty || 0,
            (item.rate || 0).toLocaleString('en-IN'),
            (item.amount || 0).toLocaleString('en-IN')
          ])
        };

        doc.table(table, {
          prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
          prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
            doc.font("Helvetica").fontSize(10);
          },
        });
      }

      doc.moveDown();
      doc.fontSize(12).text(`Subtotal: ${data.subtotal || 0}`, { align: 'right' });
      if (data.gst_amount) doc.text(`GST (${data.gst_percentage}%): ${data.gst_amount}`, { align: 'right' });
      doc.fontSize(14).font("Helvetica-Bold").text(`Grand Total: ${data.grand_total || data.total || 0}`, { align: 'right' });

      doc.moveDown();
      doc.font("Helvetica").fontSize(10).text(`Narration: ${data.narration || 'No narration'}`, { align: 'left' });

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
};
