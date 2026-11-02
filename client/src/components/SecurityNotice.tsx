/**
 * SecurityNotice — site-wide DO-NOT-FUND banner (queue row 216, 2026-10-22).
 * Read-only text. Renders on every route (mounted in App above the router),
 * independent of the selected chain. Dismissal lasts for the browser session
 * only. Addresses are DEFANGED so they cannot be copied into a wallet.
 */
import React, { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  DO_NOT_FUND_LIST,
  SECURITY_NOTICE_TITLE,
  SECURITY_NOTICE_TEXT,
  SECURITY_NOTICE_DEFANG_NOTE,
  SECURITY_NOTICE_DISMISS,
  isNoticeDismissedForSession,
  dismissNoticeForSession,
} from "../lib/securityContainment";

export default function SecurityNotice() {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState<boolean>(() => isNoticeDismissedForSession());
  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Security notice"
      data-testid="security-notice"
      className="relative z-[10000] w-full border-b-4 border-yellow-400 bg-red-800 text-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-wide text-yellow-300">
              ⛔ {t(SECURITY_NOTICE_TITLE)}
            </p>
            <p className="mt-1 text-sm font-semibold">{t(SECURITY_NOTICE_TEXT)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              dismissNoticeForSession();
              setDismissed(true);
            }}
            className="shrink-0 rounded border border-white/60 px-2 py-1 text-xs font-semibold hover:bg-white/10"
          >
            {t(SECURITY_NOTICE_DISMISS)}
          </button>
        </div>
        <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2" data-testid="do-not-fund-list">
          {DO_NOT_FUND_LIST.map((e) => (
            <li key={e.display} className="rounded bg-black/30 px-2 py-1">
              <span className="font-mono font-bold text-yellow-200 select-none">{e.display}</span>{" "}
              <span className="text-white/90">
                {t(e.label)} ({e.chain})
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-white/75">{t(SECURITY_NOTICE_DEFANG_NOTE)}</p>
      </div>
    </div>
  );
}
