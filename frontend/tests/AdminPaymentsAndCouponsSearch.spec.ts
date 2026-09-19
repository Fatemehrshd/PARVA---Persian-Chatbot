import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminPaymentsSection from '../src/views/admin/AdminPaymentsSection.vue'
import AdminCouponsSection from '../src/views/admin/AdminCouponsSection.vue'
import { paymentService } from '../src/services/payment.service'

vi.mock('../src/services/payment.service', () => ({
  paymentService: {
    getAllPayments: vi.fn(),
    adminGetCoupons: vi.fn(),
    adminCreateCoupon: vi.fn(),
    adminUpdateCoupon: vi.fn(),
    adminDeleteCoupon: vi.fn(),
  },
}))

describe('Admin payments and coupons search', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('searches financial transactions by the selected user email field', async () => {
    vi.mocked(paymentService.getAllPayments).mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 } as any)
    const wrapper = mount(AdminPaymentsSection, { global: { stubs: { AdminTableSkeleton: true } } })
    await flushPromises()

    const search = wrapper.find('input.search-text-input')
    expect(search.exists()).toBe(true)
    await wrapper.find('select.search-field-select').setValue('user.email')
    await search.setValue('alice@example.com')
    await new Promise((resolve) => setTimeout(resolve, 260))
    await flushPromises()

    expect(paymentService.getAllPayments).toHaveBeenLastCalledWith(expect.objectContaining({
      search: 'alice@example.com',
      searchField: 'user.email',
    }))
  })

  it('searches coupons by code or description and sends the status filter', async () => {
    vi.mocked(paymentService.adminGetCoupons).mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 } as any)
    const wrapper = mount(AdminCouponsSection)
    await flushPromises()

    const search = wrapper.find('input[placeholder="جستجو در کدها و توضیحات..."]')
    await search.setValue('SPRING')
    await new Promise((resolve) => setTimeout(resolve, 320))
    await flushPromises()

    expect(paymentService.adminGetCoupons).toHaveBeenLastCalledWith(expect.objectContaining({
      search: 'SPRING',
      isActive: undefined,
    }))
  })
})
