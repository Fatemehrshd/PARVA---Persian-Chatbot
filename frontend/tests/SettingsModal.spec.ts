import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SettingsModal from '../src/components/layout/SettingsModal.vue'
import { useUiStore } from '../src/stores/ui'

describe('SettingsModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders modal when settingsModalOpen is true and allows switching themes', async () => {
    const uiStore = useUiStore()
    uiStore.settingsModalOpen = true
    uiStore.theme = 'dark'

    const wrapper = mount(SettingsModal, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    expect(wrapper.find('.settings-modal-dialog').exists()).toBe(true)

    // Find theme cards
    const themeCards = wrapper.findAll('.theme-card')
    expect(themeCards.length).toBe(2)

    // Second card is Light theme
    await themeCards[1].trigger('click')
    expect(uiStore.theme).toBe('light')

    // First card is Dark theme
    await themeCards[0].trigger('click')
    expect(uiStore.theme).toBe('dark')
  })

  it('does not display any English language or LTR switch option and operates strictly in Persian RTL', async () => {
    const uiStore = useUiStore()
    uiStore.settingsModalOpen = true

    const wrapper = mount(SettingsModal, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    const englishBtn = buttons.find(b => b.text().includes('English') || b.text().includes('LTR'))
    expect(englishBtn).toBeUndefined()
    expect(uiStore.direction).toBe('rtl')
    // The modal was re-scoped to "تم و رنگ‌بندی" (theme only); assert its Persian title
    expect(wrapper.find('.settings-modal-dialog').text()).toContain('تم و رنگ‌بندی')
  })

  it('closes modal when close button is clicked', async () => {
    const uiStore = useUiStore()
    uiStore.settingsModalOpen = true

    const wrapper = mount(SettingsModal, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    const closeBtn = wrapper.find('button[aria-label="Close"]')
    expect(closeBtn.exists()).toBe(true)

    await closeBtn.trigger('click')
    expect(uiStore.settingsModalOpen).toBe(false)
  })
})
