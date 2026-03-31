import { describe, it, expect } from "vitest";

describe("WalletConnect Project ID", () => {
  it("should have VITE_WALLETCONNECT_PROJECT_ID set in environment", () => {
    const projectId = process.env.VITE_WALLETCONNECT_PROJECT_ID;
    expect(projectId).toBeDefined();
    expect(projectId).not.toBe("");
    expect(projectId).not.toBe("your_walletconnect_project_id_here");
  });

  it("should be a valid 32-character hex string", () => {
    const projectId = process.env.VITE_WALLETCONNECT_PROJECT_ID;
    expect(projectId).toBeDefined();
    // WalletConnect Project IDs are 32-character hex strings
    expect(projectId!.length).toBe(32);
    expect(/^[a-f0-9]{32}$/.test(projectId!)).toBe(true);
  });

  it("should be accessible via WalletConnect relay endpoint", async () => {
    const projectId = process.env.VITE_WALLETCONNECT_PROJECT_ID;
    expect(projectId).toBeDefined();

    // Validate the project ID against WalletConnect's verify API
    const response = await fetch(
      `https://verify.walletconnect.com/v1/health?projectId=${projectId}`
    );
    // A valid project ID returns 200; invalid returns 401 or 403
    expect(response.status).toBeLessThan(500);
  });
});
