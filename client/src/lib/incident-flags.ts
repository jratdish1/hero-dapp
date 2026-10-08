/**
 * Incident kill-switch (2026-10-07, HERO signer compromise).
 *
 * The HeroCards owner key and the HeroABLE signer key (0x5F1D…7Dba) are
 * compromised. Until contract ownership is rotated or migrated, the frontend
 * must not start any value-moving flow that touches HeroCards or HeroABLE.
 *
 * Default is ON (maintenance). Set VITE_HERO_INCIDENT_MAINTENANCE="false"
 * at build time only after the owner confirms rotation on-chain.
 */
export const HERO_INCIDENT_MAINTENANCE: boolean =
  (import.meta.env.VITE_HERO_INCIDENT_MAINTENANCE ?? "true") !== "false";

export const HERO_INCIDENT_MESSAGE =
  "Maintenance: HERO Cards minting and HeroABLE-related actions are paused while we rotate contract keys. " +
  "Your funds are not affected by viewing this site. Do not send funds to any HERO Cards or HeroABLE contract until this notice is removed.";
