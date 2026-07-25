type AnalyticsDocument = Pick<Document, "createElement" | "head" | "querySelector">;

export interface AnalyticsConfiguration {
  src: string;
  websiteId: string;
}

/**
 * Returns a safe analytics configuration only when both required build-time
 * values exist and the endpoint is HTTPS. Undefined Vite placeholders must not
 * create malformed requests on the public landing path.
 */
export function getAnalyticsConfiguration(
  endpoint: string | undefined,
  websiteId: string | undefined,
): AnalyticsConfiguration | null {
  const normalizedEndpoint = endpoint?.trim();
  const normalizedWebsiteId = websiteId?.trim();
  if (!normalizedEndpoint || !normalizedWebsiteId) return null;

  try {
    const base = normalizedEndpoint.endsWith("/")
      ? normalizedEndpoint
      : `${normalizedEndpoint}/`;
    const url = new URL("umami", base);
    if (url.protocol !== "https:") return null;
    return { src: url.toString(), websiteId: normalizedWebsiteId };
  } catch {
    return null;
  }
}

/** Installs the optional analytics script once, after configuration validation. */
export function installAnalytics(
  endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT,
  websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID,
  targetDocument: AnalyticsDocument = document,
): HTMLScriptElement | null {
  const configuration = getAnalyticsConfiguration(endpoint, websiteId);
  if (!configuration) return null;

  const existing = targetDocument.querySelector<HTMLScriptElement>(
    "script[data-vets-analytics]",
  );
  if (existing) return existing;

  const script = targetDocument.createElement("script");
  script.defer = true;
  script.src = configuration.src;
  script.dataset.websiteId = configuration.websiteId;
  script.dataset.vetsAnalytics = "true";
  targetDocument.head.appendChild(script);
  return script;
}
