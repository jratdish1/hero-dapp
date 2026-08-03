#!/usr/bin/env python3
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = "3f9af36c1b916143bf9c05081c908e2ea504b422"


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    target.write_text(text.replace(old, new), encoding="utf-8")


def copy_from_source(path: str) -> None:
    content = subprocess.check_output(
        ["git", "show", f"{SOURCE_SHA}:{path}"],
        cwd=ROOT,
    )
    (ROOT / path).write_bytes(content)


for source_path in (
    "nginx/herobase-cache-headers.conf",
    "server/_core/security.ts",
    "vite.config.ts",
):
    copy_from_source(source_path)

replace_once(
    "server/_core/security.ts",
    """    styleSrc: [\"'self'\"],
    styleSrcElem: [\"'self'\"],
    // Transitional: application and audited third-party components still emit style attributes.
    styleSrcAttr: [\"'unsafe-inline'\"],""",
    """    // Vite injects development-only styles for HMR. Production remains strict.
    styleSrc: isDev ? [\"'self'\", \"'unsafe-inline'\"] : [\"'self'\"],
    styleSrcElem: isDev ? [\"'self'\", \"'unsafe-inline'\"] : [\"'self'\"],
    // Transitional: application and audited third-party components still emit style attributes.
    styleSrcAttr: [\"'unsafe-inline'\"],""",
)

replace_once(
    "scripts/check-generic-error-focus.mjs",
    """      setTimeout(() => {
        const heading = document.getElementById(${JSON.stringify(EXPECTED_HEADING_ID)});
        document.body.dataset.ready = 'true';
        document.body.dataset.focusedId = document.activeElement?.id || '';
        document.body.dataset.heading = heading?.textContent?.trim() || '';
        document.body.dataset.focusClass = heading?.className || '';
      }, 100);""",
    """      const markReady = async () => {
        if (document.readyState !== 'complete') {
          await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
        }
        const links = Array.from(document.querySelectorAll('link[rel~=\"stylesheet\"]'));
        await Promise.all(links.map(link => {
          if (link.sheet) return Promise.resolve();
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Stylesheet readiness timed out')), 10_000);
            link.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
            link.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Stylesheet failed to load')); }, { once: true });
          });
        }));
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
        const heading = document.getElementById(${JSON.stringify(EXPECTED_HEADING_ID)});
        document.body.dataset.ready = 'true';
        document.body.dataset.focusedId = document.activeElement?.id || '';
        document.body.dataset.heading = heading?.textContent?.trim() || '';
        document.body.dataset.focusClass = heading?.className || '';
      };
      void markReady().catch(error => {
        console.error('[Generic focus harness readiness failed]', error);
      });""",
)

replace_once(
    "scripts/check-generic-error-focus.mjs",
    """    if (!state.focusClass.includes('focus:outline') || state.focusClass.includes('focus:outline-none')) {
      throw new Error(`Generic error heading lacks a focus utility: ${state.focusClass}`);
    }""",
    """    if (!state.focusClass.includes('vets-recovery-heading')) {
      throw new Error(`Generic error heading lacks the static recovery class: ${state.focusClass}`);
    }""",
)

ci_path = ROOT / ".github/workflows/ci.yml"
ci = ci_path.read_text(encoding="utf-8")
ci = ci.replace("    timeout-minutes: 20\n", "    timeout-minutes: 35\n", 1)

build_anchor = """      - name: Build
        run: pnpm build

      - name: Locate headless Chrome"""
build_insert = """      - name: Build
        run: pnpm build

      - name: Verify production CSP contract
        run: node scripts/check-csp-contract.mjs

      - name: Complete Hardhat v2 suite
        run: pnpm exec hardhat test test/v2/*.test.mjs --config hardhat.v2test.config.mjs

      - name: Locate headless Chrome"""
if ci.count(build_anchor) != 1:
    raise SystemExit("ci.yml: build anchor missing or duplicated")
ci = ci.replace(build_anchor, build_insert)

browser_anchor = """      - name: Verify public landing critical path
        shell: bash"""
browser_insert = """      - name: Exercise production CSP route matrix
        env:
          CHROME_BIN: ${{ steps.chrome.outputs.chrome_bin }}
        run: node scripts/check-csp-routes.mjs

      - name: Exercise Radix dialog scroll lock under production CSP
        env:
          CHROME_BIN: ${{ steps.chrome.outputs.chrome_bin }}
        run: node scripts/check-scroll-lock-csp.mjs

      - name: Verify public landing critical path
        shell: bash"""
if ci.count(browser_anchor) != 1:
    raise SystemExit("ci.yml: browser anchor missing or duplicated")
ci = ci.replace(browser_anchor, browser_insert)

old_condition = """        if: always() && hashFiles('landing-bundle-report.txt', 'bootstrap-recovery.log', 'bootstrap-recovery-report.json', 'generic-error-focus.log', 'generic-error-focus-report.json') != ''"""
new_condition = """        if: always() && hashFiles('landing-bundle-report.txt', 'bootstrap-recovery.log', 'bootstrap-recovery-report.json', 'generic-error-focus.log', 'generic-error-focus-report.json', 'csp-contract-report.json', 'csp-browser-report.json', 'scroll-lock-csp-report.json') != ''"""
if ci.count(old_condition) != 1:
    raise SystemExit("ci.yml: artifact condition missing or duplicated")
ci = ci.replace(old_condition, new_condition)

manifest_anchor = """            generic-error-focus-report.json
            dist/public/.vite/manifest.json"""
manifest_insert = """            generic-error-focus-report.json
            csp-contract-report.json
            csp-browser-report.json
            scroll-lock-csp-report.json
            dist/public/.vite/manifest.json
            dist/public/assets/DappBootstrap-*.js"""
if ci.count(manifest_anchor) != 1:
    raise SystemExit("ci.yml: artifact path anchor missing or duplicated")
ci = ci.replace(manifest_anchor, manifest_insert)
ci_path.write_text(ci, encoding="utf-8")

helper = ROOT / "client/src/lib/csp-safe-markdown.ts"
helper.write_text(
    """/** Keep Mermaid source readable without activating its runtime SVG style injector. */
export function disableMermaidDiagrams(markdown: string): string {
  return markdown.replace(
    /^(\\s*)(`{3,}|~{3,})\\s*mermaid(?:\\s+[^\\r\\n]*)?\\s*$/gim,
    (_match, indentation: string, fence: string) => `${indentation}${fence}text`,
  );
}
""",
    encoding="utf-8",
)

markdown_test = ROOT / "server/csp-safe-markdown.test.ts"
markdown_test.write_text(
    """import { describe, expect, it } from \"vitest\";
import { disableMermaidDiagrams } from \"../client/src/lib/csp-safe-markdown\";

describe(\"CSP-safe markdown\", () => {
  it(\"neutralizes backtick and tilde Mermaid fences without changing content\", () => {
    expect(disableMermaidDiagrams(\"```mermaid\\ngraph TD; A-->B\\n```\"))
      .toBe(\"```text\\ngraph TD; A-->B\\n```\");
    expect(disableMermaidDiagrams(\"  ~~~~ MERMAID theme=dark\\nA-->B\\n~~~~\"))
      .toBe(\"  ~~~~text\\nA-->B\\n~~~~\");
  });

  it(\"leaves non-Mermaid fences and prose unchanged\", () => {
    const value = \"```typescript\\nconst mermaid = true;\\n```\";
    expect(disableMermaidDiagrams(value)).toBe(value);
  });
});
""",
    encoding="utf-8",
)

markdown_updates = {
    "client/src/pages/AiAssistant.tsx": (
        'import { sanitizeString } from "../lib/validation";\n',
        'import { sanitizeString } from "../lib/validation";\nimport { disableMermaidDiagrams } from "../lib/csp-safe-markdown";\n',
        '<Streamdown>{sanitizeString(msg.content)}</Streamdown>',
        '<Streamdown>{disableMermaidDiagrams(sanitizeString(msg.content))}</Streamdown>',
    ),
    "client/src/pages/Blog.tsx": (
        'import { sanitizeString } from "../lib/validation";\n',
        'import { sanitizeString } from "../lib/validation";\nimport { disableMermaidDiagrams } from "../lib/csp-safe-markdown";\n',
        '<Streamdown>{sanitizeString(postQuery.data.content)}</Streamdown>',
        '<Streamdown>{disableMermaidDiagrams(sanitizeString(postQuery.data.content))}</Streamdown>',
    ),
    "client/src/components/AIChatBox.tsx": (
        'import { sanitizeString } from "@/lib/validation";\n',
        'import { sanitizeString } from "@/lib/validation";\nimport { disableMermaidDiagrams } from "@/lib/csp-safe-markdown";\n',
        '<Streamdown>{sanitizeString(message.content)}</Streamdown>',
        '<Streamdown>{disableMermaidDiagrams(sanitizeString(message.content))}</Streamdown>',
    ),
}
for path, (import_old, import_new, render_old, render_new) in markdown_updates.items():
    replace_once(path, import_old, import_new)
    replace_once(path, render_old, render_new)

checker = ROOT / "scripts/check-csp-contract.mjs"
checker_text = checker.read_text(encoding="utf-8")
checker_anchor = """if (!viteConfig.includes('csp-safe-remove-scroll-bar.tsx')) {
  fail('Vite scroll-lock alias does not target the CSP-safe shim');
}

const styleFiles = [];"""
checker_insert = """if (!viteConfig.includes('csp-safe-remove-scroll-bar.tsx')) {
  fail('Vite scroll-lock alias does not target the CSP-safe shim');
}

for (const file of [
  'client/src/pages/AiAssistant.tsx',
  'client/src/pages/Blog.tsx',
  'client/src/components/AIChatBox.tsx',
]) {
  const text = readFileSync(path.join(root, file), 'utf8');
  if (!text.includes('disableMermaidDiagrams')) {
    fail(`Streamdown Mermaid runtime path is not neutralized in ${file}`);
  }
}

const styleFiles = [];"""
if checker_text.count(checker_anchor) != 1:
    raise SystemExit("check-csp-contract.mjs: Streamdown gate anchor missing or duplicated")
checker.write_text(checker_text.replace(checker_anchor, checker_insert), encoding="utf-8")

old_public = ROOT / "client/public/security-recovery.css"
if old_public.exists():
    old_public.unlink()

for forbidden in (
    ROOT / ".github/workflows/deploy-vdss.yml",
    ROOT / "scripts/vets-vdss-production.sh",
):
    if forbidden.exists():
        raise SystemExit(f"contaminated deployment file present: {forbidden.relative_to(ROOT)}")

print("CSP rebuild patch applied")
