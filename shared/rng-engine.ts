/**
 * Shared RNG Engine re-export — bridges the server/lib/rng-engine for modules
 * that import from '../shared/rng-engine' (e.g., spin-engine.ts, raffle-engine.ts)
 */
export { generateRandom, selectMultipleWinners, type RNGResult } from '../server/lib/rng-engine';
