import { describe, it, expect } from 'vitest'
import { dispatchSseEvent } from '../src/services/chat.service'

describe('dispatchSseEvent', () => {
  it('dispatches sources events', () => {
    const seen: any = {}
    dispatchSseEvent('sources', { sources: [{ title: 't', url: 'https://e.com' }] }, { onSources: (s) => (seen.s = s) })
    expect(seen.s).toHaveLength(1)
    dispatchSseEvent('search-status', { state: 'searching' }, { onSearchStatus: (s) => (seen.st = s) })
    expect(seen.st).toBe('searching')
    dispatchSseEvent('sources-error', { message: 'm' }, { onSourcesError: (m) => (seen.e = m) })
    expect(seen.e).toBe('m')
  })

  it('keeps dispatching the legacy events', () => {
    const seen: any = {}
    dispatchSseEvent('token', { content: 'hi' }, { onToken: (t) => (seen.t = t) })
    dispatchSseEvent('sync', { content: 'full' }, { onSync: (c) => (seen.c = c) })
    dispatchSseEvent('title', { title: 'T' }, { onTitle: (t) => (seen.ti = t) })
    dispatchSseEvent('done', { messageId: 'm1' }, { onDone: (m) => (seen.d = m) })
    expect(seen).toEqual({ t: 'hi', c: 'full', ti: 'T', d: 'm1' })
  })
})
