import { describe, expect, it } from "vitest";

import { stripSonnerRuntimeStyles } from "./csp-safe-sonner";

const marker = "[data-sonner-toaster]";

function injectedModule(css: string): string {
  return `const injectStyle = (css) => css;\ninjectStyle(\`${css}\`);\nexport const sonnerValue = 1;`;
}

describe("stripSonnerRuntimeStyles", () => {
  it("removes one injected stylesheet containing repeated Sonner selectors", () => {
    const source = injectedModule(
      `${marker}{--width:356px}${marker}[data-x-position='right']{right:var(--offset-right)}`,
    );

    const transformed = stripSonnerRuntimeStyles(source);

    expect(transformed).not.toContain(marker);
    expect(transformed).not.toContain("injectStyle(`");
    expect(transformed).toContain("VETS CSP: static sonner/dist/styles.css");
    expect(transformed).toContain("export const sonnerValue = 1");
  });

  it("fails closed when Sonner markers span multiple injected templates", () => {
    const source = `${injectedModule(`${marker}{color:red}`)}\ninjectStyle(\`${marker}{color:blue}\`);`;

    expect(() => stripSonnerRuntimeStyles(source)).toThrow(
      "FAIL-CLOSED: Sonner CSS markers span multiple templates",
    );
  });

  it("fails closed when the expected Sonner marker is absent", () => {
    expect(() => stripSonnerRuntimeStyles(injectedModule(".toast{color:red}"))).toThrow(
      "FAIL-CLOSED: Sonner CSS marker was not found",
    );
  });

  it("fails closed when the marker is not inside a direct injection call", () => {
    const source = `const stylesheet = \`${marker}{color:red}\`;`;

    expect(() => stripSonnerRuntimeStyles(source)).toThrow(
      "FAIL-CLOSED: Sonner stylesheet injection call was not found",
    );
  });
});
