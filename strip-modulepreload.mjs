import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('dist/public/index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

const lines = html.split('\n');
const filtered = lines.map(line => {
  if (line.includes('modulepreload') && 
      (line.includes('web3-') || line.includes('radix-') || line.includes('data-layer-'))) {
    console.log('Removed modulepreload:', line.trim());
    return null;
  }
  if (line.includes('rel="stylesheet"') && line.includes('/assets/')) {
    const hrefMatch = line.match(/href="([^"]+)"/);
    if (hrefMatch) {
      console.log('Made CSS non-blocking:', hrefMatch[1]);
      const nonBlocking = line.replace('rel="stylesheet"', 'rel="stylesheet" media="print" onload="this.media=\'all\'"');
      return nonBlocking + '\n    <noscript><link rel="stylesheet" href="' + hrefMatch[1] + '"></noscript>';
    }
  }
  return line;
}).filter(line => line !== null);

const criticalCSS = '    <style>*,*::before,*::after{box-sizing:border-box;margin:0}html{-webkit-text-size-adjust:100%;line-height:1.5}body{font-family:Inter,system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#fafafa;min-height:100vh}#root{min-height:100vh;display:flex;flex-direction:column}img,video{max-width:100%;height:auto;display:block}a{color:inherit;text-decoration:none}</style>';

html = filtered.join('\n');
html = html.replace('</head>', criticalCSS + '\n  </head>');

fs.writeFileSync(htmlPath, html);
console.log('Done: Optimized HTML for performance');
