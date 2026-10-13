/**
 * En-têtes de sécurité HTTP (Lot 2.6).
 * Pas de X-Frame-Options ni frame-ancestors 'none' : l'aperçu Lovable affiche
 * l'application dans un cadre. L'application Android (Capacitor, URL distante)
 * n'utilise pas de cadre et n'est pas concernée.
 * La CSP est en mode Report-Only : elle ne bloque rien tant qu'elle n'est pas validée.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev https://*.lovableproject.com",
].join("; ");

const PERMISSIONS_POLICY =
  "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()";

/** Production = site publié (hors poste local et hors aperçu). */
export function isProductionHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  if (!h || h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return false;
  if (h.startsWith("id-preview--") || h.includes("-preview--")) return false;
  return true;
}

export function securityHeadersFor(host: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY,
  };
  if (isProductionHost(host)) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

/** Ajoute les en-têtes sans écraser ceux déjà posés par une route. */
export function applySecurityHeaders(response: Response, host: string): Response {
  const extra = securityHeadersFor(host);
  try {
    for (const [k, v] of Object.entries(extra)) {
      if (!response.headers.has(k)) response.headers.set(k, v);
    }
    return response;
  } catch {
    // En-têtes immuables (réponse issue d'un fetch) : on recopie la réponse.
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(extra)) if (!headers.has(k)) headers.set(k, v);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
