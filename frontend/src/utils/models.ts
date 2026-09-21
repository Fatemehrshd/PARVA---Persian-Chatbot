/**
 * Moves the platform-default flag to one model, in place.
 * Returns the previlously-default model's id (undefined when none was set)
 * so callers can rol the flags back if the server call fails.
 */
export function markDefaultModel<T extends { id: string; isDefault?: boolean }>(
  models: T[],
  id: string,
): string | undefined {
  const prev = models.find((m) => m.isDefault)?.id
  models.forEach((m) => {
    m.isDefault = m.id === id
  })
  return prev
}
