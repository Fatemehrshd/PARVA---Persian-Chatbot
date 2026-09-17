import type { WebSource } from '../types'

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
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
