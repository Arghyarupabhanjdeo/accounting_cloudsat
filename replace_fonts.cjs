const fs = require('fs');

const updateFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Register fonts
  content = content.replace(
    'doc.pipe(stream);',
    'doc.pipe(stream);\n\n            doc.registerFont(\'Roboto\', path.join(\'assets\', \'fonts\', \'Roboto-Regular.ttf\'));\n            doc.registerFont(\'Roboto-Bold\', path.join(\'assets\', \'fonts\', \'Roboto-Bold.ttf\'));'
  );

  // Replace fonts
  content = content.replace(/"Helvetica"/g, '"Roboto"');
  content = content.replace(/"Helvetica-Bold"/g, '"Roboto-Bold"');
  
  // Replace Rs. with ₹
  content = content.replace(/"Rs\. "/g, '"₹ "');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
};

updateFile('utils/format.js');
updateFile('utils/notePdf.js');
