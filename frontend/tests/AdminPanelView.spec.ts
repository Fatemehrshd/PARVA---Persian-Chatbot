import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import AdminPanelView from '../src/views/AdminPanelView.vue'

const currentRoute = ref({ path: '/admin/dashboard' })

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute,
    push: vi.fn(() => Promise.resolve()),
  }),
}))

describe('AdminPanelView.vue', () => {
  it('shows the audit logs section in the admin navigation', () => {
    const wrapper = mount(AdminPanelView, {
      global: {
        plugins: [createPinia()],
        stubs: {
          AdminDashboardSection: true,
          AdminProvidersSection: true,
          AdminModelsSection: true,
          AdminUsersSection: true,
          AdminChatsSection: true,
          AdminFilesSection: true,
          AdminFileSettingsSection: true,
          AdminPromptsSection: true,
          AdminPlansSection: true,
          AdminSubscriptionsSection: true,
          AdminPaymentsSection: true,
          AdminCouponsSection: true,
          AdminAuditLogsSection: true,
          DeleteConfirmModal: true,
        },
      },
    })

    expect(wrapper.find('[data-admin-section="audit-logs"]').exists()).toBe(true)
  })
})