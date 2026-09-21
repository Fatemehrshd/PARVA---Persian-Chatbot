import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CapabilityBadge from '@/components/chat/CapabilityBadge.vue'
import { getModelCapabilities } from '@/types/capabilities'

describe('CapabilityBadge', () => {
  it('renders thinking badge with correct Persian label', () => {
    const wrapper = mount(CapabilityBadge, {
      props: { capability: 'thinking' },
    })
    expect(wrapper.text()).toContain('تفکر')
    expect(wrapper.attributes('title')).toBe('پشتیبانی از تفکر و استدلال گام به گام')
  })

  it('renders vision badge with correct Persian label', () => {
    const wrapper = mount(CapabilityBadge, {
      props: { capability: 'vision' },
    })
    expect(wrapper.text()).toContain('تصویر')
  })

  it('renders document badge with correct Persian label', () => {
    const wrapper = mount(CapabilityBadge, {
      props: { capability: 'document' },
    })
    expect(wrapper.text()).toContain('اسناد')
  })

  it('hides label text when showLabel is false', () => {
    const wrapper = mount(CapabilityBadge, {
      props: { capability: 'thinking', showLabel: false },
    })
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('[data-test="capability-badge"]').exists()).toBe(true)
  })

  it('getModelCapabilities extracts capability list properly', () => {
    expect(
      getModelCapabilities({
        supportsThinking: true,
        supportsVision: true,
        supportsDocument: false,
      }),
    ).toEqual(['thinking', 'vision'])

    expect(
      getModelCapabilities({
        supportsThinking: false,
        supportsVision: false,
        supportsDocument: true,
      }),
    ).toEqual(['document'])
  })
})
