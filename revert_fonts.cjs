const fs = require('fs');

const updateFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Revert back to Roboto from Helvetica
  content = content.replace(/"Helvetica"/g, '"Roboto"');
  content = content.replace(/"Helvetica-Bold"/g, '"Roboto-Bold"');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
};

updateFile('utils/format.js');
updateFile('utils/notePdf.js');
