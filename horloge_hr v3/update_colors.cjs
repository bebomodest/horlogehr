const fs = require('fs');

const files = ['src/App.tsx', 'src/FingerprintAnalysis.tsx', 'src/index.css'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Accent colors
    content = content.replace(/#c5a059/g, '#76151e');
    content = content.replace(/#a38245/g, '#5a0f16');
    content = content.replace(/#c18c5d/g, '#8a1923');
    
    // Background colors
    content = content.replace(/#f4f1ea/g, '#e6e1d6');
    content = content.replace(/#f4ece4/g, '#e0dcd0');
    
    fs.writeFileSync(file, content);
  }
});
console.log('Colors updated successfully.');
