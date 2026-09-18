import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SourcesBlock from '../src/components/chat/SourcesBlock.vue'

const srcs = [
  { title: 't1', url: 'https://a.com/1', snippet: 's1' },
  { title: 't2', url: 'https://b.com/2', snippet: 's2' },
]

describe('SourcesBlock', () => {
  it('renders one link per source', () => {
    const w = mount(SourcesBlock, { props: { sources: srcs } })
    const links = w.findAll('a[href]')
    expect(links.map((a) => a.attributes('href'))).toEqual(['https://a.com/1', 'https://b.com/2'])
    expect(links[0].attributes('target')).toBe('_blank')
  })

  it('shows the failure note when search failed', () => {
    const w = mount(SourcesBlock, { props: { sources: null, failed: true } })
    expect(w.text()).toContain('جستجوی وب ناموفق بود')
  })

  it('renders nothing without sources or failure', () => {
    const w = mount(SourcesBlock, { props: { sources: null } })
    expect(w.find('[data-testid="sources-block"]').exists()).toBe(false)
  })

  it('starts collapsed and expands only on click', async () => {
    const w = mount(SourcesBlock, { props: { sources: srcs } })
    expect(w.find('[data-testid="sources-toggle"]').text()).toBe('نمایش')
    expect(w.find('[data-testid="sources-body"]').attributes('style')).toContain('display: none')
    await w.find('[data-testid="sources-toggle"]').trigger('click')
    expect(w.find('[data-testid="sources-toggle"]').text()).toBe('بستن')
    expect(w.find('[data-testid="sources-body"]').attributes('style') ?? '').not.toContain('display: none')
  })
})
