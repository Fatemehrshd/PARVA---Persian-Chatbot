import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminModelsView from '../src/views/AdminModelsView.vue'
import { useModelsStore } from '../src/stores/models'
import { modelsService } from '../src/services/models.service'
import { adminService } from '../src/services/admin.service'

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
    const store = useModelsStore()
    vi.spyOn(modelsService, 'listModels').mockImplementation(async (params) => {
      const q = (params?.search || '').toLowerCase()
      const items = store.models.filter(m => !q || m.name.toLowerCase().includes(q) || m.apiIdentifier.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q))
      return { items, total: items.length }
    })
    vi.spyOn(modelsService, 'listProviders').mockResolvedValue([])
    vi.spyOn(adminService, 'listUsers').mockResolvedValue([] as any)
  })

  it('renders dashboard with KPI metric cards and models table', () => {
    const wrapper = mount(AdminModelsView)

    // Check dashboard header
    expect(wrapper.text()).toContain('ADMIN')
    expect(wrapper.find('.dashboard-table').exists()).toBe(true)
    expect(wrapper.findAll('.metric-card').length).toBe(5)
  })

  it('renders admin navigation and switches to the users view', async () => {
    const wrapper = mount(AdminModelsView)

    expect(wrapper.find('.admin-sidebar').exists()).toBe(true)
    expect(wrapper.find('[data-admin-section="dashboard"]').exists()).toBe(true)
    expect(wrapper.find('[data-admin-section="providers"]').exists()).toBe(true)
    expect(wrapper.find('[data-admin-section="models"]').exists()).toBe(true)
    expect(wrapper.find('[data-admin-section="users"]').exists()).toBe(true)
    expect(wrapper.find('[data-admin-section="prompts"]').exists()).toBe(true)
    expect(wrapper.find('[data-admin-section="chats"]').exists()).toBe(true)

    await wrapper.find('[data-admin-section="users"]').trigger('click')

    expect(wrapper.find('.users-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('کاربران')
  })

  it('filters models using the table search box and confirms no header search on dashboard', async () => {
    const wrapper = mount(AdminModelsView)

    // Header search is removed from Dashboard per user request
    expect(wrapper.find('.search-input').exists()).toBe(false)

    // Switch to models section where search is available
    await wrapper.find('[data-admin-section="models"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    const searchInput = wrapper.find('.search-text-input')
    expect(searchInput.exists()).toBe(true)

    vi.useFakeTimers()
    await searchInput.setValue('gpt')
    await vi.advanceTimersByTimeAsync(250)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // The async list request fired by the search must settle before asserting
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Table rows should filter to gpt models
    const rows = wrapper.findAll('.dashboard-table tbody tr.table-row')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].text().toLowerCase()).toContain('gpt')
    vi.useRealTimers()
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

  it('disables inputs and buttons during model registration loading', async () => {
    const wrapper = mount(AdminModelsView)

    // Open form
    const buttons = wrapper.findAll('button')
    const newModelBtn = buttons.find(b => b.text().includes('New Model') || b.text().includes('مدل جدید'))
    await newModelBtn!.trigger('click')

    // Fill inputs
    const nameInput = wrapper.find('#modelName')
    const apiInput = wrapper.find('#apiIdentifier')
    await nameInput.setValue('Custom Model')
    await apiInput.setValue('custom-model-v1')

    const modelsStore = useModelsStore()
    let resolveAddModel!: () => void
    const addModelPromise = new Promise<void>((resolve) => {
      resolveAddModel = resolve
    })
    vi.spyOn(modelsStore, 'addModel').mockImplementation(() => addModelPromise)

    // Submit form (don't await so we can inspect loading state)
    wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    // While loading, inputs and submit button should be disabled
    expect(nameInput.attributes('disabled')).toBeDefined()
    expect(apiInput.attributes('disabled')).toBeDefined()

    const submitBtn = wrapper.find('form button[type="submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()
    expect(submitBtn.find('svg.animate-spin').exists()).toBe(true)

    // Finish adding model
    resolveAddModel()
    await addModelPromise
    await flushPromises()

    // Form is closed on success
    expect(wrapper.find('form').exists()).toBe(false)
  })
})

