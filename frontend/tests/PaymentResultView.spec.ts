import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PaymentResultView from '../src/views/PaymentResultView.vue'
import { paymentService } from '../src/services/payment.service'
import { useRoute, useRouter } from 'vue-router'

vi.mock('../src/services/payment.service', () => ({
  paymentService: {
    getByAuthority: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

describe('PaymentResultView Flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('automatically verifies pending payment when query status is OK and authority is provided (lowercase)', async () => {
    vi.mocked(useRoute).mockReturnValue({
      query: { authority: 'auth-123', status: 'OK' },
    } as any)

    vi.mocked(paymentService.getByAuthority).mockResolvedValue({
      id: 'pay-1',
      status: 'PENDING',
      amount: '500000',
      plan: { name: 'پلن حرفه‌ای' },
    } as any)

    vi.mocked(paymentService.verify).mockResolvedValue({
      success: true,
      refId: 'ref-999',
      payment: {
        id: 'pay-1',
        status: 'SUCCESS',
        amount: '500000',
        refId: 'ref-999',
        plan: { name: 'پلن حرفه‌ای' },
      },
    } as any)

    const wrapper = mount(PaymentResultView)
    await flushPromises()

    expect(paymentService.getByAuthority).toHaveBeenCalledWith('auth-123')
    expect(paymentService.verify).toHaveBeenCalledWith({
      authority: 'auth-123',
      status: 'OK',
    })

    expect(wrapper.text()).toContain('پرداخت با موفقیت انجام شد')
    expect(wrapper.text()).toContain('پلن حرفه‌ای')
    expect(wrapper.text()).toContain('ref-999')
  })

  it('handles capitalized query params from Zarinpal (Authority & Status)', async () => {
    vi.mocked(useRoute).mockReturnValue({
      query: { Authority: 'A00000000000000000000000000000000001', Status: 'OK' },
    } as any)

    vi.mocked(paymentService.getByAuthority).mockResolvedValue({
      id: 'pay-zp',
      status: 'PENDING',
      amount: '1000000',
      plan: { name: 'پلن نامحدود' },
    } as any)

    vi.mocked(paymentService.verify).mockResolvedValue({
      success: true,
      refId: 'ref-zp-100',
      payment: {
        id: 'pay-zp',
        status: 'SUCCESS',
        amount: '1000000',
        refId: 'ref-zp-100',
        plan: { name: 'پلن نامحدود' },
      },
    } as any)

    const wrapper = mount(PaymentResultView)
    await flushPromises()

    expect(paymentService.getByAuthority).toHaveBeenCalledWith('A00000000000000000000000000000000001')
    expect(paymentService.verify).toHaveBeenCalledWith({
      authority: 'A00000000000000000000000000000000001',
      status: 'OK',
    })

    expect(wrapper.text()).toContain('پرداخت با موفقیت انجام شد')
  })

  it('displays failure state when status is NOK', async () => {
    vi.mocked(useRoute).mockReturnValue({
      query: { authority: 'auth-fail', status: 'NOK' },
    } as any)

    vi.mocked(paymentService.getByAuthority).mockResolvedValue({
      id: 'pay-fail',
      status: 'CANCELLED',
      amount: '500000',
    } as any)

    const wrapper = mount(PaymentResultView)
    await flushPromises()

    expect(paymentService.verify).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('تراکنش ناموفق بود')
  })
})
