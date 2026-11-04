// Share-link token helpers (pure, testable).
const TOKEN_RE = /^[0-9a-f]{32}$/;

export function generateShareToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function isValidShareToken(token: string): boolean {
  return TOKEN_RE.test(token);
}
