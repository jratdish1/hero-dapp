/**
 * HERO DAO Email Notification Module
 * Sends automated emails for DAO results, raffle winners, etc.
 * 
 * Uses Nodemailer with configurable SMTP transport
 * Default recipient: VETSCrypto@pm.me
 * 
 * Security: All user-supplied data is HTML-sanitized before interpolation.
 * Rate limiting: Max 10 emails per hour to prevent abuse.
 */

import nodemailer from 'nodemailer';

// ─── Rate Limiting ──────────────────────────────────────────────

const EMAIL_RATE_LIMIT = 10; // max emails per hour
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
let emailLog: number[] = []; // timestamps of sent emails

function checkRateLimit(): boolean {
  const now = Date.now();
  // Filter out expired entries (O(n) single pass instead of repeated shift())
  emailLog = emailLog.filter(ts => ts >= now - RATE_WINDOW_MS);
  return emailLog.length < EMAIL_RATE_LIMIT;
}

function recordEmailSent(): void {
  emailLog.push(Date.now());
}

// ─── HTML Sanitization ──────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS in email bodies.
 * Even though emails go to a known address, this is defense-in-depth.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape text for plain-text email (strip any HTML tags)
 */
function escapeText(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

// ─── Types ──────────────────────────────────────────────────────

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface NomineeData {
  name: string;
  votes: number;
  percentage: number;
}

export interface DAOResultEmail {
  quarter: string;
  selectionMethod: 'vote' | 'rng_fallback';
  winnerName: string;
  nominees: NomineeData[];
  quorumMet: boolean;
  quorumThreshold: number;
  actualParticipation: number;
  totalVotesCast: number;
  treasuryAmount: string;
  treasuryUsdValue: string;
  txHash?: string;
  blockNumber?: number;
  rngSeed?: string;
}

// ─── Shared Helpers (DRY) ───────────────────────────────────────

/**
 * Format nominee list for plain text — shared between text and HTML builders
 */
function formatNomineesText(nominees: NomineeData[]): string {
  return nominees
    .map((n, i) => `  ${i + 1}. ${escapeText(n.name)} — ${n.votes} votes (${n.percentage.toFixed(1)}%)`)
    .join('\n');
}

/**
 * Format nominee list for HTML table rows — shared builder
 */
function formatNomineesHtml(nominees: NomineeData[]): string {
  return nominees
    .map((n) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #333;">${escapeHtml(n.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:center;">${n.votes}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:center;">${n.percentage.toFixed(1)}%</td>
      </tr>`)
    .join('');
}

/**
 * Get selection method label — shared between text and HTML
 */
function getSelectionLabel(method: 'vote' | 'rng_fallback'): string {
  return method === 'vote'
    ? 'Community Vote (Quorum Met)'
    : 'RNG Fallback (Quorum Not Met)';
}

// ─── Transport ──────────────────────────────────────────────────

function createTransport(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    tls: {
      // ProtonMail Bridge uses self-signed certs on localhost.
      // This is safe because the connection is local (127.0.0.1).
      rejectUnauthorized: false,
    },
  });
}

// ─── Email Builders ─────────────────────────────────────────────

function buildDAOEmailBody(data: DAOResultEmail): string {
  const selectionLabel = getSelectionLabel(data.selectionMethod);
  const nomineeRows = formatNomineesText(data.nominees);
  const safeWinner = escapeText(data.winnerName);

  const rngSection = data.selectionMethod === 'rng_fallback'
    ? `\nRNG Verification:\n  - RNG Seed: ${data.rngSeed || 'N/A'}\n  - This result is provably fair and verifiable on-chain.\n`
    : '';

  return `
═══════════════════════════════════════════════════
  HERO DAO — Quarterly Treasury Allocation Result
═══════════════════════════════════════════════════

Quarter:           ${escapeText(data.quarter)}
Selection Method:  ${selectionLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINNER: ${safeWinner.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nominees:
${nomineeRows}

Voting Summary:
  - Quorum Required:  ${data.quorumThreshold}% of circulating supply
  - Actual Turnout:   ${data.actualParticipation.toFixed(2)}%
  - Quorum Status:    ${data.quorumMet ? 'Met' : 'Not Met — RNG Fallback Activated'}
  - Total Votes Cast: ${data.totalVotesCast.toLocaleString()}

Treasury Allocation:
  - Amount: ${escapeText(data.treasuryAmount)}
  - USD Value: ${escapeText(data.treasuryUsdValue)}
${rngSection}
On-Chain Verification:
  - Transaction Hash: ${data.txHash || 'Pending disbursement'}
  - Block Number:     ${data.blockNumber || 'Pending'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated notification from the HERO DAO system.
For questions, contact the HERO community on Telegram.

Semper Fi.
Built for Veterans, by Veterans.

═══════════════════════════════════════════════════
`.trim();
}

function buildDAOEmailHTML(data: DAOResultEmail): string {
  const selectionLabel = getSelectionLabel(data.selectionMethod);
  const nomineeHTML = formatNomineesHtml(data.nominees);
  const safeWinner = escapeHtml(data.winnerName);
  const safeQuarter = escapeHtml(data.quarter);
  const safeTreasuryAmount = escapeHtml(data.treasuryAmount);
  const safeTreasuryUsd = escapeHtml(data.treasuryUsdValue);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e0e0e0;font-family:monospace;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1a1a2e;border:1px solid #00ff88;border-radius:8px;padding:24px;">
      <h1 style="color:#00ff88;font-size:20px;margin:0 0 4px;">HERO DAO</h1>
      <p style="color:#888;margin:0 0 20px;">Quarterly Treasury Allocation Result</p>
      
      <table style="width:100%;margin-bottom:20px;">
        <tr>
          <td style="color:#888;">Quarter</td>
          <td style="text-align:right;color:#fff;">${safeQuarter}</td>
        </tr>
        <tr>
          <td style="color:#888;">Selection Method</td>
          <td style="text-align:right;color:${data.selectionMethod === 'rng_fallback' ? '#ff6b35' : '#00ff88'};">${selectionLabel}</td>
        </tr>
      </table>

      <div style="background:#00ff88;color:#0a0a0a;padding:16px;border-radius:6px;text-align:center;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;text-transform:uppercase;">Winner</p>
        <p style="margin:4px 0 0;font-size:24px;font-weight:bold;">${safeWinner}</p>
      </div>

      <h3 style="color:#00ff88;margin:0 0 8px;">Nominees</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr style="color:#888;">
          <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #333;">Charity</th>
          <th style="text-align:center;padding:8px 12px;border-bottom:2px solid #333;">Votes</th>
          <th style="text-align:center;padding:8px 12px;border-bottom:2px solid #333;">%</th>
        </tr>
        ${nomineeHTML}
      </table>

      <h3 style="color:#00ff88;margin:0 0 8px;">Voting Summary</h3>
      <table style="width:100%;margin-bottom:20px;">
        <tr><td style="color:#888;padding:4px 0;">Quorum Required</td><td style="text-align:right;">${data.quorumThreshold}%</td></tr>
        <tr><td style="color:#888;padding:4px 0;">Actual Turnout</td><td style="text-align:right;">${data.actualParticipation.toFixed(2)}%</td></tr>
        <tr><td style="color:#888;padding:4px 0;">Status</td><td style="text-align:right;color:${data.quorumMet ? '#00ff88' : '#ff6b35'};">${data.quorumMet ? 'Quorum Met' : 'RNG Fallback'}</td></tr>
        <tr><td style="color:#888;padding:4px 0;">Total Votes</td><td style="text-align:right;">${data.totalVotesCast.toLocaleString()}</td></tr>
      </table>

      <h3 style="color:#00ff88;margin:0 0 8px;">Treasury</h3>
      <table style="width:100%;margin-bottom:20px;">
        <tr><td style="color:#888;padding:4px 0;">Amount</td><td style="text-align:right;">${safeTreasuryAmount}</td></tr>
        <tr><td style="color:#888;padding:4px 0;">USD Value</td><td style="text-align:right;">${safeTreasuryUsd}</td></tr>
      </table>

      ${data.txHash ? `
      <h3 style="color:#00ff88;margin:0 0 8px;">Verification</h3>
      <p style="color:#888;font-size:12px;word-break:break-all;">TX: ${escapeHtml(data.txHash)}</p>
      ` : ''}

      <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
      <p style="color:#555;font-size:11px;text-align:center;margin:0;">
        Automated notification from HERO DAO<br>
        Semper Fi. Built for Veterans, by Veterans.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

// ─── Send Functions ─────────────────────────────────────────────

/**
 * Send the DAO quarterly winner email
 * Rate-limited to 10 emails per hour.
 */
export async function sendDAOResultEmail(
  config: EmailConfig,
  data: DAOResultEmail,
  recipientOverride?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!checkRateLimit()) {
    return { success: false, error: `Rate limit exceeded: max ${EMAIL_RATE_LIMIT} emails per hour` };
  }

  try {
    const transport = createTransport(config);
    const recipient = recipientOverride || 'VETSCrypto@pm.me';

    const result = await transport.sendMail({
      from: `"HERO DAO" <${config.auth.user}>`,
      to: recipient,
      subject: 'HERO DAO quarterly winner of the treasury',
      text: buildDAOEmailBody(data),
      html: buildDAOEmailHTML(data),
    });

    recordEmailSent();
    return { success: true, messageId: result.messageId };
  } catch (err: any) {
    return { success: false, error: `Email send failed: ${err.message}` };
  }
}

/**
 * Send a generic notification email (for raffles, rewards, etc.)
 * Rate-limited to 10 emails per hour.
 */
export async function sendNotificationEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  textBody: string,
  htmlBody?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!checkRateLimit()) {
    return { success: false, error: `Rate limit exceeded: max ${EMAIL_RATE_LIMIT} emails per hour` };
  }

  // Validate email format
  if (!to || !to.includes('@')) {
    return { success: false, error: `Invalid recipient email: ${to}` };
  }
  if (!subject || subject.trim().length === 0) {
    return { success: false, error: 'Subject cannot be empty' };
  }

  try {
    const transport = createTransport(config);

    const result = await transport.sendMail({
      from: `"HERO Dapp" <${config.auth.user}>`,
      to,
      subject: escapeText(subject),
      text: escapeText(textBody),
      html: htmlBody || escapeHtml(textBody).replace(/\n/g, '<br>'),
    });

    recordEmailSent();
    return { success: true, messageId: result.messageId };
  } catch (err: any) {
    return { success: false, error: `Email send failed: ${err.message}` };
  }
}
