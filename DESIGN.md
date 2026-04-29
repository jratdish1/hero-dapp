---
version: "alpha"
name: "HERO Ecosystem — Military HUD"
description: >
  Unified design system for all VetsInCrypto HERO ecosystem projects.
  Inspired by USMC MARPAT Woodland Digital Camouflage and military
  Heads-Up Display (HUD) interfaces. Designed for dark-first crypto
  dashboards, wallets, and DeFi applications.

colors:
  # ── Core MARPAT Palette ──
  primary: "#8B6914"
  primary-light: "#C49B2A"
  on-primary: "#F5F0E0"
  secondary: "#4A6741"
  secondary-light: "#6B8F60"
  on-secondary: "#F5F0E0"
  tertiary: "#1A2035"
  on-tertiary: "#E0E6ED"
  neutral: "#D4C9A0"
  neutral-dark: "#8B8060"

  # ── HUD Signal Colors ──
  hud-green: "#00FF64"
  hud-green-dim: "#00CC50"
  hud-amber: "#FFB020"
  hud-red: "#FF4444"
  hud-cyan: "#00D4FF"
  hud-blue: "#3B82F6"

  # ── Dark Mode Surfaces ──
  bg-deep: "#0A0E17"
  bg-panel: "#0D1220"
  bg-card: "#111827"
  bg-elevated: "#1A2035"
  bg-muted: "#1E2A3A"

  # ── Text Hierarchy ──
  text-primary: "#E0E6ED"
  text-secondary: "#A0AEC0"
  text-muted: "#64748B"
  text-disabled: "#374151"

  # ── Borders & Dividers ──
  border-default: "#1E293B"
  border-accent: "#2D3748"
  border-glow-green: "#1A3D2A"
  border-glow-gold: "#3D3222"

  # ── Chart Palette ──
  chart-1: "#8B6914"
  chart-2: "#4A6741"
  chart-3: "#1A2035"
  chart-4: "#D4C9A0"
  chart-5: "#C49B2A"

typography:
  display:
    fontFamily: "Rajdhani"
    fontSize: "2.5rem"
    fontWeight: 700
    letterSpacing: "0.04em"
    lineHeight: 1.1
  h1:
    fontFamily: "Rajdhani"
    fontSize: "1.75rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    lineHeight: 1.2
  h2:
    fontFamily: "Rajdhani"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "0.06em"
    lineHeight: 1.3
  h3:
    fontFamily: "Rajdhani"
    fontSize: "1rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    lineHeight: 1.4
  body-md:
    fontFamily: "Inter"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Inter"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  mono-data:
    fontFamily: "JetBrains Mono"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
  mono-sm:
    fontFamily: "JetBrains Mono"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  label-caps:
    fontFamily: "Rajdhani"
    fontSize: "0.65rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    lineHeight: 1.2

rounded:
  none: "0px"
  xs: "1px"
  sm: "2px"
  md: "4px"
  lg: "8px"
  pill: "9999px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "64px"

components:
  # ── Buttons ──
  button-primary:
    backgroundColor: "rgba(0, 255, 100, 0.15)"
    textColor: "{colors.hud-green}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label-caps}"
  button-primary-hover:
    backgroundColor: "rgba(0, 255, 100, 0.25)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "rgba(255, 255, 255, 0.05)"
    textColor: "{colors.hud-green}"
  button-gold:
    backgroundColor: "rgba(212, 168, 67, 0.15)"
    textColor: "{colors.primary-light}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-gold-hover:
    backgroundColor: "rgba(212, 168, 67, 0.25)"

  # ── Cards ──
  card-default:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  card-elevated:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "24px"

  # ── Badges ──
  badge-green:
    backgroundColor: "rgba(0, 255, 100, 0.12)"
    textColor: "{colors.hud-green}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
    typography: "{typography.label-caps}"
  badge-amber:
    backgroundColor: "rgba(255, 176, 32, 0.12)"
    textColor: "{colors.hud-amber}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
    typography: "{typography.label-caps}"
  badge-red:
    backgroundColor: "rgba(255, 68, 68, 0.12)"
    textColor: "{colors.hud-red}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
    typography: "{typography.label-caps}"

  # ── Inputs ──
  input-default:
    backgroundColor: "{colors.bg-panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"

  # ── Navigation ──
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "rgba(0, 255, 100, 0.08)"
    textColor: "{colors.hud-green}"

  # ── Table ──
  table-header:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.label-caps}"
    padding: "8px 12px"
  table-row:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.mono-sm}"
    padding: "8px 12px"
  table-row-hover:
    backgroundColor: "rgba(0, 255, 100, 0.04)"
---

## Overview

**HERO Ecosystem Military HUD** — a design system rooted in USMC MARPAT Woodland
Digital Camouflage and military Heads-Up Display aesthetics. The UI evokes a
tactical command center: dark surfaces, precise data typography, and signal-color
status indicators. Every element communicates operational readiness.

This system serves three product surfaces:

| Product | Role | Key Aesthetic |
|---------|------|---------------|
| **herobase.io** | DeFi hub (swap, farm, stake) | MARPAT camo backgrounds, gold CTA accents |
| **HERO Wallet** | Chrome extension wallet | Deep navy panels, green gradient highlights |
| **Mining Dashboard** | Ops monitoring | Full HUD with green scanlines, data-dense grids |

The design philosophy is **"Mission-Critical Clarity"** — information density without
visual noise, status at a glance, and zero ambiguity in interactive elements.

## Colors

The palette draws from two sources: the physical MARPAT Woodland pattern (browns,
greens, navy) and military HUD conventions (electric green, amber warnings, red alerts).

### MARPAT Core

- **Primary (#8B6914):** Coyote Brown — the dominant warm tone from MARPAT. Used for
  brand-level elements, gold CTAs, and premium accents. Conveys authority and heritage.
- **Secondary (#4A6741):** Woodland Green — the organic counterpoint. Used for
  accent surfaces, success states in light mode, and ecosystem/growth indicators.
- **Tertiary (#1A2035):** Dark Navy — the near-black foundation. All dark-mode
  backgrounds derive from this base. It is the "night sky" of the command center.
- **Neutral (#D4C9A0):** Cream — the lightest MARPAT tone. Used for light-mode
  backgrounds and as a warm text color on dark surfaces.

### HUD Signal Colors

These are functional, not decorative. Each has a single semantic meaning:

- **HUD Green (#00FF64):** Active / Online / Positive. The primary interactive
  color in dark mode. All clickable elements, live indicators, and success states.
- **HUD Amber (#FFB020):** Warning / Caution / Pending. Used for alerts that
  require attention but not immediate action.
- **HUD Red (#FF4444):** Critical / Error / Negative. Reserved for destructive
  actions, system failures, and price drops.
- **HUD Cyan (#00D4FF):** Informational / Secondary highlight. Used for links,
  secondary data points, and the HERO Wallet gradient accent.

### Usage Rules

1. Dark surfaces use the `bg-deep` → `bg-elevated` gradient (never pure black).
2. HUD Green is the **only** color for primary interactive elements in dark mode.
3. Gold/Coyote Brown is reserved for premium CTAs and brand moments.
4. Never use more than two signal colors in the same component.
5. Text on dark backgrounds must be `text-primary` (#E0E6ED) or brighter.

## Typography

Three font families serve distinct roles. No font is interchangeable.

### Rajdhani — Command Headers

The angular, semi-condensed geometry of Rajdhani evokes stenciled military
markings. Used exclusively for headings, labels, and navigation items.
Always uppercase with letter-spacing for labels (`0.08em`).

### Inter — Body Content

Clean, neutral, and highly legible at small sizes. Used for paragraphs,
descriptions, form labels, and any prose content. Never used for data.

### JetBrains Mono — Data & Numbers

Tabular numerals (`tnum`) ensure columns align perfectly. Used for prices,
percentages, addresses, timestamps, and any numerical display. The monospace
rhythm reinforces the "terminal readout" aesthetic.

### Hierarchy Rules

| Level | Font | Weight | Size | Use Case |
|-------|------|--------|------|----------|
| Display | Rajdhani | 700 | 2.5rem | Hero sections, splash screens |
| H1 | Rajdhani | 700 | 1.75rem | Page titles |
| H2 | Rajdhani | 600 | 1.25rem | Section headers |
| H3 | Rajdhani | 600 | 1rem | Card titles, subsections |
| Body | Inter | 400 | 0.875rem | Paragraphs, descriptions |
| Body SM | Inter | 400 | 0.75rem | Captions, metadata |
| Data | JetBrains Mono | 500 | 0.875rem | Prices, balances, stats |
| Data SM | JetBrains Mono | 400 | 0.75rem | Table cells, timestamps |
| Label | Rajdhani | 600 | 0.65rem | Badges, tab labels, column headers |

## Layout & Spacing

The layout system follows a **military grid** — rigid, aligned, no wasted space.

### Spacing Scale

The scale is based on an 8px unit. Every margin, padding, and gap should
use a value from this scale to maintain visual rhythm:

`4px → 8px → 16px → 24px → 32px → 48px → 64px`

### Layout Principles

1. **Sidebar-first navigation** for dashboards and tools. Never centered layouts.
2. **Data density over whitespace** — this is a command center, not a marketing page.
3. **Grid alignment** — all cards, tables, and panels snap to a consistent column grid.
4. **Responsive breakpoints:** 640px (mobile), 768px (tablet), 1024px (desktop), 1280px (wide).
5. **Mobile:** Stack vertically, collapse sidebar to bottom tab bar, maintain data legibility.

## Elevation & Depth

Depth is communicated through **surface color stepping**, not drop shadows.
The dark palette has five elevation levels:

| Level | Color | Use |
|-------|-------|-----|
| 0 (Base) | `#0A0E17` | Page background |
| 1 (Panel) | `#0D1220` | Sidebar, header |
| 2 (Card) | `#111827` | Content cards |
| 3 (Elevated) | `#1A2035` | Modals, popovers |
| 4 (Muted) | `#1E2A3A` | Hover states, active rows |

### Glow Effects

Instead of shadows, interactive elements use **color glow**:

- Green glow: `box-shadow: 0 0 12px rgba(0, 255, 100, 0.15)` — active/focused inputs
- Gold glow: `box-shadow: 0 0 30px rgba(212, 168, 67, 0.2)` — premium/brand elements
- Pulse animations on live indicators (green dot, status badges)

## Shapes

Corners are **sharp by default**. This is a military interface, not a consumer app.

- `none (0px)` — Default for most elements
- `xs (1px)` — Badges, inline tags
- `sm (2px)` — Buttons, inputs, cards
- `md (4px)` — Modals, dropdown menus
- `lg (8px)` — Only for herobase.io light-mode cards (MARPAT theme)
- `pill (9999px)` — Chain selector pills, toggle switches only

### Border Rules

1. Borders are `1px solid` with low-opacity colors (never solid white/gray).
2. Accent borders use green or gold glow variants.
3. Table row separators use `border-default` (#1E293B).
4. Card borders are optional — prefer elevation stepping instead.

## Components

### Buttons

Three tiers: **Primary** (green glow), **Gold** (premium CTA), **Ghost** (text-only).
All buttons use `label-caps` typography (Rajdhani, uppercase, 0.08em tracking).
Hover states increase background opacity. Active states scale to 0.96.
Disabled buttons drop to 40% opacity with `cursor: not-allowed`.

### Cards

Flat surfaces at elevation level 2 or 3. No drop shadows. Optional 1px
border in `border-default`. Content padding is 16px (default) or 24px (elevated).
Card titles use H3 (Rajdhani 600). Card data uses JetBrains Mono.

### Badges

Inline status indicators. Four variants: green (active/online), amber (warning),
red (critical), cyan (info). Background is the signal color at 12% opacity.
Text is the signal color at full brightness. Always use `label-caps` typography.

### Tables

Full-width, no cell borders. Header row uses `label-caps` in `text-muted`.
Data rows use `mono-sm`. Row hover highlights with green at 4% opacity.
Alternating row colors are **not used** — the HUD aesthetic prefers uniform surfaces.

### Navigation

Sidebar navigation for desktop. Bottom tab bar for mobile.
Active items get green text + green background at 8% opacity.
Inactive items use `text-muted`. Icons are 20px, stroke-based (Lucide).

## Do's and Don'ts

### Do

- Use MARPAT camo background image for hero sections and headers on herobase.io
- Use green glow for all interactive focus states
- Use JetBrains Mono for ANY number display (prices, percentages, counts)
- Use Rajdhani uppercase for ALL labels and navigation items
- Maintain the 5-level elevation system for depth
- Use signal colors semantically (green=good, amber=caution, red=bad)
- Include a pulsing green dot for "LIVE" indicators

### Don't

- Don't use rounded corners larger than 8px (this isn't a consumer app)
- Don't use drop shadows (use surface elevation and glow instead)
- Don't use Inter for headings or JetBrains Mono for prose
- Don't use more than 2 signal colors in one component
- Don't use pure black (#000000) — always use `bg-deep` (#0A0E17)
- Don't use pure white (#FFFFFF) — always use `text-primary` (#E0E6ED)
- Don't center-align dashboard layouts (sidebar-first always)
- Don't use gradients except for the HERO brand text gradient (`#00FF64 → #00D4FF`)
