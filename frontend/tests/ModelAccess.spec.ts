import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelAccessPicker from '../src/components/admin/ModelAccessPicker.vue'
import ModelAccessBadge from '../src/components/admin/ModelAccessBadge.vue'
import ModelEditorModal from '../src/components/admin/modals/ModelEditorModal.vue'

const users = [
  { id: 'u1', email: 'ali@parva.ir', displayName: 'علی', role: 'user' },
  { id: 'u2', email: 'sara@parva.ir', displayName: 'سارا', role: 'user' },
] as any[]

describe('Model access — admin UI', () => {
  it('shows the whitelist picker only for private models and toggles users', async () => {
    const wrapper = mount(ModelAccessPicker, {
      props: { accessLevel: 'public', allowedUserIds: [], users },
    })

    // Public models need no whitelist UI
    expect(wrapper.find('[data-testid="model-access-user-search"]').exists()).toBe(false)

    await wrapper.setProps({ accessLevel: 'private' })
    expect(wrapper.find('[data-testid="model-access-user-search"]').exists()).toBe(true)

    await wrapper.find('[data-testid="model-access-user-u1"]').trigger('click')
    expect(wrapper.emitted('update:allowedUserIds')?.[0]).toEqual([['u1']])
  })

  it('filters the user directory by the search box', async () => {
    const wrapper = mount(ModelAccessPicker, {
      props: { accessLevel: 'private', allowedUserIds: ['u1'], users },
    })

    await wrapper.find('[data-testid="model-access-user-search"]').setValue('sara')
    expect(wrapper.find('[data-testid="model-access-user-u1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="model-access-user-u2"]').exists()).toBe(true)
  })

  it('renders the Persian label for each access level', () => {
    const publicBadge = mount(ModelAccessBadge, { props: { level: 'public' } })
    const commercialBadge = mount(ModelAccessBadge, { props: { level: 'commercial' } })
    const privateBadge = mount(ModelAccessBadge, { props: { level: 'private' } })

    expect(publicBadge.text()).toContain('عمومی')
    expect(commercialBadge.text()).toContain('تجاری')
    expect(privateBadge.text()).toContain('اختصاصی')
  })

  it('prefills the editor from an existing model and emits access with the whitelist', async () => {
    const wrapper = mount(ModelEditorModal, {
      props: {
        open: true,
        users,
        providers: [{ id: 'p1', name: 'openai', isActive: true } as any],
        model: {
          id: 'm1',
          name: 'GPT-4o',
          provider: 'openai',
          providerId: 'p1',
          apiIdentifier: 'gpt-4o',
          isActive: true,
          isDefault: false,
          accessLevel: 'private',
          allowedUserIds: ['u1'],
        } as any,
      },
    })

    expect((wrapper.find('[data-testid="model-access-level"]').element as HTMLSelectElement).value).toBe('private')
    expect(wrapper.find('[data-testid="model-access-user-u1"]').exists()).toBe(true)

    await wrapper.find('#modelName').setValue('GPT-4o Turbo')
    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('save')?.[0]?.[0] as any
    expect(payload.accessLevel).toBe('private')
    expect(payload.allowedUserIds).toEqual(['u1'])
  })

  it('clears the whitelist when a model is saved as public', async () => {
    const wrapper = mount(ModelEditorModal, {
      props: {
        open: true,
        users,
        providers: [{ id: 'p1', name: 'openai', isActive: true } as any],
      },
    })

    await wrapper.find('#modelName').setValue('مدل عمومی')
    await wrapper.find('#apiIdentifier').setValue('gpt-4o-mini')
    await wrapper.find('[data-testid="model-access-level"]').setValue('private')
    await wrapper.find('[data-testid="model-access-user-u2"]').trigger('click')
    await wrapper.find('[data-testid="model-access-level"]').setValue('public')
    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('save')?.[0]?.[0] as any
    expect(payload.accessLevel).toBe('public')
    expect(payload.allowedUserIds).toEqual([])
  })
})

describe('Role quota modal — commercial model access', () => {
  it('prefills the switch from the role settings and emits it on save', async () => {
    const RoleTokenLimitModal = (await import('../src/components/admin/modals/RoleTokenLimitModal.vue')).default
    const wrapper = mount(RoleTokenLimitModal, {
      props: {
        open: true,
        role: 'manager',
        roleLabel: 'مدیر',
        currentLimit: 1000,
        currentMessageLimit: 50,
        currentResetHours: 6,
        commercialAccess: true,
        tokenRatePer1000: 10,
      },
    })

    const toggle = wrapper.find('[role="switch"]')
    expect(toggle.attributes('aria-checked')).toBe('true')

    await toggle.trigger('click')
    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('save')?.[0]?.[0] as any
    expect(payload.role).toBe('manager')
    expect(payload.commercialAccess).toBe(false)
  })

  it('locks the switch for the admin role (always full access)', async () => {
    const RoleTokenLimitModal = (await import('../src/components/admin/modals/RoleTokenLimitModal.vue')).default
    const wrapper = mount(RoleTokenLimitModal, {
      props: {
        open: true,
        role: 'admin',
        roleLabel: 'مدیر سیستم',
        currentLimit: null,
        currentMessageLimit: null,
        currentResetHours: 6,
        commercialAccess: false,
        isCommercialAccessLocked: true,
        tokenRatePer1000: 10,
      },
    })

    const toggle = wrapper.find('[role="switch"]')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(toggle.attributes('disabled')).toBeDefined()
  })
})