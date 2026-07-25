import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DappLoadBoundary, {
  createRootErrorHandlers,
  DappRecoveryView,
  isDappLoadFailure,
  normalizeThrownValue,
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

  it("renders a neutral safe shared recovery view from a captured load error", () => {
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

  it("normalizes falsy and non-Error thrown values in both boundaries", () => {
    for (const thrown of [null, undefined, false, 0, ""]) {
      const normalized = normalizeThrownValue(thrown);
      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message.length).toBeGreaterThan(0);

      const outerState = DappLoadBoundary.getDerivedStateFromError(thrown);
      expect(outerState.hasError).toBe(true);
      expect(outerState.error).toBeInstanceOf(Error);
      const outerBoundary = new DappLoadBoundary({ children: "failing child" });
      outerBoundary.state = outerState;
      expect(renderToStaticMarkup(outerBoundary.render() as ReactElement)).not.toContain(
        "failing child",
      );

      const innerState = ErrorBoundary.getDerivedStateFromError(thrown);
      expect(innerState.hasError).toBe(true);
      expect(innerState.error).toBeInstanceOf(Error);
      const innerBoundary = new ErrorBoundary({ children: "failing route" });
      innerBoundary.state = innerState;
      expect(renderToStaticMarkup(innerBoundary.render() as ReactElement)).not.toContain(
        "failing route",
      );
    }
  });

  it("normalizes values whose JSON and string conversion both throw", () => {
    const hostile = {
      toJSON() {
        throw new Error("toJSON denied");
      },
      toString() {
        throw new Error("toString denied");
      },
      [Symbol.toPrimitive]() {
        throw new Error("primitive conversion denied");
      },
    };

    expect(() => normalizeThrownValue(hostile)).not.toThrow();
    const normalized = normalizeThrownValue(hostile);
    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.message).toContain("[unconvertible value]");

    const outerState = DappLoadBoundary.getDerivedStateFromError(hostile);
    const innerState = ErrorBoundary.getDerivedStateFromError(hostile);
    expect(outerState.hasError).toBe(true);
    expect(innerState.hasError).toBe(true);
  });

  it("sanitizes every actual root handler in production", () => {
    const logger = vi.fn();
    const error = new Error(
      "Failed to fetch https://private-provider.example/internal-endpoint",
    );
    const errorInfo = { componentStack: "at SecretProvider (SecretProvider.tsx:42)" };
    const handlers = createRootErrorHandlers(false, logger);

    handlers.onCaughtError(error, errorInfo);
    handlers.onUncaughtError(error, errorInfo);
    handlers.onRecoverableError(error, errorInfo);

    expect(logger.mock.calls).toEqual([
      ["[React runtime error]"],
      ["[React runtime error]"],
      ["[React runtime error]"],
    ]);
  });

  it("preserves details through every actual root handler in development", () => {
    const logger = vi.fn();
    const error = new Error("development-only detail");
    const errorInfo = { componentStack: "at DevelopmentComponent" };
    const handlers = createRootErrorHandlers(true, logger);

    handlers.onCaughtError(error, errorInfo);
    handlers.onUncaughtError(error, errorInfo);
    handlers.onRecoverableError(error, errorInfo);

    expect(logger).toHaveBeenCalledTimes(3);
    for (const call of logger.mock.calls) {
      expect(call[0]).toBe("[React runtime error]");
      expect(call[1]).toMatchObject({
        error,
        componentStack: errorInfo.componentStack,
      });
    }
  });

  it("passes the tested handler factory directly to createRoot", () => {
    const main = source("main.tsx");
    expect(main).toContain("<DappLoadBoundary>");
    expect(main).toMatch(
      /<DappLoadBoundary>[\s\S]*<Suspense fallback=\{<DappLoader \/>\}>[\s\S]*<DappBootstrap \/>/,
    );
    expect(main).toContain("createRoot(root, createRootErrorHandlers())");
    expect(main).not.toContain("console.error(error");
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
