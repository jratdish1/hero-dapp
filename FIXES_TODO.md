# Herobase.io Fixes - Batch

## 1. "Launch Boot Camp" → SSS (Single-Sided Staking)
- File: `client/src/pages/Farm.tsx` line 928
- Currently: `<a href={LIVE_DAPP_URLS.farm}>` which goes to trufarms.io/farms
- Fix: Change to `/stake/dai` (the HeroStake page = SSS: Stake HERO → Earn DAI)

## 2. /stake/hero → 404
- File: `client/src/App.tsx`
- Missing redirect: Need `<Route path="/stake/hero"><Redirect to="/stake/dai" /></Route>`

## 3. Transparent backgrounds → solid dark
- File: `client/src/pages/Stake.tsx` line 1042
- Base Chain Staking card: `bg-[#0052FF]/5` is nearly transparent
- Fix: Change to solid `bg-[#0a0c14]` with border

## 4. Flywheel not showing
- File: `client/src/pages/Tokenomics.tsx` line 175
- Uses `CDN_ASSETS.tokenomicsVideo` = `/tokenomics-bg-360p.mp4`
- But actual file is `/tokenomics_video.mp4` (underscore not dash, no "bg-360p")
- Fix: Update CDN_ASSETS in shared/tokens.ts line 414

## 5. Hyperlinks missing (Canamak revenue, buyer, contracts, whitepaper, dashboard)
- File: `client/src/pages/Tokenomics.tsx` lines 98-107
- Whitepaper and Live Dashboard links ARE there and working
- Revenue cards have links where applicable
- Contracts tab has explorer links
- These appear to be working in code - may be a tab navigation issue

## 6. Videos not playing (HERO Ecosystem Explainer + VETS2HERO Music Video)
- File: `client/src/pages/MediaHub.tsx` line 222
- Explainer uses manuscdn URL that may have expired
- Fix: Use the local `/hero-explainer-edited.mp4` which is the same entry video (12MB, exists in public/)
- VETS2HERO music video at line 244 also uses manuscdn - keep as-is (different video)

## 7. Weekly blogs not updating
- File: `client/src/pages/CommunityHub.tsx`
- Blogs are STATIC (hardcoded array WEEKLY_BLOGS)
- No API fetch - this is by design since it's a static frontend
- Fix: Add a note/timestamp and make it clear these are curated posts
- OR: Add RSS/API fetch from X/Twitter for @CrypMvs

## 8. Connect button → Wallet Connect (not admin login)
- File: `client/src/components/AppLayout.tsx` line 351-355
- Currently: `<a href={getLoginUrl()}>` which goes to `/login` (admin auth)
- Fix: Replace with `<WalletButton />` component (already imported at line 7)

## 9. Gas limit update
- Current PulseChain gas is the new normal - update max threshold accordingly
