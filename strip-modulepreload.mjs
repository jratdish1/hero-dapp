import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('dist/public/index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

const lines = html.split('\n');
const filtered = lines.filter(line => {
  if (line.includes('modulepreload') && 
      (line.includes('web3-') || line.includes('radix-') || line.includes('data-layer-'))) {
    console.log('Removed modulepreload:', line.trim());
    return false;
  }
  return true;
});

// Add minimal critical inline CSS for instant dark background (prevents white flash)
const criticalCSS = '    <style>*,*::before,*::after{box-sizing:border-box;margin:0}html{line-height:1.5}body{font-family:Inter,system-ui,sans-serif;background:#0a0a0a;color:#fafafa;min-height:100vh}#root{min-height:100vh}</style>';

html = filtered.join('\n');
html = html.replace('</head>', criticalCSS + '\n  </head>');

fs.writeFileSync(htmlPath, html);
console.log('Done: Optimized HTML for performance');
