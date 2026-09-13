<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const isSignup = ref(false)
const email = ref('')
const password = ref('')
const displayName = ref('')
const formError = ref<string | null>(null)

async function handleSubmit() {
  formError.value = null

  if (!email.value.includes('@')) {
    formError.value = uiStore.direction === 'rtl' ? 'لطفاً یک ایمیل معتبر وارد کنید.' : 'Please enter a valid email address.'
    return
  }

  if (isSignup.value && password.value.length < 8) {
    formError.value = uiStore.direction === 'rtl' ? 'رمز عبور باید حداقل ۸ کاراکتر باشد.' : 'Password must be at least 8 characters.'
    return
  }

  let success = false
  if (isSignup.value) {
    success = await authStore.signup(email.value, password.value, displayName.value)
  } else {
    success = await authStore.login(email.value, password.value)
  }

  if (success) {
    router.push('/')
  } else if (authStore.error) {
    formError.value = authStore.error
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center bg-background p-4 sm:p-6 lg:p-8" :dir="uiStore.direction">
    <!-- Main Card -->
    <div class="w-full max-w-[400px] bg-card border border-border rounded-[14px] p-6 sm:p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
      
      <!-- Brand Header -->
      <div class="flex flex-col items-center gap-3 mb-8">
        <div class="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" fill="currentColor" fill-opacity="0.2"/>
            <path d="M12 6V18M6 12H18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="text-[22px] font-bold text-foreground tracking-tight">NeuralChat</h1>
      </div>

      <!-- Tabs Toggle -->
      <div class="flex bg-secondary p-1 rounded-lg mb-6">
        <button 
          :class="['flex-1 py-2 text-[13px] font-medium rounded-md transition-all duration-200', !isSignup ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground']" 
          @click="isSignup = false"
        >
          {{ uiStore.direction === 'rtl' ? 'ورود به حساب' : 'Sign In' }}
        </button>
        <button 
          :class="['flex-1 py-2 text-[13px] font-medium rounded-md transition-all duration-200', isSignup ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground']" 
          @click="isSignup = true"
        >
          {{ uiStore.direction === 'rtl' ? 'ثبت‌نام جدید' : 'Sign Up' }}
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="formError" class="bg-red-500/15 border border-red-500/40 text-red-400 px-3 py-2 rounded-lg text-xs mb-6 text-center">
        {{ formError }}
      </div>

      <!-- Form Elements -->
      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <div v-if="isSignup" class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-secondary-foreground">{{ uiStore.direction === 'rtl' ? 'نام نمایشی' : 'Display Name' }}</label>
          <input 
            v-model="displayName" 
            type="text" 
            class="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors" 
            :placeholder="uiStore.direction === 'rtl' ? 'نام شما' : 'Your name'" 
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-secondary-foreground">{{ uiStore.direction === 'rtl' ? 'ایمیل' : 'Email' }}</label>
          <input 
            v-model="email" 
            type="email" 
            required 
            class="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors" 
            placeholder="user@example.com" 
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-secondary-foreground">{{ uiStore.direction === 'rtl' ? 'رمز عبور' : 'Password' }}</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            class="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors" 
            placeholder="••••••••" 
          />
        </div>

        <button 
          type="submit" 
          class="mt-4 inline-flex items-center justify-center rounded-lg text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-[44px] px-4 py-2 w-full shadow-md" 
          :disabled="authStore.loading"
        >
          <span v-if="authStore.loading" class="animate-pulse">...</span>
          <span v-else>
            {{ isSignup
              ? (uiStore.direction === 'rtl' ? 'ایجاد حساب کاربری' : 'Create Account')
              : (uiStore.direction === 'rtl' ? 'ورود' : 'Sign In')
            }}
          </span>
        </button>
      </form>

      <!-- Back Link -->
      <div class="mt-8 text-center">
        <router-link to="/" class="text-xs font-medium text-primary hover:underline hover:text-primary/80 transition-colors">
          {{ uiStore.direction === 'rtl' ? '← بازگشت به گفتگوها' : '← Back to Chat' }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No custom CSS needed anymore, fully Tailwind! */
</style>
