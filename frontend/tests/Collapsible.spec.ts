import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

describe('Collapsible UI Component', () => {
  it('renders trigger and toggles content', async () => {
    const wrapper = mount({
      setup() {
        const isOpen = ref(false)
        return () =>
          h(
            Collapsible,
            {
              open: isOpen.value,
              'onUpdate:open': (val: boolean) => {
                isOpen.value = val
              },
            },
            () => [
              h(CollapsibleTrigger, null, () => 'کلیک برای تفکر'),
              h(CollapsibleContent, null, () => 'محتوای تفکر مدل'),
            ],
          )
      },
    })

    expect(wrapper.text()).toContain('کلیک برای تفکر')
    const trigger = wrapper.find('button')
    expect(trigger.exists()).toBe(true)

    // Click trigger to toggle open
    await trigger.trigger('click')
    expect(wrapper.html()).toContain('محتوای تفکر مدل')
  })
})
