#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/check-generic-error-focus.mjs')
text = path.read_text(encoding='utf-8')

old_render = """      const root = document.getElementById('root');
      if (!root) throw new Error('Missing generic focus test root');
      createRoot(root, createRootErrorHandlers(false)).render(
        <ErrorBoundary><ThrowOnInitialRender /></ErrorBoundary>,
      );

      const markReady = async () => {"""
new_render = """      const markReady = async () => {"""
if text.count(old_render) != 1:
    raise SystemExit(f'expected one eager render block, found {text.count(old_render)}')
text = text.replace(old_render, new_render)

old_styles = """        await Promise.all(links.map(link => {
          if (link.sheet) return Promise.resolve();
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Stylesheet readiness timed out')), 10_000);
            link.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
            link.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Stylesheet failed to load')); }, { once: true });
          });
        }));
        let heading = null;"""
new_styles = """        await Promise.all(links.map(link => {
          if (link.sheet) return Promise.resolve();
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Stylesheet readiness timed out')), 10_000);
            link.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
            link.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Stylesheet failed to load')); }, { once: true });
          });
        }));

        const root = document.getElementById('root');
        if (!root) throw new Error('Missing generic focus test root');
        createRoot(root, createRootErrorHandlers(false)).render(
          <ErrorBoundary><ThrowOnInitialRender /></ErrorBoundary>,
        );

        let heading = null;"""
if text.count(old_styles) != 1:
    raise SystemExit(f'expected one stylesheet readiness block, found {text.count(old_styles)}')
text = text.replace(old_styles, new_styles)

path.write_text(text, encoding='utf-8')
print('generic focus render-order patch applied')
