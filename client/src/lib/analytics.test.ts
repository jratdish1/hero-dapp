import { describe, expect, it } from "vitest";
import { getAnalyticsConfiguration } from "./analytics";

describe("optional analytics bootstrap", () => {
  it("does not create a request when either setting is absent", () => {
    expect(getAnalyticsConfiguration(undefined, undefined)).toBeNull();
    expect(getAnalyticsConfiguration("https://analytics.example.com", undefined)).toBeNull();
    expect(getAnalyticsConfiguration(undefined, "site-id")).toBeNull();
    expect(getAnalyticsConfiguration("   ", "site-id")).toBeNull();
  });

  it("rejects malformed and non-HTTPS analytics endpoints", () => {
    expect(getAnalyticsConfiguration("%VITE_ANALYTICS_ENDPOINT%", "site-id")).toBeNull();
    expect(getAnalyticsConfiguration("http://analytics.example.com", "site-id")).toBeNull();
    expect(getAnalyticsConfiguration("javascript:alert(1)", "site-id")).toBeNull();
  });

  it("builds the expected HTTPS Umami URL", () => {
    expect(
      getAnalyticsConfiguration("https://analytics.example.com/base", "  site-id  "),
    ).toEqual({
      src: "https://analytics.example.com/base/umami",
      websiteId: "site-id",
    });
  });
});
