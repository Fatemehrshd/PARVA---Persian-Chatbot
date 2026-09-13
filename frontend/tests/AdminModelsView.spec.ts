import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminModelsView from '../src/views/AdminModelsView.vue'

// Mock vue-router
const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe('AdminModelsView.vue (Dashboard)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockClear()
  })

  it('renders dashboard with KPI metric cards and models table', () => {
    const wrapper = mount(AdminModelsView)

    // Check dashboard header
    expect(wrapper.text()).toContain('ADMIN')
    expect(wrapper.find('.dashboard-table').exists()).toBe(true)
    expect(wrapper.findAll('.metric-card').length).toBe(4)
  })

  it('filters models using the search box', async () => {
    const wrapper = mount(AdminModelsView)

    const searchInput = wrapper.find('.search-input')
    expect(searchInput.exists()).toBe(true)

    await searchInput.setValue('gpt')
    // Table rows should filter to gpt models
    const rows = wrapper.findAll('.dashboard-table tbody tr.table-row')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].text().toLowerCase()).toContain('gpt')
  })

  it('can toggle the new model registration form', async () => {
    const wrapper = mount(AdminModelsView)

    // Initially form is closed
    expect(wrapper.find('form').exists()).toBe(false)

    // Click "New Model" button
    const buttons = wrapper.findAll('button')
    const newModelBtn = buttons.find(b => b.text().includes('New Model') || b.text().includes('مدل جدید'))
    expect(newModelBtn).toBeDefined()

    await newModelBtn!.trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('#modelName').exists()).toBe(true)
  })
})

