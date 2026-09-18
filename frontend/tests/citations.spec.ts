import { describe, it, expect } from 'vitest'
import { linkCitationsInHtml, stripTrailingSourcesLine } from '../src/utils/citations'

const srcs = [{ title: 't1', url: 'https://a.com/1' }, { title: 't2', url: 'https://b.com/2' }]

describe('linkCitationsInHtml', () => {
  it('links [1] and [2] to the right urls', () => {
    const out = linkCitationsInHtml('<p>see [1] and [2]</p>', srcs)
    expect(out).toContain('href="https://a.com/1"')
    expect(out).toContain('href="https://b.com/2"')
    expect(out).toContain('target="_blank"')
  })
  it('leaves out-of-range markers untouched', () => {
    expect(linkCitationsInHtml('<p>x [9]</p>', srcs)).toContain('[9]')
  })
  it('escapes quotes in urls', () => {
    const out = linkCitationsInHtml('<p>[1]</p>', [{ title: 't', url: 'https://a.com/"q' }])
    expect(out).not.toContain('href="https://a.com/"q"')
  })
})

describe('stripTrailingSourcesLine', () => {
  const srcs = [{ title: 't', url: 'https://a.com/1' }]

  it('removes the model trailing "sources: [1] [2]" line when sources exist', () => {
    const out = stripTrailingSourcesLine('جواب کامل است.\nمنابع: [1] [2]', srcs)
    expect(out).toBe('جواب کامل است.')
  })

  it('leaves everything untouched without attached sources', () => {
    const text = 'جواب.\nمنابع: [1] [2]'
    expect(stripTrailingSourcesLine(text, null)).toBe(text)
    expect(stripTrailingSourcesLine(text, [])).toBe(text)
  })

  it('keeps richer trailing lines (titles, urls, sentences)', () => {
    const text = 'جواب.\nمنابع:\n[1] عنوان خبر https://a.com/1'
    expect(stripTrailingSourcesLine(text, srcs)).toBe(text)
  })
})
