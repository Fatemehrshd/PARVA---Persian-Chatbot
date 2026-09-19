import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ThinkingBlock from '@/components/chat/ThinkingBlock.vue'

describe('ThinkingBlock', () => {
  it('renders "در حال فکر کردن..." state while actively thinking', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        reasoning: 'در حال استدلال مرحله ۱...',
        isThinking: true,
      },
    })
    expect(wrapper.text()).toContain('در حال فکر کردن')
    expect(wrapper.find('[data-test="thinking-block"]').exists()).toBe(true)
  })

  it('renders "فرآیند تفکر" and formatted duration when thinking is complete', () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        reasoning: 'استدلال پایان یافت.',
        isThinking: false,
        durationMs: 3200,
      },
    })
    expect(wrapper.text()).toContain('فرآیند تفکر')
    // 3.2 seconds formatted to Persian digits ۳.۲ ثانیه
    expect(wrapper.text()).toContain('۳.۲ ثانیه')
  })

  it('renders reasoning text in content', async () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        reasoning: 'گام‌های منطقی مدل برای حل مسئله',
        isThinking: false,
        defaultOpen: true,
      },
    })
    expect(wrapper.text()).toContain('گام‌های منطقی مدل برای حل مسئله')
  })

  it('toggles collapsible open state when clicking trigger', async () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        reasoning: 'متن تفکر',
        isThinking: false,
        defaultOpen: false,
      },
    })

    const trigger = wrapper.find('[data-test="thinking-trigger"]')
    expect(trigger.exists()).toBe(true)

    // Click trigger to expand
    await trigger.trigger('click')
    expect(wrapper.html()).toContain('متن تفکر')
  })
})
