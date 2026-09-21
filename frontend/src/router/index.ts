import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'

import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatView,
      meta: { requiresAuth: true }
    },
    {
      path: '/chat',
      redirect: '/',
      meta: { requiresAuth: true }
    },
    {
      path: '/chat/:id',
      name: 'chat-conversation',
      component: ChatView,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/admin',
      component: () => import('../views/AdminPanelView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          redirect: '/admin/dashboard'
        },
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: () => import('../views/admin/AdminDashboardSection.vue')
        },
        {
          path: 'providers',
          name: 'admin-providers',
          component: () => import('../views/admin/AdminProvidersSection.vue')
        },
        {
          path: 'models',
          name: 'admin-models',
          component: () => import('../views/admin/AdminModelsSection.vue')
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('../views/admin/AdminUsersSection.vue')
        },
        {
          path: 'prompts',
          name: 'admin-prompts',
          component: () => import('../views/admin/AdminPromptsSection.vue')
        },
        {
          path: 'chats',
          name: 'admin-chats',
          component: () => import('../views/admin/AdminChatsSection.vue')
        },
        {
          path: 'files',
          name: 'admin-files',
          component: () => import('../views/admin/AdminFilesSection.vue')
        },
        {
          path: 'file-settings',
          name: 'admin-file-settings',
          component: () => import('../views/admin/AdminFileSettingsSection.vue')
        },
        {
          path: 'plans',
          name: 'admin-plans',
          component: () => import('../views/admin/AdminPlansSection.vue')
        },
        {
          path: 'subscriptions',
          name: 'admin-subscriptions',
          component: () => import('../views/admin/AdminSubscriptionsSection.vue')
        },
        {
          path: 'payments',
          name: 'admin-payments',
          component: () => import('../views/admin/AdminPaymentsSection.vue')
        },
        {
          path: 'coupons',
          name: 'admin-coupons',
          component: () => import('../views/admin/AdminCouponsSection.vue')
        },
        {
          path: 'audit-logs',
          name: 'admin-audit-logs',
          component: () => import('../views/admin/AdminAuditLogsSection.vue')
        }
      ]
    },
    {
      path: '/subscription',
      name: 'subscription',
      component: () => import('../views/SubscriptionView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/payment-result',
      name: 'payment-result',
      component: () => import('../views/PaymentResultView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/sandbox-gateway',
      name: 'sandbox-gateway',
      component: () => import('../views/SandboxGatewayMockView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/share/:shareCode',
      name: 'shared-chat',
      component: () => import('../views/SharedChatView.vue'),
      meta: { requiresAuth: false }
    }
  ]
})

router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('token')
  const isAuthenticated = !!token

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.meta.requiresAdmin) {
    const authStore = useAuthStore()
    try {
      await authStore.refreshIdentity()
    } catch {
      // keep the access check conservative when the identity re-sync fails
    }
    const isAdmin = authStore.identity?.role === 'admin'
    if (!isAdmin) {
      return next({ path: '/' })
    }
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return next({ path: '/' })
  }

  next()
})

export default router
