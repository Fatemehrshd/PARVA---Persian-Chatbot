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

    expect(wrapper.text()).toMatch(/پروا|PARVA/)
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

  it('shows the inline Persian error for an email missing the @ (no native browser bubble)', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    // The form must suppress native HTML5 validation so the browser's English
    // bubble ("Please include an '@'...") can never appear.
    expect(wrapper.find('form').attributes('novalidate')).toBeDefined()

    const emailInput = wrapper.find('input[type="email"]')
    await emailInput.setValue('adminexample.com')

    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.text()).toMatch(/ایمیل معتبر/)
    // No auth request must have been attempted for an invalid email.
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows the same inline Persian error for an email missing the domain dot', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    const emailInput = wrapper.find('input[type="email"]')
    await emailInput.setValue('admin@example')

    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.text()).toMatch(/ایمیل معتبر/)
    expect(pushMock).not.toHaveBeenCalled()
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

  it('displays error message banner when password or username is incorrect', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    const authStore = useAuthStore()
    vi.spyOn(authStore, 'login').mockImplementation(async () => {
      authStore.error = 'ایمیل یا رمز عبور اشتباه است.'
      return false
    })

    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('input[type="password"]')
    await emailInput.setValue('user@example.com')
    await passwordInput.setValue('wrongpassword')

    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('ایمیل یا رمز عبور اشتباه است.')
  })
})

