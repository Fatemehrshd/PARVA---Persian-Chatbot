import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageGallery from '../src/components/chat/ImageGallery.vue'
import type { FileAttachmentItem } from '../src/types'

describe('ImageGallery.vue', () => {
  const mockImages: FileAttachmentItem[] = [
    {
      id: 'img-1',
      fileType: 'image',
      originalName: 'nature.png',
      fileSize: 1024 * 500, // 500 KB
      mimeType: 'image/png',
      status: 'ready',
      previewUrl: 'blob:http://localhost/nature',
    },
    {
      id: 'img-2',
      fileType: 'image',
      originalName: 'architecture.jpg',
      fileSize: 1024 * 1024 * 1.5, // 1.5 MB
      mimeType: 'image/jpeg',
      status: 'ready',
      previewUrl: 'blob:http://localhost/arch',
    },
    {
      id: 'img-3',
      fileType: 'image',
      originalName: 'sketch.png',
      fileSize: 2048,
      mimeType: 'image/png',
      status: 'ready',
      previewUrl: 'blob:http://localhost/sketch',
    },
  ]

  it('renders single image layout when only 1 image is passed', () => {
    const wrapper = mount(ImageGallery, {
      props: { images: [mockImages[0]] },
    })

    expect(wrapper.find('[data-testid="gallery-single-image"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="gallery-grid-2"]').exists()).toBe(false)
    expect(wrapper.find('img').attributes('src')).toBe('blob:http://localhost/nature')
  })

  it('renders 2-column grid when 2 images are passed', () => {
    const wrapper = mount(ImageGallery, {
      props: { images: [mockImages[0], mockImages[1]] },
    })

    expect(wrapper.find('[data-testid="gallery-grid-2"]').exists()).toBe(true)
    const items = wrapper.findAll('.gallery-grid-item')
    expect(items.length).toBe(2)
  })

  it('renders 3-column grid when 3 images are passed', () => {
    const wrapper = mount(ImageGallery, {
      props: { images: mockImages },
    })

    expect(wrapper.find('[data-testid="gallery-grid-3"]').exists()).toBe(true)
    const items = wrapper.findAll('.gallery-grid-item')
    expect(items.length).toBe(3)
  })

  it('renders multi-grid with +N count badge when more than 4 images are passed', () => {
    const fiveImages = [
      ...mockImages,
      { id: 'img-4', fileType: 'image', originalName: 'photo4.png', fileSize: 1000, mimeType: 'image/png', status: 'ready' as const },
      { id: 'img-5', fileType: 'image', originalName: 'photo5.png', fileSize: 1000, mimeType: 'image/png', status: 'ready' as const },
    ]

    const wrapper = mount(ImageGallery, {
      props: { images: fiveImages },
    })

    expect(wrapper.find('[data-testid="gallery-grid-multi"]').exists()).toBe(true)
    const badge = wrapper.find('[data-testid="gallery-more-count"]')
    expect(badge.exists()).toBe(true)
    // 5 - 3 = 2 more images
    expect(badge.text()).toContain('۲')
  })

  it('opens lightbox on image click and shows correct counter', async () => {
    const wrapper = mount(ImageGallery, {
      props: { images: mockImages },
      attachTo: document.body,
    })

    // Click second image
    const items = wrapper.findAll('.gallery-grid-item')
    await items[1].trigger('click')

    const lightbox = document.body.querySelector('[data-testid="gallery-lightbox"]')
    expect(lightbox).not.toBeNull()

    const counter = document.body.querySelector('[data-testid="gallery-counter"]')
    expect(counter?.textContent).toContain('۲')
    expect(counter?.textContent).toContain('۳')

    wrapper.unmount()
  })

  it('navigates next and previous images and wraps around', async () => {
    const wrapper = mount(ImageGallery, {
      props: { images: mockImages },
      attachTo: document.body,
    })

    // Open first image
    await wrapper.findAll('.gallery-grid-item')[0].trigger('click')

    const nextBtn = document.body.querySelector('[data-testid="gallery-next-btn"]') as HTMLButtonElement
    const prevBtn = document.body.querySelector('[data-testid="gallery-prev-btn"]') as HTMLButtonElement

    expect(nextBtn).not.toBeNull()
    expect(prevBtn).not.toBeNull()

    // Click next -> index 1
    nextBtn.click()
    await wrapper.vm.$nextTick()
    let counter = document.body.querySelector('[data-testid="gallery-counter"]')
    expect(counter?.textContent).toContain('۲')

    // Click next -> index 2
    nextBtn.click()
    await wrapper.vm.$nextTick()
    counter = document.body.querySelector('[data-testid="gallery-counter"]')
    expect(counter?.textContent).toContain('۳')

    // Click next -> wraps to index 0
    nextBtn.click()
    await wrapper.vm.$nextTick()
    counter = document.body.querySelector('[data-testid="gallery-counter"]')
    expect(counter?.textContent).toContain('۱')

    // Click prev -> wraps to index 2
    prevBtn.click()
    await wrapper.vm.$nextTick()
    counter = document.body.querySelector('[data-testid="gallery-counter"]')
    expect(counter?.textContent).toContain('۳')

    wrapper.unmount()
  })

  it('switches image when clicking on a thumbnail in the bottom strip', async () => {
    const wrapper = mount(ImageGallery, {
      props: { images: mockImages },
      attachTo: document.body,
    })

    // Open at index 0
    await wrapper.findAll('.gallery-grid-item')[0].trigger('click')

    // Click thumbnail 2 (index 2)
    const thumb2 = document.body.querySelector('[data-testid="gallery-thumb-2"]') as HTMLButtonElement
    expect(thumb2).not.toBeNull()
    thumb2.click()
    await wrapper.vm.$nextTick()

    const counter = document.body.querySelector('[data-testid="gallery-counter"]')
    expect(counter?.textContent).toContain('۳')
    expect(thumb2.classList.contains('active')).toBe(true)

    wrapper.unmount()
  })

  it('closes lightbox on close button click', async () => {
    const wrapper = mount(ImageGallery, {
      props: { images: mockImages },
      attachTo: document.body,
    })

    await wrapper.findAll('.gallery-grid-item')[0].trigger('click')
    expect(document.body.querySelector('[data-testid="gallery-lightbox"]')).not.toBeNull()

    const closeBtn = document.body.querySelector('[data-testid="gallery-close-btn"]') as HTMLButtonElement
    closeBtn.click()
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('[data-testid="gallery-lightbox"]')).toBeNull()

    wrapper.unmount()
  })
})
