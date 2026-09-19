import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminAuditLogsSection from '../src/views/admin/AdminAuditLogsSection.vue'
import { auditService } from '../src/services/audit.service'
import type { AuditLogItem } from '../src/types'

vi.mock('../src/services/audit.service', () => ({
  auditService: {
    getAuditLogs: vi.fn(),
  },
}))

describe('AdminAuditLogsSection.vue', () => {
  const mockLogs: AuditLogItem[] = [
    {
      id: 'log-1',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      actorId: 'user-1',
      actorType: 'user',
      action: 'POST /api/v1/chat/completions',
      entityType: 'http_request',
      method: 'POST',
      path: '/api/v1/chat/completions',
      statusCode: 200,
      durationMs: 145,
      createdAt: '2026-09-19T10:00:00.000Z',
      metadata: { model: 'gpt-4o' },
    },
    {
      id: 'log-2',
      traceId: 'abcdef1234567890abcdef1234567890',
      spanId: 'abcdef1234567890',
      actorId: 'admin-1',
      actorType: 'admin',
      action: 'payment.zarinpal.request',
      entityType: 'external_fetch',
      method: 'POST',
      path: 'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
      statusCode: 500,
      durationMs: 820,
      errorMessage: 'Gateway timeout',
      createdAt: '2026-09-19T10:05:00.000Z',
      metadata: { amount: 50000 },
    },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(auditService.getAuditLogs).mockResolvedValue({
      items: mockLogs,
      total: 2,
      page: 1,
      limit: 100,
      totalPages: 1,
      stats: {
        totalLogs: 2,
        errorCount: 1,
        fetchCount: 1,
        avgDurationMs: 482,
      },
    })
  })

  it('renders section title and quick stats cards properly', async () => {
    const wrapper = mount(AdminAuditLogsSection)
    await flushPromises()

    expect(wrapper.text()).toContain('لاگ‌های سیستم، ردیابی فراخوانی‌ها و ممیزی')
    expect(wrapper.text()).toContain('کل لاگ‌های ثبت‌شده')
    expect(wrapper.text()).toContain('خطاها و شکست‌ها')
    expect(wrapper.text()).toContain('فراخوانی خروجی (Fetch)')
  })

  it('renders logs in table with method, status, action, and duration', async () => {
    const wrapper = mount(AdminAuditLogsSection)
    await flushPromises()

    expect(wrapper.text()).toContain('POST')
    expect(wrapper.text()).toContain('200 OK')
    expect(wrapper.text()).toContain('500 ERR')
    expect(wrapper.text()).toContain('/api/v1/chat/completions')
    expect(wrapper.text()).toContain('payment.zarinpal.request')
  })

  it('generates SigNoz trace link for items with traceId', async () => {
    const wrapper = mount(AdminAuditLogsSection)
    await flushPromises()

    const links = wrapper.findAll('a[title="مشاهده مستقیم ردپا در SigNoz"]')
    expect(links.length).toBe(2)

    const firstHref = links[0].attributes('href')
    expect(firstHref).toContain('/trace/1234567890abcdef1234567890abcdef')
  })

  it('copies traceId to clipboard when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    const wrapper = mount(AdminAuditLogsSection)
    await flushPromises()

    const copyBtn = wrapper.find('button[title="کپی شناسه Trace ID"]')
    expect(copyBtn.exists()).toBe(true)
    await copyBtn.trigger('click')

    expect(writeTextMock).toHaveBeenCalledWith('1234567890abcdef1234567890abcdef')
  })

  it('opens detail modal with complete metadata and error details', async () => {
    const wrapper = mount(AdminAuditLogsSection)
    await flushPromises()

    const detailButtons = wrapper.findAll('button[title="مشاهده جزئیات کامل لاگ"]')
    expect(detailButtons.length).toBe(2)

    // Click on second log (which has error)
    await detailButtons[1].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('جزئیات درخواست و رخداد')
    expect(wrapper.text()).toContain('Gateway timeout')
    expect(wrapper.text()).toContain('abcdef1234567890abcdef1234567890')
    expect(wrapper.text()).toContain('مشاهده ردپا در SigNoz')
  })
})
