import fs from 'fs';
import path from 'path';

const files = [
  'receiveVoucherController.js',
  'paymentVoucherController.js',
  'journalVoucherController.js',
  'contraVoucherController.js',
  'noteController.js'
];

for (const file of files) {
  const filePath = path.join('d:\\Cloudsat_Superadmin\\builder_accounting_backend\\controllers', file);
  if (fs.existsSync(filePath)) {
    console.log(`\n=================== ${file} ===================`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('INSERT INTO') || line.includes('insertInto') || line.includes('insert ')) {
        // print 5 lines before and after
        const start = Math.max(0, idx - 2);
        const end = Math.min(lines.length - 1, idx + 8);
        console.log(`Lines ${start+1}-${end+1}:`);
        for (let i = start; i <= end; i++) {
          console.log(`  ${i+1}: ${lines[i]}`);
        }
      }
    });
  } else {
    console.log(`File not found: ${file}`);
  }
}
