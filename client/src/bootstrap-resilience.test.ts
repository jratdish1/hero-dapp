import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DappLoadBoundary, {
  isDappLoadFailure,
} from "./components/DappLoadBoundary";
import { applyPageSEO } from "./hooks/usePageSEO";

const source = (relativePath: string) =>
  readFileSync(resolve(import.meta.dirname, relativePath), "utf8");

class FakeMetadataElement {
  private readonly attributes = new Map<string, string>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}

function createMetadataDocument() {
  const selectors = [
    "meta[name=description]",
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:url"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    "link[rel=canonical]",
  ];
  const elements = new Map(
    selectors.map((selector) => [selector, new FakeMetadataElement()]),
  );
  const fakeDocument = {
    title: "",
    querySelector(selector: string) {
      return elements.get(selector) ?? null;
    },
  } as unknown as Document;

  return { fakeDocument, elements };
}

describe("public bootstrap resilience", () => {
  it("recognizes common stale dynamic-import failures", () => {
    expect(
      isDappLoadFailure(
        new Error(
          "Failed to fetch dynamically imported module: /assets/DappBootstrap-old.js",
        ),
      ),
    ).toBe(true);
    expect(
      isDappLoadFailure(new Error("ChunkLoadError: Loading chunk 42 failed")),
    ).toBe(true);
    expect(isDappLoadFailure(new Error("ordinary render failure"))).toBe(false);
  });

  it("renders a safe recovery screen after a rejected DApp import", () => {
    const error = new Error(
      "Failed to fetch dynamically imported module: /assets/DappBootstrap-old.js",
    );
    const boundary = new DappLoadBoundary({
      children: createElement("div", null, "secure DApp"),
    });
    boundary.state = DappLoadBoundary.getDerivedStateFromError(error);

    const markup = renderToStaticMarkup(boundary.render() as ReactElement);
    expect(markup).toContain("A fresh application version is ready.");
    expect(markup).toContain("Reload secure DApp");
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Return to public home");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("confirm its status in your wallet");
    expect(markup).not.toContain(error.message);
    expect(markup).not.toContain("No wallet or transaction action was submitted");
  });

  it("moves focus to the recovery heading when the fallback activates", () => {
    const boundary = new DappLoadBoundary({ children: null });
    const focus = vi.fn();
    (boundary as any).headingRef.current = { focus };
    boundary.state = { error: new Error("ChunkLoadError") };

    boundary.componentDidUpdate({ children: null }, { error: null });
    expect(focus).toHaveBeenCalledOnce();
  });

  it("wraps the lazy DApp bootstrap in its external load boundary", () => {
    const main = source("main.tsx");
    expect(main).toContain("<DappLoadBoundary>");
    expect(main).toMatch(
      /<DappLoadBoundary>[\s\S]*<Suspense fallback=\{<DappLoader \/>\}>[\s\S]*<DappBootstrap \/>/,
    );
  });

  it("restores all root metadata after client navigation from a DApp route", () => {
    const { fakeDocument, elements } = createMetadataDocument();

    applyPageSEO("/swap", fakeDocument);
    expect(fakeDocument.title).toContain("Swap");
    expect(elements.get('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://herobase.io/swap",
    );

    applyPageSEO("/", fakeDocument);
    expect(fakeDocument.title).toBe(
      "HERO Dapp — PulseChain & BASE DApp | Trade $HERO & $VETS",
    );
    expect(elements.get("meta[name=description]")?.getAttribute("content")).toContain(
      "Built for veterans, by veterans.",
    );
    expect(elements.get('meta[property="og:title"]')?.getAttribute("content")).toBe(
      fakeDocument.title,
    );
    expect(elements.get('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://herobase.io",
    );
    expect(elements.get("link[rel=canonical]")?.getAttribute("href")).toBe(
      "https://herobase.io/",
    );
  });

  it("keeps the SEO hook active in the lightweight landing application", () => {
    const landing = source("LandingApp.tsx");
    expect(landing).toContain(
      'import { usePageSEO } from "./hooks/usePageSEO";',
    );
    expect(landing).toContain("usePageSEO();");
  });
});
