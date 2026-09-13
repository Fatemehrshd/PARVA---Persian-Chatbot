<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

// Shadcn Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { useAsyncAction } from '../composables/useAsyncAction'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const isSignup = ref(false)
const email = ref('')
const password = ref('')
const displayName = ref('')
const formError = ref<string | null>(null)

const { isLoading, execute: submitAuth } = useAsyncAction(async () => {
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
})

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

  await submitAuth()
}
</script>

<template>
  <div class="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8" :dir="uiStore.direction">
    <div class="flex flex-col items-center gap-3 mb-8">
      <div class="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" fill="currentColor" fill-opacity="0.2"/>
          <path d="M12 6V18M6 12H18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">NeuralChat</h1>
    </div>

    <Card class="w-full max-w-[420px] shadow-2xl border-border bg-card">
      <CardHeader class="space-y-4 pb-4">
        <!-- Tabs Toggle -->
        <div class="flex bg-secondary p-1 rounded-lg">
          <button 
            :class="['flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200', !isSignup ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground']" 
            @click="isSignup = false"
            :disabled="isLoading"
            type="button"
          >
            {{ uiStore.direction === 'rtl' ? 'ورود به حساب' : 'Sign In' }}
          </button>
          <button 
            :class="['flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200', isSignup ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground']" 
            @click="isSignup = true"
            :disabled="isLoading"
            type="button"
          >
            {{ uiStore.direction === 'rtl' ? 'ثبت‌نام جدید' : 'Sign Up' }}
          </button>
        </div>

        <div>
          <CardTitle>{{ isSignup ? (uiStore.direction === 'rtl' ? 'ساخت حساب کاربری' : 'Create an account') : (uiStore.direction === 'rtl' ? 'خوش آمدید' : 'Welcome back') }}</CardTitle>
          <CardDescription>
            {{ isSignup ? (uiStore.direction === 'rtl' ? 'اطلاعات خود را وارد کنید.' : 'Enter your details below to create your account.') : (uiStore.direction === 'rtl' ? 'برای ورود اطلاعات خود را وارد کنید.' : 'Enter your email and password to sign in.') }}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent>
        <div v-if="formError" class="bg-destructive/15 border border-destructive/40 text-destructive px-3 py-2 rounded-lg text-xs mb-6 text-center">
          {{ formError }}
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="isSignup" class="space-y-2">
            <Label for="displayName">{{ uiStore.direction === 'rtl' ? 'نام نمایشی' : 'Display Name' }}</Label>
            <Input 
              id="displayName"
              v-model="displayName" 
              type="text" 
              :disabled="isLoading"
              :loading="isLoading"
              :placeholder="uiStore.direction === 'rtl' ? 'نام شما' : 'Your name'" 
            />
          </div>

          <div class="space-y-2">
            <Label for="email">{{ uiStore.direction === 'rtl' ? 'ایمیل' : 'Email' }}</Label>
            <Input 
              id="email"
              v-model="email" 
              type="email" 
              required 
              :disabled="isLoading"
              :loading="isLoading"
              placeholder="user@example.com" 
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="password">{{ uiStore.direction === 'rtl' ? 'رمز عبور' : 'Password' }}</Label>
            </div>
            <Input 
              id="password"
              v-model="password" 
              type="password" 
              required 
              :disabled="isLoading"
              :loading="isLoading"
              placeholder="••••••••" 
            />
          </div>

          <Button 
            type="submit" 
            class="w-full mt-2" 
            :loading="isLoading" 
            :disabled="isLoading"
          >
            {{ isSignup
              ? (uiStore.direction === 'rtl' ? 'ایجاد حساب کاربری' : 'Create Account')
              : (uiStore.direction === 'rtl' ? 'ورود' : 'Sign In')
            }}
          </Button>
        </form>
      </CardContent>

      <CardFooter class="flex justify-center border-t border-border pt-4 mt-2">
        <router-link to="/" class="text-sm font-medium text-primary hover:underline transition-colors">
          {{ uiStore.direction === 'rtl' ? '← بازگشت به گفتگوها' : '← Back to Chat' }}
        </router-link>
      </CardFooter>
    </Card>
  </div>
</template>
