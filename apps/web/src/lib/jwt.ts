type JwtPayload = Record<string, unknown> & { exp?: number };

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  // atob is available in browsers
  return atob(padded);
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const json = base64UrlDecode(parts[1]);
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function getJwtExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) return null;
  return exp * 1000;
}
