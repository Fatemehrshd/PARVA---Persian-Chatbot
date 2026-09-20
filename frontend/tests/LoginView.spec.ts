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

  it('validates strong password complexity during signup', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    // Switch to signup tab
    const buttons = wrapper.findAll('button[type="button"]')
    const signupTab = buttons.find(b => b.text().includes('ثبت‌نام') || b.text().includes('Sign Up'))
    await signupTab!.trigger('click')

    const nameInput = wrapper.find('#displayName')
    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('input[type="password"]')

    await nameInput.setValue('علی محمدی')
    await emailInput.setValue('user@example.com')
    await passwordInput.setValue('weakpass') // No uppercase, no number, no symbol

    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toMatch(/رمز عبور باید حداقل ۸ کاراکتر و شامل حروف بزرگ/i)
  })

  it('renders confirm password field and validates password match on signup', async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          'router-link': true,
        },
      },
    })

    // Initially in login mode: confirmPassword should not exist
    expect(wrapper.find('#confirmPassword').exists()).toBe(false)

    // Switch to signup tab
    const buttons = wrapper.findAll('button[type="button"]')
    const signupTab = buttons.find(b => b.text().includes('ثبت‌نام') || b.text().includes('Sign Up'))
    await signupTab!.trigger('click')

    // Confirm password should now be present
    const confirmInput = wrapper.find('#confirmPassword')
    expect(confirmInput.exists()).toBe(true)

    const nameInput = wrapper.find('#displayName')
    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('#password')

    await nameInput.setValue('علی محمدی')
    await emailInput.setValue('user@example.com')
    await passwordInput.setValue('Password123!')

    // Case 1: Empty confirm password
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('لطفاً تکرار رمز عبور را وارد کنید.')

    // Case 2: Mismatched passwords
    await confirmInput.setValue('DifferentPassword123!')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('رمز عبور و تکرار آن یکسان نیستند.')

    // Case 3: Matching passwords succeeds
    const authStore = useAuthStore()
    const signupSpy = vi.spyOn(authStore, 'signup').mockResolvedValue(true)
    await confirmInput.setValue('Password123!')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(signupSpy).toHaveBeenCalledWith('user@example.com', 'Password123!', 'علی محمدی')
    expect(pushMock).toHaveBeenCalledWith('/')
  })
})

