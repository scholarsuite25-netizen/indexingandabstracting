const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, 'lib', 'email', 'templates');
const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(templatesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace all instances of "LIS 815" with "LIS LMS"
  let updated = content.replace(/LIS 815/g, 'LIS LMS');
  
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`Updated: ${file}`);
  }
});

console.log('Done updating email templates');