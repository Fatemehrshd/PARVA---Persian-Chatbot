import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminUsersSection from '../src/views/admin/AdminUsersSection.vue'
import { adminService } from '../src/services/admin.service'
import { subscriptionService } from '../src/services/subscription.service'

const FRESH_USER = {
  id: 'u1',
  email: 'ali@test.com',
  displayName: 'علی رضایی',
  role: 'user',
  isActive: true,
  usedTokens: 800,
  tokenLimit: 5000,
  messageLimit: 42,
  conversationsCount: 3,
  effectiveTokenLimit: 5000,
  effectiveMessageLimit: 42,
  periodUsedTokens: 0,
  periodUsedMessages: 0,
  planName: null,
}

vi.mock('../src/services/admin.service', () => ({
  adminService: {
    listUsers: vi.fn(),
    getSettings: vi.fn(),
    updateUser: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}))

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    getAllPlans: vi.fn(async () => []),
    assignSubscription: vi.fn(),
  },
}))

const stubs = {
  AdminTable: {
    props: ['columns', 'items'],
    template: `<div><slot name="row" v-for="item in items" :key="item.id" :item="item" /></div>`,
  },
  BaseToggle: { template: '<button />' },
  BaseButton: { template: '<button><slot /></button>' },
  UserEditorModal: {
    props: ['open', 'user'],
    template: `<div v-if="open" data-testid="editor-modal">{{ JSON.stringify(user) }}</div>`,
  },
  AssignSubscriptionModal: { template: '<div />' },
}

describe('AdminUsersSection — edit persistence & optimistic update', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(adminService.getSettings as any).mockResolvedValue({
      tokenRatePer1000: 10,
      globalTokenLimit: 0,
      roleQuotas: {},
      roleTokenLimits: {},
    })
    ;(adminService.updateUser as any).mockResolvedValue({ ...FRESH_USER })
  })

  async function mountSection(listUsersMock: any) {
    ;(adminService.listUsers as any).mockImplementation(listUsersMock)
    const w = mount(AdminUsersSection, { global: { stubs } })
    await flushPromises()
    const btn = w.find('[title="ویرایش و شارژ"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await flushPromises()
    return w
  }

  /** بار اول داده می‌دهد تا ردیف‌ها رندر شوند؛ refetch های بعدی هرگز برنمی‌گردند. */
  function hangAfterFirstLoad() {
    let first = true
    return async () => {
      if (first) {
        first = false
        return { items: [{ ...FRESH_USER }], total: 1 }
      }
      return new Promise(() => {})
    }
  }

  it('populates the editor from the user row (no defaults)', async () => {
    const w = await mountSection(async () => ({ items: [{ ...FRESH_USER }], total: 1 }))
    const userProp = JSON.parse(w.find('[data-testid="editor-modal"]').text())
    expect(userProp.displayName).toBe('علی رضایی')
    expect(Number(userProp.tokenLimit)).toBe(5000)
    expect(Number(userProp.messageLimit)).toBe(42)
    expect(userProp.email).toBe('ali@test.com')
  })

  it('applies saved changes to the row optimistically — before any refetch lands', async () => {
    // refetch هرگز resolve نمی‌شود: باید آپدیت فوری دیده شود
    const w = await mountSection(hangAfterFirstLoad())
    ;(adminService.updateUser as any).mockResolvedValue({ ...FRESH_USER })
    // عمدا await نمی‌کنیم — refetch بی‌صدا pending می‌ماند
    ;(w.vm as any).handleSaveUser({
      displayName: 'نام جدید',
      email: 'ali@test.com',
      role: 'admin',
      tokenLimit: 9000,
      messageLimit: null,
    })
    await flushPromises()
    const row = (w.vm as any).users[0]
    expect(row.displayName).toBe('نام جدید')
    expect(Number(row.tokenLimit)).toBe(9000)
    expect(row.tokenLimit).not.toBe(undefined)
    expect(row.messageLimit).toBeNull()
    expect(row.role).toBe('admin')
  })

  it('rolls back the row when save fails', async () => {
    const w = await mountSection(hangAfterFirstLoad())
    ;(adminService.updateUser as any).mockRejectedValue(new Error('boom'))
    await (w.vm as any).handleSaveUser({
      displayName: 'تغییر شکست‌خورده',
      email: 'ali@test.com',
      role: 'user',
      tokenLimit: 1,
      messageLimit: null,
    })
    const row = (w.vm as any).users[0]
    expect(row.displayName).toBe('علی رضایی')
    expect(Number(row.tokenLimit)).toBe(5000)
    expect(Number(row.messageLimit)).toBe(42)
  })

  it('calculates the admin percentage from current-period usage after reset', async () => {
    const w = await mountSection(async () => ({ items: [{ ...FRESH_USER, usedTokens: 800, periodUsedTokens: 0 }], total: 1 }))

    const stats = (w.vm as any).getUserStats((w.vm as any).users[0])
    expect(stats.remainingPercent).toBe(100)
  })

  it('uses backend remainingPercent (min of token & message %) from the users list', async () => {
    const w = await mountSection(async () => ({
      items: [{ ...FRESH_USER, periodUsedTokens: 0, periodUsedMessages: 21, remainingPercent: 50 }],
      total: 1,
    }))

    const stats = (w.vm as any).getUserStats((w.vm as any).users[0])
    // بک‌اند 50 فرستاده (min توکن/پیام) — فرانت نباید خودش دوباره فقط توکن محاسبه کند
    expect(stats.remainingPercent).toBe(50)
  })

  it('recomputes remainingPercent optimistically when admin edits limits', async () => {
    const w = await mountSection(hangAfterFirstLoad())
    // tokenLimit 5000 → 10000 و messageLimit 42 → 21: سقف پیام حالا محدودکننده است
    ;(w.vm as any).handleSaveUser({
      displayName: 'علی رضایی',
      email: 'ali@test.com',
      role: 'user',
      tokenLimit: 10000,
      messageLimit: 21,
    })
    await flushPromises()
    const row = (w.vm as any).users[0]
    // periodUsedMessages=0 → msgPct=100, tokenPct=round((10000-0)/10000*100)=100 → min=100
    expect(row.remainingPercent).toBe(100)
    // حالا پیام مصرفی را ست کنیم تا min واقعی دیده شود
    row.periodUsedMessages = 10
    ;(w.vm as any).patchUserRow(row, {
      remainingPercent: (w.vm as any).computeLocalRemainingPercent(row, 10000, 21),
    })
    // msgPct=round((21-10)/21*100)=52, tokenPct=100 → min=52
    expect(row.remainingPercent).toBe(52)
  })
})
