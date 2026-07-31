import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { transform } from "esbuild";
import { describe, expect, it } from "vitest";

import { stripSonnerRuntimeStyles } from "../vite-plugins/csp-safe-sonner";

const marker = "[data-sonner-toaster]";

function parseable(code: string) {
  return transform(code, { loader: "js", format: "esm" });
}

describe("CSP-safe Sonner transform", () => {
  it("neutralizes the exact installed Sonner ESM and keeps it parseable", async () => {
    const require = createRequire(import.meta.url);
    const cjsEntry = require.resolve("sonner");
    const esmEntry = join(dirname(cjsEntry), "index.mjs");
    const source = readFileSync(esmEntry, "utf8");
    const transformed = stripSonnerRuntimeStyles(source);

    expect(source).toContain(marker);
    expect(transformed).not.toContain(marker);
    await expect(parseable(transformed)).resolves.toBeDefined();
  });

  it("supports static quoted and template literals", async () => {
    for (const source of [
      `const css = "${marker}{color:red}"; inject(css); export const ok = true;`,
      `const css = \`${marker}{color:red}\`; inject(css); export const ok = true;`,
    ]) {
      const transformed = stripSonnerRuntimeStyles(source);
      expect(transformed).not.toContain(marker);
      await expect(parseable(transformed)).resolves.toBeDefined();
    }
  });

  it("fails closed for absent, dispersed, or interpolated CSS", () => {
    expect(() => stripSonnerRuntimeStyles("export const ok = true;")).toThrow(/FAIL-CLOSED/);
    expect(() => stripSonnerRuntimeStyles(
      `const a = "${marker}{a:b}"; const b = "${marker}{c:d}";`,
    )).toThrow(/FAIL-CLOSED/);
    expect(() => stripSonnerRuntimeStyles(
      `const css = \`${marker}{color:\${runtimeColor}}\`;`,
    )).toThrow(/FAIL-CLOSED/);
  });
});
