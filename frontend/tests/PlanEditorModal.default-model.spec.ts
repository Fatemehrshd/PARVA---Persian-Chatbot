import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PlanEditorModal from '../src/components/admin/modals/PlanEditorModal.vue'
import { modelsService } from '../src/services/models.service'
import { subscriptionService } from '../src/services/subscription.service'

vi.mock('../src/services/models.service', () => ({
  modelsService: {
    listModels: vi.fn(),
  },
}))

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    getPlan: vi.fn(),
  },
}))

describe('PlanEditorModal default model refresh', () => {
  it('loads fresh plan models when the editor opens', async () => {
    vi.mocked(modelsService.listModels).mockResolvedValue([
      { id: 'model-default', name: 'مدل پیش‌فرض', provider: 'openai', isActive: true, isDefault: true } as any,
    ])
    vi.mocked(subscriptionService.getPlan).mockResolvedValue({
      id: 'free-plan',
      slug: 'free',
      name: 'طرح رایگان',
      price: '0',
      currency: 'IRR',
      durationDays: 0,
      tokenQuota: 0,
      messageQuota: null,
      resetHours: 6,
      features: {},
      isActive: true,
      isDefault: true,
      sortOrder: 0,
      planModels: [{ id: 'link-1', modelId: 'model-default' }],
      createdAt: '',
      updatedAt: '',
    } as any)

    const wrapper = mount(PlanEditorModal, {
      props: {
        open: true,
        plan: {
          id: 'free-plan',
          slug: 'free',
          name: 'طرح رایگان',
          price: '0',
          currency: 'IRR',
          durationDays: 0,
          tokenQuota: 0,
          messageQuota: null,
          resetHours: 6,
          features: {},
          isActive: true,
          isDefault: true,
          sortOrder: 0,
          planModels: [],
          createdAt: '',
          updatedAt: '',
        } as any,
      },
      global: {
        stubs: {
          AdminModal: { template: '<div><slot /><slot name="footer" /></div>' },
          BaseButton: { template: '<button><slot /></button>' },
        },
      },
    })
    await flushPromises()

    expect(subscriptionService.getPlan).toHaveBeenCalledWith('free-plan')
    const modelCheckbox = wrapper.findAll('input[type="checkbox"]')[1]
    expect((modelCheckbox.element as HTMLInputElement).checked).toBe(true)
  })
})
