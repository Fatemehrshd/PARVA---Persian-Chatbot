import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileModal from '../src/components/layout/ProfileModal.vue'
import { useUiStore } from '../src/stores/ui'

const { getProfile, updateProfile, uploadAvatar } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}))

vi.mock('../src/services/profile.service', () => ({
  profileService: {
    getProfile,
    updateProfile,
    uploadAvatar,
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
  },
}))

describe('ProfileModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getProfile.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'کاربر نمونه',
      username: 'sample_user',
      avatarUrl: null,
      role: 'user',
    })
    updateProfile.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'نام جدید',
      username: 'sample_user',
      avatarUrl: null,
      role: 'user',
    })
    uploadAvatar.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'نام جدید',
      username: 'sample_user',
      avatarUrl: 'https://cdn.example/avatar.png',
      role: 'user',
    })
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:avatar-preview'), revokeObjectURL: vi.fn() })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the modal mounted with a stable content height while switching tabs', async () => {
    const wrapper = mount(ProfileModal, { props: { isOpen: true }, attachTo: document.body })
    await flushPromises()

    const content = document.body.querySelector('.profile-modal-content') as HTMLElement
    expect(content).toBeTruthy()

    ;(document.body.querySelector('[role="tab"]') as HTMLElement).click()
    expect(document.body.querySelector('.profile-modal-content')).toBe(content)
  })

  it('submits profile changes and shows a success toast', async () => {
    const wrapper = mount(ProfileModal, { props: { isOpen: true }, attachTo: document.body })
    await flushPromises()
    const displayNameInput = document.body.querySelector('#profile-display-name') as HTMLInputElement
    displayNameInput.value = 'نام جدید'
    displayNameInput.dispatchEvent(new Event('input', { bubbles: true }))
    displayNameInput.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    document.body.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'نام جدید', username: 'sample_user' })
    expect(useUiStore().toasts.some((toast) => toast.type === 'success')).toBe(true)
  })

  it('previews the selected avatar and uploads it with Save profile', async () => {
    const wrapper = mount(ProfileModal, { props: { isOpen: true }, attachTo: document.body })
    await flushPromises()
    const fileInput = document.body.querySelector('#profile-avatar') as HTMLInputElement
    const file = new File(['image'], 'avatar.png', { type: 'image/png' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()

    expect((document.body.querySelector('.profile-avatar-image') as HTMLImageElement).src).toContain('blob:avatar-preview')
    document.body.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(uploadAvatar).toHaveBeenCalledWith(file)
    expect(Array.from(document.body.querySelectorAll('button')).some((button) => button.textContent?.includes('آپلود'))).toBe(false)
    expect(wrapper.exists()).toBe(true)
  })

  it('opens the hidden file picker from the plus avatar action', async () => {
    const wrapper = mount(ProfileModal, { props: { isOpen: true }, attachTo: document.body })
    await flushPromises()
    const fileInput = document.body.querySelector('#profile-avatar') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    await (document.body.querySelector('.profile-avatar-add') as HTMLButtonElement).click()

    expect(clickSpy).toHaveBeenCalledOnce()
    expect(wrapper.exists()).toBe(true)
  })

  it('uploads the avatar when username is left empty', async () => {
    const wrapper = mount(ProfileModal, { props: { isOpen: true }, attachTo: document.body })
    await flushPromises()
    const usernameInput = document.body.querySelector('#profile-username') as HTMLInputElement
    usernameInput.value = ''
    usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
    usernameInput.dispatchEvent(new Event('change', { bubbles: true }))

    const fileInput = document.body.querySelector('#profile-avatar') as HTMLInputElement
    const file = new File(['image'], 'avatar.png', { type: 'image/png' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    document.body.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'کاربر نمونه' })
    expect(uploadAvatar).toHaveBeenCalledWith(file)
    expect(wrapper.exists()).toBe(true)
  })

  it('clears an unsaved avatar preview when the modal is closed and reopened', async () => {
    const wrapper = mount(ProfileModal, { props: { isOpen: true }, attachTo: document.body })
    await flushPromises()
    const fileInput = document.body.querySelector('#profile-avatar') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [new File(['image'], 'avatar.png', { type: 'image/png' })] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('.profile-avatar-image')).toBeTruthy()

    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })
    await flushPromises()

    expect(document.body.querySelector('.profile-avatar-image')).toBeNull()
  })
})