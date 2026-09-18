import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoleTokenLimitModal from '../src/components/admin/modals/RoleTokenLimitModal.vue'

const baseProps = {
  open: true,
  role: 'user',
  roleLabel: 'کاربر عادی',
  currentLimit: 5000 as number | null,
  tokenRatePer1000: 10,
}

describe('RoleTokenLimitModal', () => {
  it('prefills the token and dollar fields from the current limit', () => {
    const w = mount(RoleTokenLimitModal, { props: baseProps })
    const tokenInput = w.findAll('input[type="number"]')[1]
    const dollarInput = w.findAll('input[type="number"]')[0]
    expect((tokenInput.element as HTMLInputElement).value).toBe('5000')
    expect((dollarInput.element as HTMLInputElement).value).toBe('50')
    expect(w.text()).toContain('کاربر عادی')
  })

  it('keeps token and dollar fields in sync via the rate', async () => {
    const w = mount(RoleTokenLimitModal, { props: baseProps })
    const tokenInput = w.findAll('input[type="number"]')[1]
    await tokenInput.setValue('10000')
    const dollarInput = w.findAll('input[type="number"]')[0]
    expect((dollarInput.element as HTMLInputElement).value).toBe('100')
  })

  it('emits save with null when the fields are cleared (fall back to global)', async () => {
    const w = mount(RoleTokenLimitModal, { props: baseProps })
    const tokenInput = w.findAll('input[type="number"]')[1]
    await tokenInput.setValue('')
    await w.find('form').trigger('submit')
    const saveEvent = w.emitted('save')
    expect(saveEvent).toBeTruthy()
    expect(saveEvent![0][0]).toEqual({ role: 'user', tokenLimit: null })
  })

  it('emits save with the entered token limit', async () => {
    const w = mount(RoleTokenLimitModal, { props: baseProps })
    const tokenInput = w.findAll('input[type="number"]')[1]
    await tokenInput.setValue('20000')
    await w.find('form').trigger('submit')
    const saveEvent = w.emitted('save')
    expect(saveEvent![0][0]).toEqual({ role: 'user', tokenLimit: 20000 })
  })
})
