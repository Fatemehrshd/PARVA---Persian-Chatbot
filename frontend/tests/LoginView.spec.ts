import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '../src/views/LoginView.vue'
import { useAuthStore } from '../src/stores/auth'

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

  it('disables inputs and button with loading spinner during authentication submission', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    const authStore = useAuthStore()
    let resolveLogin!: (val: boolean) => void
    const loginPromise = new Promise<boolean>((resolve) => {
      resolveLogin = resolve
    })
    vi.spyOn(authStore, 'login').mockImplementation(() => loginPromise)

    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('input[type="password"]')
    await emailInput.setValue('test@example.com')
    await passwordInput.setValue('password123')

    // Submit form
    wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    // Inputs and submit button should be disabled
    expect(emailInput.attributes('disabled')).toBeDefined()
    expect(passwordInput.attributes('disabled')).toBeDefined()

    const submitBtn = wrapper.find('button[type="submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()
    expect(submitBtn.find('svg.animate-spin').exists()).toBe(true)

    // Complete login
    resolveLogin(true)
    await loginPromise
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(pushMock).toHaveBeenCalledWith('/')
  })
})

