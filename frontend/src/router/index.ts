import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatView
    },
    {
      path: '/chat/:id',
      name: 'chat-conversation',
      component: ChatView
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/admin/models',
      name: 'admin-models',
      component: () => import('../views/AdminModelsView.vue')
    }
  ]
})

export default router
