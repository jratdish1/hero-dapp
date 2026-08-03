/** Keep Mermaid source readable without activating its runtime SVG style injector. */
export function disableMermaidDiagrams(markdown: string): string {
  return markdown.replace(
    /^(\s*)(`{3,}|~{3,})\s*mermaid(?:\s+[^\r\n]*)?\s*$/gim,
    (_match, indentation: string, fence: string) => `${indentation}${fence}text`,
  );
}
