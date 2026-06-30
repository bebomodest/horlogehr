const fs = require('fs');

const files = ['src/App.tsx', 'src/FingerprintAnalysis.tsx', 'src/index.css'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/#704822/g, '#a38245');
  fs.writeFileSync(file, content);
});
console.log('Replaced colors successfully.');
