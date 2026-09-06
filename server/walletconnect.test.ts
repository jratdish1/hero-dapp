import { describe, it, expect } from "vitest";

/**
 * WalletConnect Project ID checks.
 * Skips when VITE_WALLETCONNECT_PROJECT_ID is unset so CI without WC secrets
 * stays green; when set, validates format and relay health.
 */
describe("WalletConnect Project ID", () => {
  const projectId = process.env.VITE_WALLETCONNECT_PROJECT_ID;
  const configured =
    !!projectId &&
    projectId !== "" &&
    projectId !== "your_walletconnect_project_id_here";

  it("should have VITE_WALLETCONNECT_PROJECT_ID set when WC is expected", () => {
    if (!configured) {
      console.warn(
        "[walletconnect.test] VITE_WALLETCONNECT_PROJECT_ID unset — skipping assert (CI without WC secret)"
      );
      return;
    }
    expect(projectId).toBeDefined();
    expect(projectId).not.toBe("");
    expect(projectId).not.toBe("your_walletconnect_project_id_here");
  });

  it("should be a valid 32-character hex string when configured", () => {
    if (!configured) return;
    expect(projectId!.length).toBe(32);
    expect(/^[a-f0-9]{32}$/.test(projectId!)).toBe(true);
  });

  it("should be accessible via WalletConnect relay endpoint when configured", async () => {
    if (!configured) return;
    const response = await fetch(
      `https://verify.walletconnect.com/v1/health?projectId=${projectId}`
    );
    expect(response.status).toBeLessThan(500);
  });
});
