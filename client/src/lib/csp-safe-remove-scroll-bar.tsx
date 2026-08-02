import { useEffect, useMemo } from "react";
import type { FC } from "react";

export type GapMode = "padding" | "margin";

export interface GapOffset {
  left: number;
  top: number;
  right: number;
  gap: number;
}

export interface BodyScroll {
  noRelative?: boolean;
  noImportant?: boolean;
  gapMode?: GapMode;
}

export const zeroRightClassName = "right-scroll-bar-position";
export const fullWidthClassName = "width-before-scroll-bar";
export const noScrollbarsClassName = "with-scroll-bars-hidden";
export const removedBarSizeVariable = "--removed-body-scroll-bar-size";
export const lockAttribute = "data-scroll-locked";

const gapModeAttribute = "data-vets-scroll-lock-gap-mode";
const relativeAttribute = "data-vets-scroll-lock-relative";
const importantAttribute = "data-vets-scroll-lock-important";
const gapVariable = "--vets-scroll-lock-gap";
const leftVariable = "--vets-scroll-lock-left";
const topVariable = "--vets-scroll-lock-top";
const rightVariable = "--vets-scroll-lock-right";

const managedAttributes = [
  lockAttribute,
  gapModeAttribute,
  relativeAttribute,
  importantAttribute,
] as const;

const managedProperties = [
  removedBarSizeVariable,
  gapVariable,
  leftVariable,
  topVariable,
  rightVariable,
] as const;

type BodySnapshot = {
  attributes: Map<string, string | null>;
  properties: Map<string, string>;
};

let activeLocks = 0;
let firstLockSnapshot: BodySnapshot | null = null;

export const zeroGap: GapOffset = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0,
};

function parsePixel(value: string): number {
  return Number.parseInt(value || "", 10) || 0;
}

export function getGapWidth(gapMode: GapMode = "margin"): GapOffset {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return zeroGap;
  }

  const style = window.getComputedStyle(document.body);
  const left = parsePixel(
    gapMode === "padding" ? style.paddingLeft : style.marginLeft,
  );
  const top = parsePixel(
    gapMode === "padding" ? style.paddingTop : style.marginTop,
  );
  const right = parsePixel(
    gapMode === "padding" ? style.paddingRight : style.marginRight,
  );

  return {
    left,
    top,
    right,
    gap: Math.max(
      0,
      window.innerWidth
        - document.documentElement.clientWidth
        + right
        - left,
    ),
  };
}

function currentUseCounter(): number {
  const value = Number.parseInt(
    document.body.getAttribute(lockAttribute) || "0",
    10,
  );
  return Number.isFinite(value) ? value : 0;
}

function captureBodySnapshot(): BodySnapshot {
  return {
    attributes: new Map(
      managedAttributes.map(name => [name, document.body.getAttribute(name)]),
    ),
    properties: new Map(
      managedProperties.map(name => [
        name,
        document.body.style.getPropertyValue(name),
      ]),
    ),
  };
}

function restoreBodySnapshot(snapshot: BodySnapshot): void {
  for (const [name, value] of snapshot.attributes) {
    if (value === null) document.body.removeAttribute(name);
    else document.body.setAttribute(name, value);
  }

  for (const [name, value] of snapshot.properties) {
    if (value) document.body.style.setProperty(name, value);
    else document.body.style.removeProperty(name);
  }
}

function applyFirstLock(
  gap: GapOffset,
  gapMode: GapMode,
  allowRelative: boolean,
  important: boolean,
): void {
  firstLockSnapshot = captureBodySnapshot();
  document.body.setAttribute(gapModeAttribute, gapMode);
  document.body.setAttribute(relativeAttribute, String(allowRelative));
  document.body.setAttribute(importantAttribute, String(important));
  document.body.style.setProperty(removedBarSizeVariable, `${gap.gap}px`);
  document.body.style.setProperty(gapVariable, `${gap.gap}px`);
  document.body.style.setProperty(leftVariable, `${gap.left}px`);
  document.body.style.setProperty(topVariable, `${gap.top}px`);
  document.body.style.setProperty(rightVariable, `${gap.right}px`);
}

function acquireLock(
  gap: GapOffset,
  gapMode: GapMode,
  allowRelative: boolean,
  important: boolean,
): () => void {
  if (activeLocks === 0) {
    applyFirstLock(gap, gapMode, allowRelative, important);
  }

  activeLocks += 1;
  document.body.setAttribute(
    lockAttribute,
    String(currentUseCounter() + 1),
  );

  let released = false;
  return () => {
    if (released) return;
    released = true;

    activeLocks = Math.max(0, activeLocks - 1);
    const nextCounter = currentUseCounter() - 1;
    if (nextCounter > 0) {
      document.body.setAttribute(lockAttribute, String(nextCounter));
    } else {
      document.body.removeAttribute(lockAttribute);
    }

    if (activeLocks === 0 && firstLockSnapshot) {
      restoreBodySnapshot(firstLockSnapshot);
      firstLockSnapshot = null;
    }
  };
}

export function useLockAttribute(): void {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.setAttribute(
      lockAttribute,
      String(currentUseCounter() + 1),
    );

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const nextCounter = currentUseCounter() - 1;
      if (nextCounter > 0) {
        document.body.setAttribute(lockAttribute, String(nextCounter));
      } else {
        document.body.removeAttribute(lockAttribute);
      }
    };
  }, []);
}

/**
 * CSP-safe, API-compatible replacement for react-remove-scroll-bar.
 *
 * The upstream package injects a runtime <style> element through
 * react-style-singleton. This implementation keeps every selector in the
 * self-hosted recovery stylesheet and writes only measured CSS custom
 * properties to the body style attribute, which remains inside the explicitly
 * tracked transitional style-src-attr boundary.
 */
export const RemoveScrollBar: FC<BodyScroll> = ({
  noRelative = false,
  noImportant = false,
  gapMode = "margin",
}) => {
  const gap = useMemo(() => getGapWidth(gapMode), [gapMode]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    return acquireLock(gap, gapMode, !noRelative, !noImportant);
  }, [gap, gapMode, noImportant, noRelative]);

  return null;
};
