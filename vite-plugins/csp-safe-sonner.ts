import type { Plugin } from "vite";

const SONNER_MODULE_SUFFIX = "/sonner/dist/index.mjs";
const SONNER_CSS_MARKER = "[data-sonner-toaster]";

function findTemplateStart(code: string, markerAt: number): number {
  for (let index = markerAt; index >= 0; index -= 1) {
    if (code[index] === "`" && code[index - 1] !== "\\") return index;
  }
  return -1;
}

function findTemplateEnd(code: string, start: number): number {
  for (let index = start + 1; index < code.length; index += 1) {
    if (code[index] === "`" && code[index - 1] !== "\\") return index;
  }
  return -1;
}

/**
 * Sonner 2.0.7 ships a static stylesheet and also injects the same CSS at
 * module evaluation time. The runtime <style> violates strict style-src-elem.
 * Remove only that one top-level CSS injection and load the published static
 * stylesheet from application source. Fail the build if the upstream module
 * shape changes, so a dependency update cannot silently weaken the CSP gate.
 */
export function cspSafeSonnerPlugin(): Plugin {
  return {
    name: "vets-csp-safe-sonner",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.split("?")[0].replaceAll("\\", "/");
      if (!normalizedId.endsWith(SONNER_MODULE_SUFFIX)) return null;

      const markerAt = code.indexOf(SONNER_CSS_MARKER);
      if (markerAt < 0 || code.indexOf(SONNER_CSS_MARKER, markerAt + 1) >= 0) {
        throw new Error("FAIL-CLOSED: Sonner CSS marker count changed");
      }

      const templateStart = findTemplateStart(code, markerAt);
      const templateEnd = findTemplateEnd(code, templateStart);
      if (templateStart < 0 || templateEnd < 0) {
        throw new Error("FAIL-CLOSED: Sonner injected stylesheet template was not found");
      }

      const openParen = code.lastIndexOf("(", templateStart);
      if (openParen < 1) {
        throw new Error("FAIL-CLOSED: Sonner stylesheet injection call was not found");
      }

      let callStart = openParen - 1;
      while (callStart >= 0 && /[A-Za-z0-9_$]/.test(code[callStart])) callStart -= 1;
      callStart += 1;
      const callee = code.slice(callStart, openParen);
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callee)) {
        throw new Error("FAIL-CLOSED: Sonner stylesheet injector callee changed");
      }

      const callEnd = code.indexOf(";", templateEnd);
      if (callEnd < 0 || code.slice(templateEnd + 1, callEnd).trim() !== ")") {
        throw new Error("FAIL-CLOSED: Sonner stylesheet injection statement changed");
      }

      const transformed = `${code.slice(0, callStart)}/* VETS CSP: static sonner/dist/styles.css */${code.slice(callEnd + 1)}`;
      if (transformed.includes(SONNER_CSS_MARKER)) {
        throw new Error("FAIL-CLOSED: Sonner runtime CSS remained after transform");
      }

      return { code: transformed, map: null };
    },
  };
}
