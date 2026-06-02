const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = execSync('git ls-files').toString().trim().split('\n');
const fileSizes = files
  .map((file) => {
    try {
      const stat = fs.statSync(path.resolve(file));
      return { size: stat.size, file };
    } catch (e) {
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => b.size - a.size)
  .slice(0, 25);

console.log('📦 بزرگ‌ترین فایل‌های track شده در Git:\n');
fileSizes.forEach((f) => {
  const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
  console.log(`${sizeMB.padStart(8)} MB  ${f.file}`);
});