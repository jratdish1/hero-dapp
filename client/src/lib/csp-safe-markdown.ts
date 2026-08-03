/** Keep Mermaid source readable without activating its runtime SVG style injector. */
export function disableMermaidDiagrams(markdown: string): string {
  return markdown.replace(
    /^([ \t]*)(`{3,}|~{3,})[ \t]*mermaid(?:[ \t]+[^\r\n]*)?[ \t]*$/gim,
    (_match, indentation: string, fence: string) => `${indentation}${fence}text`,
  );
}
