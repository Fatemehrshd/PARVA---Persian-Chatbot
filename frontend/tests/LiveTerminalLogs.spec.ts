import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LiveTerminalLogs from '../src/components/admin/LiveTerminalLogs.vue'
import { auditService } from '../src/services/audit.service'

vi.mock('../src/services/audit.service', () => ({
  auditService: {
    getSystemLogs: vi.fn(),
  },
}))

describe('LiveTerminalLogs.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auditService.getSystemLogs).mockResolvedValue({
      filename: 'app-2026-09-20.log',
      totalLines: 3,
      lines: [
        '2026-09-20 16:00:00 [INFO] Server started on port 3000',
        '2026-09-20 16:00:01 [WARN] Rate limit approaching for user 1',
        '2026-09-20 16:00:02 [ERROR] Database connection dropped',
      ],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders terminal log lines and filename properly', async () => {
    const wrapper = mount(LiveTerminalLogs, {
      props: {
        signozUrl: 'http://localhost:3301',
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('app-2026-09-20.log')
    expect(wrapper.text()).toContain('Server started on port 3000')
    expect(wrapper.text()).toContain('Database connection dropped')
    expect(auditService.getSystemLogs).toHaveBeenCalledWith('app', 150)
  })

  it('filters log lines with search input', async () => {
    const wrapper = mount(LiveTerminalLogs)
    await flushPromises()

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)

    await input.setValue('Database')
    await flushPromises()

    expect(wrapper.text()).toContain('Database connection dropped')
    expect(wrapper.text()).not.toContain('Server started on port 3000')
  })

  it('switches between app and error logs', async () => {
    const wrapper = mount(LiveTerminalLogs)
    await flushPromises()

    vi.mocked(auditService.getSystemLogs).mockResolvedValueOnce({
      filename: 'error-2026-09-20.log',
      totalLines: 1,
      lines: ['2026-09-20 16:01:00 [ERROR] Out of memory crash'],
    })

    const errorBtn = wrapper.findAll('button').find((b) => b.text().includes('خطاها'))
    expect(errorBtn).toBeDefined()
    await errorBtn!.trigger('click')
    await flushPromises()

    expect(auditService.getSystemLogs).toHaveBeenCalledWith('error', 150)
    expect(wrapper.text()).toContain('Out of memory crash')
  })
})
