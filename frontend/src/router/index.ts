import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'

import { isTokenExpired } from '../lib/jwt'

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

router.beforeEach((to, _from, next) => {
  const rawToken = localStorage.getItem('token')

  // Check proactive token expiry
  if (rawToken && isTokenExpired(rawToken)) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('refreshToken')
  }

  const token = localStorage.getItem('token')
  const savedUser = localStorage.getItem('user')
  let role = 'user'
  if (savedUser) {
    try {
      role = JSON.parse(savedUser).role
    } catch {
      // invalid user JSON
    }
  }

  const isAuthenticated = !!token
  const isAdmin = role === 'admin'

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.meta.requiresAdmin && !isAdmin) {
    return next({ path: '/' })
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return next({ path: '/' })
  }

  next()
})

export default router
