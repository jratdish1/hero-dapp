import { HERO_INCIDENT_MAINTENANCE, HERO_INCIDENT_MESSAGE } from "../lib/incident-flags";

/**
 * Site-wide incident maintenance banner (DApp layout and public landing page).
 *
 * Uses role="status" (polite live region), not role="alert": page-level alerts
 * such as the swap-intent "Chain changed after review" message must remain the
 * only role="alert" elements so assistive tech and tests find the right one.
 * It is in normal document flow, so it does not overlay or intercept clicks.
 */
export default function IncidentBanner() {
  if (!HERO_INCIDENT_MAINTENANCE) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Maintenance notice"
      data-testid="hero-incident-banner"
      className="w-full bg-amber-500/15 border-b border-amber-500/40 text-amber-200 text-sm px-4 py-2 text-center"
    >
      {HERO_INCIDENT_MESSAGE}
    </div>
  );
}
