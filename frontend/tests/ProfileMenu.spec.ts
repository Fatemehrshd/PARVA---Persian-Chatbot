import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileMenu from '../src/components/layout/ProfileMenu.vue'

describe('ProfileMenu', () => {
  it('emits open-profile when the profile item is selected', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(ProfileMenu)

    await wrapper.get('[role="menuitem"]').trigger('click')

    expect(wrapper.emitted('openProfile')).toHaveLength(1)
  })
})