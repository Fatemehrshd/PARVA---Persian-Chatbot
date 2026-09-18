import type { WebSource } from '../types'

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

const MARKER = '\\[[\\d\\u06F0-\\u06F9]+\\]'
const SOURCES_LINE_RE = new RegExp(
  `^\\s*(منابع|sources?)\\s*[:\\uFF1A]?\\s*(${MARKER}[\\s,;]*)+$`,
  'i',
)

/**
 * Removes the model's own trailing "sources: [1] [2] …" line when we have
 * real attached sources (otherwise the card below would duplicate it).
 * Only the exact single-line marker list is stripped — anything richer
 * (titles, URLs, sentences) is left untouched. No sources → no change.
 */
export function stripTrailingSourcesLine(
  content: string,
  sources: WebSource[] | null | undefined,
): string {
  if (!content || !sources || sources.length === 0) return content
  const lines = content.split('\n')
  let end = lines.length
  while (end > 0 && lines[end - 1].trim() === '') end--
  if (end > 0 && SOURCES_LINE_RE.test(lines[end - 1])) {
    lines.splice(end - 1, 1)
  }
  return lines.join('\n')
}

export function linkCitationsInHtml(html: string, sources: WebSource[] | null | undefined): string {
  if (!html || !sources || sources.length === 0) return html
  return html.replace(/\[(\d+)\]/g, (m, n) => {
    const idx = Number(n) - 1
    if (idx < 0 || idx >= sources.length) return m
    const url = escapeAttr(sources[idx].url)
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary font-medium hover:underline">[${n}]</a>`
  })
}
