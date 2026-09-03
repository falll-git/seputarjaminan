function isLoopbackHostname(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" || normalized === "::1" || normalized.startsWith("127.");
}

function isEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

export function loadWebsiteConfig(environment = process.env) {
  const nodeEnv = String(environment.NODE_ENV || "development").trim();
  const configured = String(
    environment.SJ_PUBLIC_API_BASE_URL || "http://127.0.0.1:4100",
  ).trim();
  const issues = [];
  if (!["development", "test", "production"].includes(nodeEnv)) {
    issues.push("NODE_ENV website tidak valid.");
  }
  let apiUrl;
  try {
    apiUrl = new URL(configured);
  } catch {
    issues.push("SJ_PUBLIC_API_BASE_URL wajib berupa URL valid.");
  }
  if (nodeEnv === "production" && apiUrl) {
    const loopbackAllowed =
      isEnabled(environment.SJ_ALLOW_LOOPBACK_API) &&
      isLoopbackHostname(apiUrl.hostname);
    if (
      apiUrl.protocol !== "https:" &&
      !(loopbackAllowed && apiUrl.protocol === "http:")
    ) {
      issues.push("SJ_PUBLIC_API_BASE_URL website wajib memakai HTTPS di production.");
    }
    if (apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
      issues.push(
        "SJ_PUBLIC_API_BASE_URL website tidak boleh memuat credential, query, atau fragment.",
      );
    }
    if ((trimTrailingSlashes(apiUrl.pathname) || "/") !== "/") {
      issues.push(
        "SJ_PUBLIC_API_BASE_URL website wajib berupa origin tanpa path tambahan.",
      );
    }
  }
  if (issues.length > 0) {
    const error = new Error(
      "Konfigurasi website Seputar Jaminan tidak aman atau belum lengkap.",
    );
    error.issues = issues;
    throw error;
  }
  return Object.freeze({
    service: "website",
    nodeEnv,
    publicApiBaseUrl: trimTrailingSlashes(configured),
  });
}
