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

  it('auto-scrolls the inner thinking panel to the bottom while streaming', async () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        reasoning: 'مرحله اول تفکر',
        isThinking: true,
        defaultOpen: true,
      },
    })

    const panel = wrapper.find('.thinking-markdown').element as HTMLElement
    Object.defineProperties(panel, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, writable: true, value: 420 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    })

    await wrapper.setProps({ reasoning: 'مرحله اول تفکر\nمرحله دوم تفکر\nمرحله سوم تفکر\nمرحله چهارم تفکر' })
    await wrapper.vm.$nextTick()

    expect(panel.scrollTop).toBe(420)
  })

  it('stops following the reasoning stream when the user scrolls upward manually', async () => {
    const wrapper = mount(ThinkingBlock, {
      props: {
        reasoning: 'مرحله اول تفکر\nمرحله دوم تفکر\nمرحله سوم تفکر',
        isThinking: true,
        defaultOpen: true,
      },
    })

    const panel = wrapper.find('.thinking-markdown').element as HTMLElement
    Object.defineProperties(panel, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, writable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 200 },
    })

    panel.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()

    Object.defineProperty(panel, 'scrollTop', { configurable: true, writable: true, value: 80 })
    panel.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()

    await wrapper.setProps({ reasoning: 'مرحله اول تفکر\nمرحله دوم تفکر\nمرحله سوم تفکر\nمرحله چهارم تفکر' })
    await wrapper.vm.$nextTick()

    expect(panel.scrollTop).not.toBe(500)
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
