import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const DIST = './dist/public/assets';

function getAllFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isFile()) files.push(full);
  }
  return files;
}

const files = getAllFiles(DIST);
const compressible = files.filter(f => 
  f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.svg')
);

console.log(`Pre-compressing ${compressible.length} files with Brotli...`);

for (const file of compressible) {
  try {
    execSync(`brotli -f -q 11 -o "${file}.br" "${file}"`, { stdio: 'pipe' });
    const origSize = statSync(file).size;
    const brSize = statSync(`${file}.br`).size;
    const savings = ((1 - brSize/origSize) * 100).toFixed(1);
    console.log(`  ${file}: ${(origSize/1024).toFixed(0)}KB → ${(brSize/1024).toFixed(0)}KB (${savings}% smaller)`);
  } catch (e) {
    console.error(`  Failed: ${file}`, e.message);
  }
}

// Also gzip for fallback
console.log(`\nPre-compressing with gzip...`);
for (const file of compressible) {
  try {
    execSync(`gzip -f -k -9 "${file}"`, { stdio: 'pipe' });
  } catch (e) {
    // ignore
  }
}

console.log('Done!');
