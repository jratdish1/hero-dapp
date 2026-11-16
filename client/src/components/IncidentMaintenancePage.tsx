import { Link, useLocation } from "wouter";
import { HERO_COMING_SOON_MESSAGE, HERO_INCIDENT_MAINTENANCE, HERO_INCIDENT_MESSAGE } from "../lib/incident-flags";

/**
 * Rendered instead of any wallet-write feature (staking, spin, DAO, mint,
 * DCA/limits, approvals, wallet send/bridge, bots, burn, rewards, giveaways)
 * while HERO_INCIDENT_MAINTENANCE is on. Contains no wallet
 * write, sign, or approve action.
 */
export default function IncidentMaintenancePage({
  feature,
  variant = "maintenance",
}: {
  feature?: string;
  /** "coming-soon": DAO / single-sided staking / swap placeholders until v3 contracts deploy. */
  variant?: "maintenance" | "coming-soon";
}) {
  // data-route ties this render to the route it was mounted for, so the CI
  // incident gate can prove it is inspecting that route's own fresh render.
  const [location] = useLocation();
  return (
    <div
      data-testid="hero-incident-route-paused"
      data-route={location}
      data-variant={variant}
      className="max-w-2xl mx-auto mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center"
    >
      {feature && <p className="text-sm font-semibold tracking-wide text-amber-200/80 mb-1">{feature}</p>}
      {variant === "coming-soon" ? (
        <>
          <h1 className="text-2xl font-bold text-amber-300 mb-3">Coming Soon</h1>
          <p className="text-sm text-amber-100/90 mb-4">
            {feature ?? "This feature"} {HERO_COMING_SOON_MESSAGE}
          </p>
          {HERO_INCIDENT_MAINTENANCE && <p className="text-xs text-amber-200/80 mb-6">{HERO_INCIDENT_MESSAGE}</p>}
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-amber-300 mb-3">Paused for Maintenance</h1>
          <p className="text-sm text-amber-100/90 mb-4">
            This feature is paused for maintenance. No wallet transactions, approvals, or signatures can be made here right now.
          </p>
          <p className="text-xs text-amber-200/80 mb-6">{HERO_INCIDENT_MESSAGE}</p>
        </>
      )}
      <Link href="/" className="text-sm text-amber-300 underline hover:text-amber-200">
        Back to Home
      </Link>
    </div>
  );
}
