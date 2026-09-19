import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FilePreviewCard from '../src/components/chat/FilePreviewCard.vue'
import type { FileAttachmentItem } from '../src/types'

describe('FilePreviewCard.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 'fake-jwt-token')
  })

  it('renders a PDF attachment and opens modal on click', async () => {
    const file: FileAttachmentItem = {
      id: 'file-pdf-1',
      originalName: 'document.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 50,
      mimeType: 'application/pdf',
      status: 'ready',
      extractedText: 'این متن استخراج‌شده از پی‌دی‌اف است.',
    }

    const wrapper = mount(FilePreviewCard, {
      props: { file, readOnly: true },
      attachTo: document.body,
    })

    expect(wrapper.text()).toContain('document.pdf')
    expect(wrapper.text()).toContain('PDF')

    // Click card to open modal
    await wrapper.find('.file-preview-card').trigger('click')

    // Modal should be open in body (Teleport)
    const modal = document.querySelector('.file-modal-dialog')
    expect(modal).not.toBeNull()
    expect(modal?.textContent).toContain('document.pdf')
    expect(modal?.textContent).toContain('نمایش سند (PDF)')
    expect(modal?.textContent).toContain('متن استخراج‌شده')

    // Click on extracted text tab
    const tabs = document.querySelectorAll('.tab-btn')
    const extractedTab = Array.from(tabs).find((el) => el.textContent?.includes('متن استخراج‌شده'))
    expect(extractedTab).toBeDefined()
    await (extractedTab as HTMLElement).click()

    expect(document.querySelector('.extracted-text-pre')?.textContent).toContain(
      'این متن استخراج‌شده از پی‌دی‌اف است.',
    )

    wrapper.unmount()
  })

  it('renders a Markdown attachment and allows switching between markdown and raw tabs', async () => {
    const file: FileAttachmentItem = {
      id: 'file-md-1',
      originalName: 'notes.md',
      fileType: 'text',
      fileSize: 1024,
      mimeType: 'text/markdown',
      status: 'ready',
      extractedText: '# عنوان تست\nاین یک متن تستی است.',
    }

    const wrapper = mount(FilePreviewCard, {
      props: { file, readOnly: true },
      attachTo: document.body,
    })

    expect(wrapper.text()).toContain('notes.md')
    expect(wrapper.text()).toContain('MD')

    await wrapper.find('.file-preview-card').trigger('click')

    const modal = document.querySelector('.file-modal-dialog')
    expect(modal).not.toBeNull()
    expect(modal?.textContent).toContain('پیش‌نمایش مارک‌داون')
    expect(modal?.textContent).toContain('متن خام')

    // Switch to raw tab
    const tabs = document.querySelectorAll('.tab-btn')
    const rawTab = Array.from(tabs).find((el) => el.textContent?.includes('متن خام'))
    expect(rawTab).toBeDefined()
    await (rawTab as HTMLElement).click()

    expect(document.querySelector('.raw-text-pre')?.textContent).toContain('# عنوان تست')

    wrapper.unmount()
  })

  it('copies text content to clipboard when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    const file: FileAttachmentItem = {
      id: 'file-txt-1',
      originalName: 'log.txt',
      fileType: 'text',
      fileSize: 256,
      mimeType: 'text/plain',
      status: 'ready',
      extractedText: 'خط اول لاگ سرور\nخط دوم لاگ سرور',
    }

    const wrapper = mount(FilePreviewCard, {
      props: { file, readOnly: true },
      attachTo: document.body,
    })

    await wrapper.find('.file-preview-card').trigger('click')

    const copyBtn = document.querySelector('.copy-action-btn') as HTMLElement
    expect(copyBtn).not.toBeNull()
    await copyBtn.click()

    expect(writeTextMock).toHaveBeenCalledWith('خط اول لاگ سرور\nخط دوم لاگ سرور')

    wrapper.unmount()
  })

  it('closes preview modal on ESC keydown or close button click', async () => {
    const file: FileAttachmentItem = {
      id: 'file-esc-1',
      originalName: 'sample.txt',
      fileType: 'text',
      fileSize: 100,
      mimeType: 'text/plain',
      status: 'ready',
      extractedText: 'متن نمونه',
    }

    const wrapper = mount(FilePreviewCard, {
      props: { file, readOnly: true },
      attachTo: document.body,
    })

    await wrapper.find('.file-preview-card').trigger('click')
    expect(document.querySelector('.file-modal-dialog')).not.toBeNull()

    // Trigger ESC
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    // The modal should close
    expect(document.querySelector('.file-modal-dialog')).toBeNull()

    wrapper.unmount()
  })

  it('emits remove when remove button is clicked', async () => {
    const file: FileAttachmentItem = {
      id: 'temp-123',
      originalName: 'draft.txt',
      fileType: 'text',
      fileSize: 100,
      mimeType: 'text/plain',
      status: 'ready',
    }

    const wrapper = mount(FilePreviewCard, {
      props: { file, readOnly: false },
    })

    const removeBtn = wrapper.find('.btn-remove-corner')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([file])
  })
})
