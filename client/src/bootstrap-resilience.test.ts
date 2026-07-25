import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DappLoadBoundary, {
  DappRecoveryView,
  isDappLoadFailure,
  reportReactRuntimeError,
} from "./components/DappLoadBoundary";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
  it("recognizes common lazy-module fetch failures without assuming a deployment", () => {
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

  it("renders a neutral safe recovery screen after a rejected DApp import", () => {
    const error = new Error(
      "Failed to fetch dynamically imported module: /assets/DappBootstrap-old.js",
    );
    const boundary = new DappLoadBoundary({
      children: createElement("div", null, "secure DApp"),
    });
    boundary.state = DappLoadBoundary.getDerivedStateFromError(error);

    const markup = renderToStaticMarkup(boundary.render() as ReactElement);
    expect(markup).toContain("The secure DApp could not load.");
    expect(markup).toContain("offline or the service is temporarily unavailable");
    expect(markup).toContain("Reload secure DApp");
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Return to public home");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("confirm its status in your wallet");
    expect(markup).not.toContain(error.message);
    expect(markup).not.toContain("A fresh application version is ready");
    expect(markup).not.toContain("No wallet or transaction action was submitted");
  });

  it("moves focus to the shared recovery heading when it mounts", () => {
    const view = new DappRecoveryView({ error: new Error("ChunkLoadError") });
    const focus = vi.fn();
    (view as any).headingRef.current = { focus };

    view.componentDidMount();
    expect(focus).toHaveBeenCalledOnce();
  });

  it("routes lazy page chunk failures through the shared recovery view", () => {
    const error = new Error("ChunkLoadError: Loading chunk 84 failed");
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = ErrorBoundary.getDerivedStateFromError(error);

    const markup = renderToStaticMarkup(boundary.render() as ReactElement);
    expect(markup).toContain("HERO DApp recovery");
    expect(markup).toContain("The secure DApp could not load.");
    expect(markup).toContain("Reload secure DApp");
    expect(markup).not.toContain(error.message);
  });

  it("sanitizes React root errors in production and preserves detail in development", () => {
    const logger = vi.fn();
    const error = new Error(
      "Failed to fetch https://private-provider.example/internal-endpoint",
    );
    const errorInfo = { componentStack: "at SecretProvider (SecretProvider.tsx:42)" };

    reportReactRuntimeError(error, errorInfo, false, logger);
    expect(logger.mock.calls).toEqual([["[React runtime error]"]]);

    logger.mockClear();
    reportReactRuntimeError(error, errorInfo, true, logger);
    expect(logger).toHaveBeenCalledOnce();
    expect(logger.mock.calls[0]?.[0]).toBe("[React runtime error]");
    expect(logger.mock.calls[0]?.[1]).toMatchObject({
      error,
      componentStack: errorInfo.componentStack,
    });
  });

  it("wraps the lazy DApp and overrides every React 19 root error logger", () => {
    const main = source("main.tsx");
    expect(main).toContain("<DappLoadBoundary>");
    expect(main).toMatch(
      /<DappLoadBoundary>[\s\S]*<Suspense fallback=\{<DappLoader \/>\}>[\s\S]*<DappBootstrap \/>/,
    );
    expect(main).toContain("onCaughtError(error, errorInfo)");
    expect(main).toContain("onUncaughtError(error, errorInfo)");
    expect(main).toContain("onRecoverableError(error, errorInfo)");
    expect(main.match(/reportReactRuntimeError\(error, errorInfo\)/g)).toHaveLength(3);
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
