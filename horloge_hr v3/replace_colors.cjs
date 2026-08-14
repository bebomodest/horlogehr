const fs = require('fs');

const files = ['src/App.tsx', 'src/FingerprintAnalysis.tsx', 'src/index.css'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/#8b5a2b/g, '#c5a059');
  content = content.replace(/#6b4423/g, '#a38245');
  content = content.replace(/#6b4420/g, '#a38245');
  fs.writeFileSync(file, content);
});
console.log('Replaced colors successfully.');
