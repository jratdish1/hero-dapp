import { describe, expect, it } from "vitest";
import { disableMermaidDiagrams } from "../client/src/lib/csp-safe-markdown";

describe("CSP-safe markdown", () => {
  it("neutralizes backtick and tilde Mermaid fences without changing content", () => {
    expect(disableMermaidDiagrams("```mermaid\ngraph TD; A-->B\n```"))
      .toBe("```text\ngraph TD; A-->B\n```");
    expect(disableMermaidDiagrams("  ~~~~ MERMAID theme=dark\nA-->B\n~~~~"))
      .toBe("  ~~~~text\nA-->B\n~~~~");
  });

  it("leaves non-Mermaid fences and prose unchanged", () => {
    const value = "```typescript\nconst mermaid = true;\n```";
    expect(disableMermaidDiagrams(value)).toBe(value);
  });
});
