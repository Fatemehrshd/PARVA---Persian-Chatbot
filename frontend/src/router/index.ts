import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'

import { isTokenExpired } from '../lib/jwt'
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
        }
      ]
    }
  ]
})

router.beforeEach(async (to, _from, next) => {
  const rawToken = localStorage.getItem('token')

  // Check proactive token expiry
  if (rawToken && isTokenExpired(rawToken)) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('refreshToken')
  }

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
