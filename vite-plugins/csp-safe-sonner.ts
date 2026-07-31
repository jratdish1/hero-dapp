import type { Plugin } from "vite";

const SONNER_MODULE_SUFFIX = "/sonner/dist/index.mjs";
const SONNER_CSS_MARKER = "[data-sonner-toaster]";

function isEscaped(code: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && code[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function findTemplateStart(code: string, markerAt: number): number {
  for (let index = markerAt; index >= 0; index -= 1) {
    if (code[index] === "`" && !isEscaped(code, index)) return index;
  }
  return -1;
}

function findTemplateEnd(code: string, start: number): number {
  for (let index = start + 1; index < code.length; index += 1) {
    if (code[index] === "`" && !isEscaped(code, index)) return index;
  }
  return -1;
}

function findAllMarkerPositions(code: string): number[] {
  const positions: number[] = [];
  let cursor = 0;
  while (cursor < code.length) {
    const markerAt = code.indexOf(SONNER_CSS_MARKER, cursor);
    if (markerAt < 0) break;
    positions.push(markerAt);
    cursor = markerAt + SONNER_CSS_MARKER.length;
  }
  return positions;
}

function skipQuoted(code: string, start: number): number {
  const quote = code[start];
  for (let index = start + 1; index < code.length; index += 1) {
    if (code[index] === quote && !isEscaped(code, index)) return index + 1;
  }
  return -1;
}

function findMatchingCallClose(
  code: string,
  openParen: number,
  stylesheetStart: number,
  stylesheetEnd: number,
): number {
  let depth = 1;
  let index = openParen + 1;

  while (index < code.length) {
    if (index === stylesheetStart) {
      index = stylesheetEnd + 1;
      continue;
    }

    const char = code[index];
    const next = code[index + 1];

    if (char === "'" || char === '"' || char === "`") {
      const afterQuote = skipQuoted(code, index);
      if (afterQuote < 0) return -1;
      index = afterQuote;
      continue;
    }

    if (char === "/" && next === "/") {
      const newline = code.indexOf("\n", index + 2);
      index = newline < 0 ? code.length : newline + 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const commentEnd = code.indexOf("*/", index + 2);
      if (commentEnd < 0) return -1;
      index = commentEnd + 2;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }

    index += 1;
  }

  return -1;
}

/**
 * Remove Sonner's one top-level runtime stylesheet injection while preserving
 * the component implementation. Repeated selector markers are expected inside
 * the single CSS template; markers spanning more than one template fail closed.
 */
export function stripSonnerRuntimeStyles(code: string): string {
  const markerPositions = findAllMarkerPositions(code);
  if (markerPositions.length === 0) {
    throw new Error("FAIL-CLOSED: Sonner CSS marker was not found");
  }

  const templateStart = findTemplateStart(code, markerPositions[0]);
  const templateEnd = findTemplateEnd(code, templateStart);
  if (templateStart < 0 || templateEnd < 0) {
    throw new Error("FAIL-CLOSED: Sonner injected stylesheet template was not found");
  }

  if (!markerPositions.every((markerAt) => markerAt > templateStart && markerAt < templateEnd)) {
    throw new Error("FAIL-CLOSED: Sonner CSS markers span multiple templates");
  }

  const cssTemplate = code.slice(templateStart + 1, templateEnd);
  if (!cssTemplate.includes(SONNER_CSS_MARKER)) {
    throw new Error("FAIL-CLOSED: Sonner stylesheet marker escaped the candidate template");
  }

  const openParen = code.lastIndexOf("(", templateStart);
  if (openParen < 1 || code.slice(openParen + 1, templateStart).trim() !== "") {
    throw new Error("FAIL-CLOSED: Sonner stylesheet injection call was not found");
  }

  let callStart = openParen - 1;
  while (callStart >= 0 && /[A-Za-z0-9_$]/.test(code[callStart])) callStart -= 1;
  callStart += 1;
  const callee = code.slice(callStart, openParen);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callee)) {
    throw new Error("FAIL-CLOSED: Sonner stylesheet injector callee changed");
  }

  const closeParen = findMatchingCallClose(code, openParen, templateStart, templateEnd);
  if (closeParen < 0) {
    throw new Error("FAIL-CLOSED: Sonner stylesheet injection call did not close");
  }

  const trailingArguments = code.slice(templateEnd + 1, closeParen).trim();
  if (trailingArguments !== "" && !trailingArguments.startsWith(",")) {
    throw new Error("FAIL-CLOSED: Sonner stylesheet injection arguments changed");
  }

  let statementEnd = closeParen + 1;
  while (statementEnd < code.length && /[ \t]/.test(code[statementEnd])) statementEnd += 1;
  if (code[statementEnd] === ";") {
    statementEnd += 1;
  } else if (statementEnd < code.length && code[statementEnd] !== "\n" && code[statementEnd] !== "\r") {
    throw new Error("FAIL-CLOSED: Sonner stylesheet injection statement changed");
  }

  const transformed = `${code.slice(0, callStart)}/* VETS CSP: static sonner/dist/styles.css */${code.slice(statementEnd)}`;
  if (transformed.includes(SONNER_CSS_MARKER)) {
    throw new Error("FAIL-CLOSED: Sonner runtime CSS remained after transform");
  }

  return transformed;
}

/**
 * Sonner 2.0.7 publishes a static stylesheet and also injects that CSS at
 * module evaluation time. The runtime <style> violates strict style-src-elem.
 * Remove only the top-level injection and load sonner/dist/styles.css from
 * application source. Any ambiguous upstream module shape fails the build.
 */
export function cspSafeSonnerPlugin(): Plugin {
  return {
    name: "vets-csp-safe-sonner",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.split("?")[0].replaceAll("\\", "/");
      if (!normalizedId.endsWith(SONNER_MODULE_SUFFIX)) return null;

      return { code: stripSonnerRuntimeStyles(code), map: null };
    },
  };
}
