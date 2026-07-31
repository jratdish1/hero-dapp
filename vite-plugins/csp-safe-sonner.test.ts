import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { stripSonnerRuntimeStyles } from "./csp-safe-sonner";

const marker = "[data-sonner-toaster]";

function bundledModule(css: string): string {
  return `const bundledStyles = \`${css}\`;\nconst injectStyle = (value) => value;\ninjectStyle(bundledStyles);\nexport const sonnerValue = 1;`;
}

describe("stripSonnerRuntimeStyles", () => {
  it("neutralizes one bundled stylesheet containing repeated Sonner selectors", () => {
    const source = bundledModule(
      `${marker}{--width:356px}${marker}[data-x-position='right']{right:var(--offset-right)}`,
    );

    const transformed = stripSonnerRuntimeStyles(source);

    expect(transformed).not.toContain(marker);
    expect(transformed).toContain('VETS CSP: static sonner/dist/styles.css */""');
    expect(transformed).toContain("injectStyle(bundledStyles)");
    expect(transformed).toContain("export const sonnerValue = 1");
  });

  it("handles a stylesheet template used directly in a call with metadata", () => {
    const source = `const injectStyle = (css, meta) => ({ css, meta });\ninjectStyle(\`${marker}{color:red}\`, { source: "sonner" });\nexport const sonnerValue = 1;`;

    const transformed = stripSonnerRuntimeStyles(source);

    expect(transformed).not.toContain(marker);
    expect(transformed).toContain('{ source: "sonner" }');
    expect(transformed).toContain("export const sonnerValue = 1");
  });

  it("neutralizes the exact installed Sonner 2.0.7 ESM distribution", () => {
    const require = createRequire(import.meta.url);
    const sonnerCjsEntry = require.resolve("sonner");
    const sonnerEsmEntry = join(dirname(sonnerCjsEntry), "index.mjs");

    expect(existsSync(sonnerEsmEntry)).toBe(true);
    const source = readFileSync(sonnerEsmEntry, "utf8");
    const transformed = stripSonnerRuntimeStyles(source);

    expect(source).toContain(marker);
    expect(transformed).not.toContain(marker);
    expect(transformed).toContain('VETS CSP: static sonner/dist/styles.css */""');
  });

  it("fails closed when Sonner markers span multiple templates", () => {
    const source = `${bundledModule(`${marker}{color:red}`)}\nconst other = \`${marker}{color:blue}\`;`;

    expect(() => stripSonnerRuntimeStyles(source)).toThrow(
      "FAIL-CLOSED: Sonner CSS markers span multiple templates",
    );
  });

  it("fails closed when the expected Sonner marker is absent", () => {
    expect(() => stripSonnerRuntimeStyles(bundledModule(".toast{color:red}"))).toThrow(
      "FAIL-CLOSED: Sonner CSS marker was not found",
    );
  });

  it("fails closed when the bundled stylesheet becomes interpolated", () => {
    const source = bundledModule(`${marker}{color:${"${runtimeColor}"}}`);

    expect(() => stripSonnerRuntimeStyles(source)).toThrow(
      "FAIL-CLOSED: Sonner bundled stylesheet became interpolated",
    );
  });
});
