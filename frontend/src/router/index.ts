import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'

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
      path: '/admin/models',
      name: 'admin-models',
      component: () => import('../views/AdminModelsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
})

router.beforeEach((to, _from, next) => {
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
