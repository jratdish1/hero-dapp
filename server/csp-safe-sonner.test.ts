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

function injector(name = "inject") {
  return `
    const ${name} = (css) => {
      // Fixture signature: createElement("style"), textContent, appendChild.
      if (!css) return;
      return css;
    };
  `;
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

  it("supports one complete top-level quoted or template binding", async () => {
    for (const value of [
      `"${marker}{color:red}"`,
      `\`${marker}{color:red}\``,
    ]) {
      const source = `${injector()} const sheetText = ${value}; inject(sheetText); export const ok = true;`;
      const transformed = stripSonnerRuntimeStyles(source);
      expect(transformed).not.toContain(marker);
      expect(transformed).toContain("void 0");
      await expect(parseable(transformed)).resolves.toBeDefined();
    }
  });

  it("empties a non-exported binding after the injector was tree-shaken", async () => {
    const source = `const sheetText = "${marker}{color:red}"; export const ok = true;`;
    const transformed = stripSonnerRuntimeStyles(source);
    expect(transformed).not.toContain(marker);
    expect(transformed).toContain('const sheetText = ""');
    await expect(parseable(transformed)).resolves.toBeDefined();
  });

  it("rejects an unused exported CSS binding because it can escape the module", () => {
    expect(() => stripSonnerRuntimeStyles(
      `export const sheetText = "${marker}{color:red}";`,
    )).toThrow(/exported and can escape/);
  });

  it("supports a complete direct literal injector argument", async () => {
    const source = `${injector()} inject("${marker}{color:red}"); export const ok = true;`;
    const transformed = stripSonnerRuntimeStyles(source);
    expect(transformed).not.toContain(marker);
    expect(transformed).toContain("void 0");
    await expect(parseable(transformed)).resolves.toBeDefined();
  });

  it("supports a complete tagged-template injector", async () => {
    const source = `${injector()} inject\`${marker}{color:red}\`; export const ok = true;`;
    const transformed = stripSonnerRuntimeStyles(source);
    expect(transformed).not.toContain(marker);
    expect(transformed).toContain("void 0");
    await expect(parseable(transformed)).resolves.toBeDefined();
  });

  it("fails closed when the marker literal is only part of an injected value", () => {
    expect(() => stripSonnerRuntimeStyles(
      `${injector()} const sheetText = "${marker}{a:b}" + ".extra{c:d}"; inject(sheetText);`,
    )).toThrow(/complete direct injector value|top-level binding/);

    expect(() => stripSonnerRuntimeStyles(
      `${injector()} const sheetText = "${marker}{a:b}"; inject(sheetText + ".extra{c:d}");`,
    )).toThrow(/complete injector argument/);

    expect(() => stripSonnerRuntimeStyles(
      `${injector()} inject("${marker}{a:b}" + ".extra{c:d}");`,
    )).toThrow(/complete direct injector value|top-level binding/);
  });

  it("fails closed when the CSS binding has multiple consumers", () => {
    expect(() => stripSonnerRuntimeStyles(
      `${injector()} const sheetText = "${marker}{a:b}"; inject(sheetText); console.log(sheetText);`,
    )).toThrow(/at most one use/);
  });

  it("fails closed for an unrecognized consumer", () => {
    expect(() => stripSonnerRuntimeStyles(
      `const forward = (value) => value; const sheetText = "${marker}{a:b}"; forward(sheetText);`,
    )).toThrow(/runtime style injector/);
  });

  it("fails closed for absent, dispersed, or interpolated CSS", () => {
    expect(() => stripSonnerRuntimeStyles("export const ok = true;")).toThrow(/FAIL-CLOSED/);
    expect(() => stripSonnerRuntimeStyles(
      `${injector()} const a = "${marker}{a:b}"; const b = "${marker}{c:d}";`,
    )).toThrow(/found 2/);
    expect(() => stripSonnerRuntimeStyles(
      `${injector()} const sheetText = \`${marker}{color:\${runtimeColor}}\`; inject(sheetText);`,
    )).toThrow(/FAIL-CLOSED/);
  });
});
