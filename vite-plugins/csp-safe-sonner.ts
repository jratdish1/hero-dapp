import ts from "typescript";
import type { Plugin } from "vite";

const MODULE_SUFFIX = "/sonner/dist/index.mjs";
const MARKER = "[data-sonner-toaster]";

type CssLiteral = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral;

function count(value: string, needle: string): number {
  let total = 0;
  for (let at = value.indexOf(needle); at >= 0; at = value.indexOf(needle, at + needle.length)) {
    total += 1;
  }
  return total;
}

function parse(code: string, name: string): ts.SourceFile {
  return ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

function firstParseError(source: ts.SourceFile): string | null {
  const diagnostics = (source as ts.SourceFile & {
    parseDiagnostics?: readonly ts.Diagnostic[];
  }).parseDiagnostics ?? [];
  if (diagnostics.length === 0) return null;
  return ts.flattenDiagnosticMessageText(diagnostics[0].messageText, " ");
}

export function stripSonnerRuntimeStyles(code: string): string {
  const source = parse(code, "sonner/dist/index.mjs");
  const candidates: CssLiteral[] = [];

  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && node.text.includes(MARKER)
    ) {
      candidates.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (candidates.length !== 1) {
    throw new Error(`FAIL-CLOSED: expected one Sonner CSS literal, found ${candidates.length}`);
  }

  const candidate = candidates[0];
  if (count(candidate.text, MARKER) !== count(code, MARKER)) {
    throw new Error("FAIL-CLOSED: Sonner CSS markers span multiple syntax nodes");
  }

  const replacement = ts.isNoSubstitutionTemplateLiteral(candidate) ? "``" : '""';
  const transformed = `${code.slice(0, candidate.getStart(source))}${replacement}${code.slice(candidate.getEnd())}`;

  if (transformed.includes(MARKER)) {
    throw new Error("FAIL-CLOSED: Sonner runtime CSS remained after transform");
  }
  const parseError = firstParseError(parse(transformed, "sonner/dist/index.transformed.mjs"));
  if (parseError) {
    throw new Error(`FAIL-CLOSED: transformed Sonner module does not parse: ${parseError}`);
  }
  return transformed;
}

export function cspSafeSonnerPlugin(): Plugin {
  return {
    name: "vets-csp-safe-sonner",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.split("?")[0].replaceAll("\\", "/");
      if (!normalizedId.endsWith(MODULE_SUFFIX)) return null;
      return { code: stripSonnerRuntimeStyles(code), map: null };
    },
  };
}
