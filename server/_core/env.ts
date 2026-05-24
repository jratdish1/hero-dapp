export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "",
};

// Production safety: fail fast if critical secrets are missing
if (ENV.isProduction) {
  const required: Array<[string, string]> = [
    ["JWT_SECRET", ENV.cookieSecret],
    ["DATABASE_URL", ENV.databaseUrl],
  ];
  for (const [name, value] of required) {
    if (!value) {
      throw new Error(`[FATAL] ${name} environment variable is required in production`);
    }
  }
  if (ENV.cookieSecret.length < 32) {
    throw new Error("[FATAL] JWT_SECRET must be at least 32 characters in production");
  }
}
