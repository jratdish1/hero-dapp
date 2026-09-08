import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  copyTextToClipboard,
  sanitizeEnsAvatar,
} from "../client/src/lib/walletSecurity";

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET SECURITY TESTS — ENS Avatar Sanitization & Clipboard Fallback
// ═══════════════════════════════════════════════════════════════════════════════
// These tests validate the security measures added to WalletButton.tsx:
// 1. ENS avatar URL sanitization (prevents XSS via malicious URIs)
// 2. Clipboard API fallback (ensures copy works on all browsers)
// ═══════════════════════════════════════════════════════════════════════════════

describe("ENS Avatar URL Sanitization", () => {
  describe("Valid URLs (should pass through)", () => {
    it("allows HTTPS avatar URLs", () => {
      const url = "https://metadata.ens.domains/mainnet/avatar/vitalik.eth";
      expect(sanitizeEnsAvatar(url)).toBe(url);
    });

    it("allows HTTP avatar URLs", () => {
      const url = "http://example.com/avatar.png";
      expect(sanitizeEnsAvatar(url)).toBe(url);
    });

    it("allows HTTPS URLs with complex paths", () => {
      const url = "https://cdn.stamp.fyi/avatar/eth:0x1234567890abcdef?s=128";
      expect(sanitizeEnsAvatar(url)).toBe(url);
    });

    it("allows IPFS gateway URLs", () => {
      const url = "https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      expect(sanitizeEnsAvatar(url)).toBe(url);
    });
  });

  describe("Malicious URLs (should be blocked)", () => {
    it("blocks javascript: protocol (XSS vector)", () => {
      expect(sanitizeEnsAvatar("javascript:alert('xss')")).toBeUndefined();
    });

    it("blocks javascript: with URL encoding", () => {
      expect(sanitizeEnsAvatar("javascript:alert%28%27xss%27%29")).toBeUndefined();
    });

    it("blocks data: protocol (potential XSS via SVG)", () => {
      expect(sanitizeEnsAvatar("data:image/svg+xml,<svg onload=alert(1)>")).toBeUndefined();
    });

    it("blocks data: protocol with base64", () => {
      expect(sanitizeEnsAvatar("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBeUndefined();
    });

    it("blocks vbscript: protocol", () => {
      expect(sanitizeEnsAvatar("vbscript:MsgBox('xss')")).toBeUndefined();
    });

    it("blocks file: protocol", () => {
      expect(sanitizeEnsAvatar("file:///etc/passwd")).toBeUndefined();
    });

    it("blocks ftp: protocol", () => {
      expect(sanitizeEnsAvatar("ftp://evil.com/malware.exe")).toBeUndefined();
    });

    it("blocks blob: protocol", () => {
      expect(sanitizeEnsAvatar("blob:https://evil.com/uuid")).toBeUndefined();
    });
  });

  describe("Edge cases", () => {
    it("returns undefined for null/undefined input", () => {
      expect(sanitizeEnsAvatar(undefined)).toBeUndefined();
      expect(sanitizeEnsAvatar("")).toBeUndefined();
    });

    it("returns undefined for malformed URLs", () => {
      expect(sanitizeEnsAvatar("not-a-url")).toBeUndefined();
      expect(sanitizeEnsAvatar("://missing-protocol")).toBeUndefined();
    });

    it("returns undefined for protocol-relative URLs", () => {
      // These throw in new URL() without a base
      expect(sanitizeEnsAvatar("//evil.com/avatar.png")).toBeUndefined();
    });

    it("handles URLs with special characters safely", () => {
      const url = "https://example.com/avatar?name=test&size=128#fragment";
      expect(sanitizeEnsAvatar(url)).toBe(url);
    });

    it("handles extremely long URLs", () => {
      const url = "https://example.com/" + "a".repeat(10000);
      expect(sanitizeEnsAvatar(url)).toBe(url);
    });
  });
});

describe("Clipboard Fallback", () => {
  describe("Modern Clipboard API path", () => {
    it("uses navigator.clipboard.writeText when available", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      const mockNavigator = { clipboard: { writeText } };
      const mockDocument = { createElement: vi.fn(), body: { appendChild: vi.fn(), removeChild: vi.fn() } };

      const result = await copyTextToClipboard("0x1234...abcd", {
        navigator: mockNavigator,
        document: mockDocument,
      });

      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith("0x1234...abcd");
      expect(mockDocument.createElement).not.toHaveBeenCalled();
    });

    it("handles clipboard API rejection gracefully", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
      const mockNavigator = { clipboard: { writeText } };
      const mockDocument = { createElement: vi.fn(), body: { appendChild: vi.fn(), removeChild: vi.fn() } };

      const result = await copyTextToClipboard("0x1234...abcd", {
        navigator: mockNavigator,
        document: mockDocument,
      });

      expect(result).toBe(false);
    });
  });

  describe("execCommand fallback path", () => {
    it("uses textarea + execCommand when clipboard API is unavailable", async () => {
      const mockTextArea = {
        value: "",
        style: {} as any,
        select: vi.fn(),
      };
      const mockNavigator = { clipboard: undefined };
      const mockDocument = {
        createElement: vi.fn().mockReturnValue(mockTextArea),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        execCommand: vi.fn().mockReturnValue(true),
      };

      const result = await copyTextToClipboard("0xDeadBeef", {
        navigator: mockNavigator,
        document: mockDocument,
      });

      expect(result).toBe(true);
      expect(mockDocument.createElement).toHaveBeenCalledWith("textarea");
      expect(mockTextArea.value).toBe("0xDeadBeef");
      expect(mockTextArea.style.position).toBe("fixed");
      expect(mockTextArea.style.opacity).toBe("0");
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockTextArea);
      expect(mockTextArea.select).toHaveBeenCalled();
      expect(mockDocument.execCommand).toHaveBeenCalledWith("copy");
      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockTextArea);
    });

    it("falls back when clipboard is null", async () => {
      const mockTextArea = { value: "", style: {} as any, select: vi.fn() };
      const mockNavigator = { clipboard: null };
      const mockDocument = {
        createElement: vi.fn().mockReturnValue(mockTextArea),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        execCommand: vi.fn().mockReturnValue(true),
      };

      const result = await copyTextToClipboard("0xTest", {
        navigator: mockNavigator,
        document: mockDocument,
      });

      expect(result).toBe(true);
      expect(mockDocument.execCommand).toHaveBeenCalledWith("copy");
    });

    it("falls back when clipboard.writeText is undefined", async () => {
      const mockTextArea = { value: "", style: {} as any, select: vi.fn() };
      const mockNavigator = { clipboard: { writeText: undefined } };
      const mockDocument = {
        createElement: vi.fn().mockReturnValue(mockTextArea),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        execCommand: vi.fn().mockReturnValue(true),
      };

      const result = await copyTextToClipboard("0xFallback", {
        navigator: mockNavigator,
        document: mockDocument,
      });

      expect(result).toBe(true);
      expect(mockDocument.execCommand).toHaveBeenCalledWith("copy");
    });
  });

  describe("Error handling", () => {
    it("returns false when execCommand throws", async () => {
      const mockTextArea = { value: "", style: {} as any, select: vi.fn() };
      const mockNavigator = { clipboard: undefined };
      const mockDocument = {
        createElement: vi.fn().mockReturnValue(mockTextArea),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        execCommand: vi.fn().mockImplementation(() => { throw new Error("Not supported"); }),
      };

      const result = await copyTextToClipboard("0xError", {
        navigator: mockNavigator,
        document: mockDocument,
      });

      expect(result).toBe(false);
    });

    it("handles empty string input", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      const mockNavigator = { clipboard: { writeText } };
      const mockDocument = { createElement: vi.fn(), body: { appendChild: vi.fn(), removeChild: vi.fn() } };

      const result = await copyTextToClipboard("", {
        navigator: mockNavigator,
        document: mockDocument,
      });

      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith("");
    });
  });
});
