import ts from "typescript";
import type { Plugin } from "vite";

const MODULE_SUFFIX = "/sonner/dist/index.mjs";
const MARKER = "[data-sonner-toaster]";

type CssLiteral = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral;
type Replacement = {
  start: number;
  end: number;
  text: string;
};

function count(value: string, needle: string): number {
  let total = 0;
  for (
    let at = value.indexOf(needle);
    at >= 0;
    at = value.indexOf(needle, at + needle.length)
  ) {
    total += 1;
  }
  return total;
}

function parse(code: string, name: string): ts.SourceFile {
  return ts.createSourceFile(
    name,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
}

function firstParseError(source: ts.SourceFile): string | null {
  const diagnostics = (
    source as ts.SourceFile & {
      parseDiagnostics?: readonly ts.Diagnostic[];
    }
  ).parseDiagnostics ?? [];
  if (diagnostics.length === 0) return null;
  return ts.flattenDiagnosticMessageText(diagnostics[0].messageText, " ");
}

function fail(message: string): never {
  throw new Error(`FAIL-CLOSED: ${message}`);
}

function directIdentifierCallee(call: ts.CallExpression): ts.Identifier {
  if (!ts.isIdentifier(call.expression)) {
    fail("Sonner CSS injector call is not a direct identifier call");
  }
  return call.expression;
}

function injectorDeclarationText(
  source: ts.SourceFile,
  callee: ts.Identifier,
): string {
  const matches: ts.Node[] = [];

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === callee.text) {
      matches.push(statement);
      continue;
    }

    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.name.text === callee.text
        && declaration.initializer
        && (
          ts.isArrowFunction(declaration.initializer)
          || ts.isFunctionExpression(declaration.initializer)
        )
      ) {
        matches.push(declaration);
      }
    }
  }

  if (matches.length !== 1) {
    fail(
      `expected one Sonner style-injector declaration for ${callee.text}, found ${matches.length}`,
    );
  }

  const text = matches[0].getText(source);
  const createsStyle = /createElement\s*\(\s*["']style["']\s*\)/.test(text);
  const writesCss = /(?:textContent|cssText|createTextNode|appendChild|insertBefore)/.test(text);
  if (!createsStyle || !writesCss) {
    fail("candidate consumer is not recognizably a runtime style injector");
  }

  return text;
}

function requireStandaloneInjectorCall(
  source: ts.SourceFile,
  call: ts.CallExpression,
): void {
  if (!ts.isExpressionStatement(call.parent)) {
    fail("Sonner style injector is not a standalone expression statement");
  }
  const callee = directIdentifierCallee(call);
  injectorDeclarationText(source, callee);
}

function findIdentifierReferences(
  source: ts.SourceFile,
  declarationName: ts.Identifier,
): ts.Identifier[] {
  const references: ts.Identifier[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isIdentifier(node)
      && node !== declarationName
      && node.text === declarationName.text
    ) {
      references.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return references;
}

function replacementPlan(
  source: ts.SourceFile,
  candidate: CssLiteral,
): Replacement[] {
  const parent = candidate.parent;

  if (ts.isCallExpression(parent) && parent.arguments.includes(candidate)) {
    requireStandaloneInjectorCall(source, parent);
    if (parent.arguments.length !== 1 || parent.arguments[0] !== candidate) {
      fail("Sonner CSS literal is not the complete injector argument");
    }
    return [{
      start: parent.getStart(source),
      end: parent.getEnd(),
      text: "void 0",
    }];
  }

  if (ts.isTaggedTemplateExpression(parent) && parent.template === candidate) {
    if (!ts.isExpressionStatement(parent.parent)) {
      fail("Sonner tagged style injector is not a standalone expression statement");
    }
    if (!ts.isIdentifier(parent.tag)) {
      fail("Sonner tagged style injector is not a direct identifier");
    }
    injectorDeclarationText(source, parent.tag);
    return [{
      start: parent.getStart(source),
      end: parent.getEnd(),
      text: "void 0",
    }];
  }

  if (
    ts.isVariableDeclaration(parent)
    && parent.initializer === candidate
    && ts.isIdentifier(parent.name)
  ) {
    const variableStatement = parent.parent.parent;
    if (
      !ts.isVariableDeclarationList(parent.parent)
      || !ts.isVariableStatement(variableStatement)
      || variableStatement.parent !== source
    ) {
      fail("Sonner CSS binding is not one top-level variable declaration");
    }

    const references = findIdentifierReferences(source, parent.name);
    if (references.length !== 1) {
      fail(
        `expected one use of the Sonner CSS binding, found ${references.length}`,
      );
    }

    const reference = references[0];
    const call = reference.parent;
    if (
      !ts.isCallExpression(call)
      || call.arguments.length !== 1
      || call.arguments[0] !== reference
    ) {
      fail("Sonner CSS binding is not the complete injector argument");
    }
    requireStandaloneInjectorCall(source, call);

    return [
      {
        start: candidate.getStart(source),
        end: candidate.getEnd(),
        text: ts.isNoSubstitutionTemplateLiteral(candidate) ? "``" : '""',
      },
      {
        start: call.getStart(source),
        end: call.getEnd(),
        text: "void 0",
      },
    ];
  }

  fail(
    "Sonner CSS marker is not a complete direct injector value or top-level binding",
  );
}

function applyReplacements(code: string, replacements: Replacement[]): string {
  const ordered = [...replacements].sort((a, b) => b.start - a.start);
  let transformed = code;
  let previousStart = Number.POSITIVE_INFINITY;

  for (const replacement of ordered) {
    if (
      replacement.start < 0
      || replacement.end <= replacement.start
      || replacement.end > code.length
      || replacement.end > previousStart
    ) {
      fail("invalid or overlapping Sonner transform span");
    }
    transformed = `${transformed.slice(0, replacement.start)}${replacement.text}${transformed.slice(replacement.end)}`;
    previousStart = replacement.start;
  }

  return transformed;
}

export function stripSonnerRuntimeStyles(code: string): string {
  const source = parse(code, "sonner/dist/index.mjs");
  const originalParseError = firstParseError(source);
  if (originalParseError) {
    fail(`source Sonner module does not parse: ${originalParseError}`);
  }

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
    fail(`expected one Sonner CSS literal, found ${candidates.length}`);
  }

  const candidate = candidates[0];
  if (count(candidate.text, MARKER) !== count(code, MARKER)) {
    fail("Sonner CSS markers span multiple syntax nodes");
  }

  const transformed = applyReplacements(
    code,
    replacementPlan(source, candidate),
  );

  if (transformed.includes(MARKER)) {
    fail("Sonner runtime CSS remained after transform");
  }
  const parseError = firstParseError(
    parse(transformed, "sonner/dist/index.transformed.mjs"),
  );
  if (parseError) {
    fail(`transformed Sonner module does not parse: ${parseError}`);
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
