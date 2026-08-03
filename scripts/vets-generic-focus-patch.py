#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/check-generic-error-focus.mjs')
text = path.read_text(encoding='utf-8')
old = """        await new Promise(resolve => requestAnimationFrame(() => resolve()));
        const heading = document.getElementById(${JSON.stringify(EXPECTED_HEADING_ID)});
        document.body.dataset.ready = 'true';
        document.body.dataset.focusedId = document.activeElement?.id || '';
        document.body.dataset.heading = heading?.textContent?.trim() || '';
        document.body.dataset.focusClass = heading?.className || '';
"""
new = """        let heading = null;
        const headingDeadline = Date.now() + 10_000;
        while (Date.now() < headingDeadline) {
          heading = document.getElementById(${JSON.stringify(EXPECTED_HEADING_ID)});
          if (heading) break;
          await new Promise(resolve => requestAnimationFrame(() => resolve()));
        }
        if (!heading) throw new Error('Generic error heading did not mount');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        document.body.dataset.ready = 'true';
        document.body.dataset.focusedId = document.activeElement?.id || '';
        document.body.dataset.heading = heading.textContent?.trim() || '';
        document.body.dataset.focusClass = heading.className || '';
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one readiness block, found {text.count(old)}')
path.write_text(text.replace(old, new), encoding='utf-8')
print('generic focus readiness patch applied')
