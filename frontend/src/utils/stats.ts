/**
 * Adds a delta to a numeric dashboard counter in place.
 * Null-safe and type-safe: missing stats objects, missing keys and
 * non-numeric values are left untouched so optimistic patches can never
 * corrupt the dashboard state.
 */
export function adjustStat(
  stats: Record<string, unknown> | null | undefined,
  key: string,
  delta: number,
): void {
  if (!stats) return
  const cur = stats[key]
  if (typeof cur === 'number' && Number.isFinite(cur)) {
    stats[key] = cur + delta
  }
}
