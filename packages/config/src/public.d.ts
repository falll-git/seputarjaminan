export type WebsiteConfig = {
  service: "website";
  nodeEnv: "development" | "test" | "production";
  publicApiBaseUrl: string;
};

export type WebsiteEnvironment = Record<string, string | undefined>;

export function loadWebsiteConfig(
  environment?: WebsiteEnvironment,
): Readonly<WebsiteConfig>;
