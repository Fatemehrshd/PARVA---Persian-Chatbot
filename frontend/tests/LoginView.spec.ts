import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '../src/views/LoginView.vue'

// Mock vue-router
const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe('LoginView.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockClear()
  })

  it('renders login form with Shadcn components', () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    expect(wrapper.text()).toContain('NeuralChat')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  it('switches to signup tab when clicked', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    const buttons = wrapper.findAll('button[type="button"]')
    const signupTab = buttons.find(b => b.text().includes('ثبت‌نام') || b.text().includes('Sign Up'))
    expect(signupTab).toBeDefined()
    
    await signupTab!.trigger('click')
    expect(wrapper.find('#displayName').exists()).toBe(true)
  })

  it('shows error when email is invalid', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    const emailInput = wrapper.find('input[type="email"]')
    await emailInput.setValue('invalid-email')

    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.text()).toMatch(/ایمیل معتبر|valid email/i)
  })
})

