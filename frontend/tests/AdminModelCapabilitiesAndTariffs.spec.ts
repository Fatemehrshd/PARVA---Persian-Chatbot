import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModelEditorModal from '../src/components/admin/modals/ModelEditorModal.vue'
import AdminPromptsSection from '../src/views/admin/AdminPromptsSection.vue'
import { adminService } from '../src/services/admin.service'

describe('Admin Model Capabilities & Feature Tariffs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  describe('ModelEditorModal.vue', () => {
    const mockProviders = [
      { id: 'p-1', name: 'OpenAI', providerType: 'openai', baseUrl: 'https://api.openai.com', isActive: true, createdAt: new Date().toISOString() },
    ]

    it('renders capabilities toggles and emits them on form submit', async () => {
      const wrapper = mount(ModelEditorModal, {
        props: {
          open: true,
          providers: mockProviders,
        },
      })

      expect(wrapper.text()).toContain('قابلیت‌های مدل:')
      expect(wrapper.text()).toContain('تفکر عمیق (Thinking)')
      expect(wrapper.text()).toContain('بینایی / عکس (Vision)')
      expect(wrapper.text()).toContain('تحلیل اسناد (Document)')

      // Fill in required fields
      await wrapper.find('#modelName').setValue('DeepSeek R1')
      await wrapper.find('#apiIdentifier').setValue('deepseek-reasoner')

      // Toggle thinking on
      const toggles = wrapper.findAllComponents({ name: 'BaseToggle' })
      // Toggle 0 is isActive, Toggle 1 is supportsThinking, Toggle 2 is supportsVision, Toggle 3 is supportsDocument
      expect(toggles.length).toBe(4)

      // Toggle thinking on
      await toggles[1].vm.$emit('update:modelValue', true)
      await wrapper.vm.$nextTick()

      // Thinking budget tokens input should appear
      const budgetInput = wrapper.find('#thinkingBudgetTokens')
      expect(budgetInput.exists()).toBe(true)
      await budgetInput.setValue('8192')

      // Submit form
      await wrapper.find('form').trigger('submit')

      const saveEvents = wrapper.emitted('save')
      expect(saveEvents).toBeDefined()
      expect(saveEvents![0][0]).toMatchObject({
        name: 'DeepSeek R1',
        apiIdentifier: 'deepseek-reasoner',
        supportsThinking: true,
        thinkingBudgetTokens: 8192,
      })
    })

    it('populates existing model capabilities when editing', () => {
      const existingModel = {
        id: 'm-edit',
        name: 'Existing Thinker',
        provider: 'OpenAI',
        providerId: 'p-1',
        apiIdentifier: 'o1-mini',
        isActive: true,
        supportsThinking: true,
        supportsVision: false,
        supportsDocument: true,
        thinkingBudgetTokens: 16384,
        createdAt: new Date().toISOString(),
      }

      const wrapper = mount(ModelEditorModal, {
        props: {
          open: true,
          model: existingModel as any,
          providers: mockProviders,
        },
      })

      const budgetInput = wrapper.find('#thinkingBudgetTokens')
      expect(budgetInput.exists()).toBe(true)
      expect((budgetInput.element as HTMLInputElement).value).toBe('16384')
    })
  })

  describe('AdminPromptsSection.vue tariffs', () => {
    it('loads and saves webSearchMultiplier and thinkingMultiplier', async () => {
      const getSettingsSpy = vi.spyOn(adminService, 'getSettings').mockResolvedValue({
        globalTokenLimit: 100000,
        tokenRatePer1000: 10,
        systemPrompt: 'You are helpful.',
        webSearchMultiplier: 1.25,
        thinkingMultiplier: 1.35,
      })

      const updateSettingsSpy = vi.spyOn(adminService, 'updateSettings').mockResolvedValue({})

      const wrapper = mount(AdminPromptsSection)
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(getSettingsSpy).toHaveBeenCalled()
      expect(wrapper.text()).toContain('تعرفه و ضرایب مصرف توکن (Feature Tariffs)')

      // Submit update
      await wrapper.find('form').trigger('submit')

      expect(updateSettingsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          webSearchMultiplier: 1.25,
          thinkingMultiplier: 1.35,
        })
      )
    })
  })
})
