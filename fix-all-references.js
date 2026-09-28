const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'app/help/page.tsx',
  'app/layout.tsx',
  'components/admin/content-manager.tsx',
  'components/auth/auth-form.tsx',
  'components/course/enrol-button.tsx',
  'components/marketing/site-footer.tsx',
  'components/shell/sidebar-nav.tsx',
  'content/announcements/announcements.json',
  'content/course.json',
  'lib/data/admin.ts',
  'lib/data/assessments.ts',
  'lib/data/learner.ts',
  'lib/data/theory.ts',
  'lib/email/send.tsx',
  'public/manifest.json'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const updated = content.replace(/LIS 815/g, 'LIS LMS');
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`Updated: ${file}`);
    }
  } else {
    console.log(`Not found: ${file}`);
  }
});

console.log('Done updating all files');