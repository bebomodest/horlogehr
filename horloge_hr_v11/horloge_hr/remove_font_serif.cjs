const fs = require('fs');

const files = ['src/App.tsx', 'src/FingerprintAnalysis.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/ font-serif/g, '');
  fs.writeFileSync(file, content);
});
console.log('Removed font-serif successfully.');
