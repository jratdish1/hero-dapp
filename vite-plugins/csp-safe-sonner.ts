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

/**
 * Neutralize Sonner's one bundled runtime stylesheet without depending on the
 * surrounding bundler-generated call or tag shape. The pinned package also
 * publishes sonner/dist/styles.css, which the application imports statically.
 *
 * Preserve the original template delimiters and remove only their static CSS
 * body. This remains syntactically valid whether the template is assigned,
 * passed to a function, or tagged. Package-shape drift, multiple templates, or
 * interpolation fails the build closed. The production browser CSP matrix then
 * proves that the emptied runtime path does not create an inline stylesheet.
 */
export function stripSonnerRuntimeStyles(code: string): string {
  const markerPositions = findAllMarkerPositions(code);
  if (markerPositions.length === 0) {
    throw new Error("FAIL-CLOSED: Sonner CSS marker was not found");
  }

  const templateStart = findTemplateStart(code, markerPositions[0]);
  const templateEnd = findTemplateEnd(code, templateStart);
  if (templateStart < 0 || templateEnd < 0) {
    throw new Error("FAIL-CLOSED: Sonner bundled stylesheet template was not found");
  }

  if (!markerPositions.every((markerAt) => markerAt > templateStart && markerAt < templateEnd)) {
    throw new Error("FAIL-CLOSED: Sonner CSS markers span multiple templates");
  }

  const cssTemplate = code.slice(templateStart + 1, templateEnd);
  if (!cssTemplate.includes(SONNER_CSS_MARKER)) {
    throw new Error("FAIL-CLOSED: Sonner stylesheet marker escaped the candidate template");
  }
  if (cssTemplate.includes("${")) {
    throw new Error("FAIL-CLOSED: Sonner bundled stylesheet became interpolated");
  }

  const transformed = `${code.slice(0, templateStart + 1)}${code.slice(templateEnd)}`;

  if (transformed.includes(SONNER_CSS_MARKER)) {
    throw new Error("FAIL-CLOSED: Sonner runtime CSS remained after transform");
  }

  return transformed;
}

/**
 * Sonner 2.0.7 publishes a static stylesheet and also bundles that CSS for
 * runtime injection. The runtime <style> violates strict style-src-elem.
 * Empty only the pinned Sonner stylesheet template and load
 * sonner/dist/styles.css from application source. Package-shape drift fails the
 * build and the mounted browser tests enforce the CSP result.
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
