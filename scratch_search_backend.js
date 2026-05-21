import fs from 'fs';
import path from 'path';

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchDir(fullPath, query);
      }
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.jsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(query)) {
            console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log('Searching for "userId"...');
searchDir('d:\\Cloudsat_Superadmin\\builder_accounting_backend\\controllers', 'userId');
