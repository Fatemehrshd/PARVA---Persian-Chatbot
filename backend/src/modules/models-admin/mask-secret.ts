/** Shared masking so a real credential never leaves the API surface. */
export function maskSecret(key?: string | null): string | undefined {
  if (!key) return key as undefined;
  if (key.length > 8) return `sk-...${key.slice(-4)}`;
  return '***';
}
