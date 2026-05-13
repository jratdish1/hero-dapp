import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('dist/public/index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// Remove modulepreload for web3, radix, and data-layer chunks
// Keep only react-vendor modulepreload (React must load early)
const lines = html.split('\n');
const filtered = lines.filter(line => {
  if (line.includes('modulepreload') && 
      (line.includes('web3-') || line.includes('radix-') || line.includes('data-layer-'))) {
    console.log('Removed:', line.trim());
    return false;
  }
  return true;
});

fs.writeFileSync(htmlPath, filtered.join('\n'));
console.log('Done: Stripped non-critical modulepreload hints');
