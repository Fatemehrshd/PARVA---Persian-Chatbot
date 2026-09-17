<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

// Shadcn Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useFormSubmit } from '../composables/useFormSubmit'
import { useThemeLogo } from '../composables/useThemeLogo'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const { activeLogo } = useThemeLogo()

const isSignup = ref(false)
const email = ref('')
const password = ref('')
const displayName = ref('')
const showPassword = ref(false)
const formError = ref<string | null>(null)

function switchMode(signup: boolean) {
  isSignup.value = signup
  formError.value = null
}

const { isSubmitting: isLoading, submit: submitAuth } = useFormSubmit(async () => {
  let success = false
  if (isSignup.value) {
    success = await authStore.signup(email.value, password.value, displayName.value)
  } else {
    success = await authStore.login(email.value, password.value)
  }

  if (success) {
    uiStore.showToast(
      isSignup.value ? 'حساب کاربری با موفقیت ایجاد شد.' : 'با موفقیت وارد شدید.',
      'success'
    )
    router.push('/')
  } else {
    const fallbackMsg = isSignup.value ? 'ثبت‌نام با خطا مواجه شد.' : 'ایمیل یا رمز عبور اشتباه است.'
    const errorMsg = authStore.error || fallbackMsg
    formError.value = errorMsg
  }
})

async function handleSubmit() {
  formError.value = null

  if (isSignup.value && !displayName.value.trim()) {
    formError.value = 'لطفاً نام خود را وارد کنید.'
    return
  }

  if (!email.value.includes('@')) {
    formError.value = 'لطفاً یک ایمیل معتبر وارد کنید.'
    return
  }

  if (isSignup.value && password.value.length < 8) {
    formError.value = 'رمز عبور باید حداقل ۸ کاراکتر باشد.'
    return
  }

  await submitAuth()
}
</script>

<template>
  <div class="login-split-page">
    
    <!-- LEFT HALF: Artwork / Logo Pane -->
    <div class="artwork-half">
      <div class="artwork-glow" />
      
      <img 
        :src="activeLogo" 
        alt="پروا" 
        class="login-clean-logo"
      />
    </div>

    <!-- RIGHT HALF: Form Pane (Authentication Form on the right side) -->
    <div class="form-half" dir="rtl">
      <div class="form-wrapper">
        
        <!-- Brand Logo & Name Header -->
        <div class="flex items-center gap-3 mb-8">
          <div class="w-11 h-11 flex-shrink-0">
            <img :src="activeLogo" alt="پروا" class="w-full h-full object-cover" />
          </div>
          <div class="text-start">
            <span class="text-2xl font-bold tracking-tight text-foreground block leading-tight">پروا<span class="sr-only">PARVA</span></span>
          </div>
        </div>

        <!-- Tabs Switcher (Sign In / Sign Up) -->
        <div class="flex bg-secondary/80 p-1 rounded-xl border border-border/60 mb-6">
          <button 
            :class="[
              'flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
              !isSignup 
                ? 'bg-background text-foreground shadow-md border border-border/40 font-bold' 
                : 'text-muted-foreground hover:text-foreground'
            ]" 
            @click="switchMode(false)"
            :disabled="isLoading"
            type="button"
          >
            ورود به حساب
          </button>
          <button 
            :class="[
              'flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
              isSignup 
                ? 'bg-background text-foreground shadow-md border border-border/40 font-bold' 
                : 'text-muted-foreground hover:text-foreground'
            ]" 
            @click="switchMode(true)"
            :disabled="isLoading"
            type="button"
          >
            ثبت‌نام جدید
          </button>
        </div>

        <!-- Section Title & Description -->
        <div class="mb-6 text-start">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {{ isSignup ? 'ساخت حساب کاربری' : 'ورود به حساب کاربری' }}
          </h1>
        </div>

        <!-- Error Alert Banner (Single Borderless Message) -->
        <div 
          v-if="formError" 
          class="flex items-center gap-2.5 bg-destructive/15 text-destructive px-4 py-3 rounded-xl text-xs mb-5 text-start leading-relaxed border-none"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="flex-shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ formError }}</span>
        </div>

        <!-- Form Elements -->
        <form @submit.prevent="handleSubmit" class="space-y-4 text-start">
          
          <!-- Display Name (Signup Only) -->
          <div v-if="isSignup" class="space-y-1.5">
            <Label for="displayName" class="text-xs font-medium text-foreground/90">
              نام و نام‌خانوادگی
            </Label>
            <div class="relative">
              <span class="absolute inset-y-0 start-3 flex items-center pointer-events-none text-muted-foreground">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <Input 
                id="displayName"
                v-model="displayName" 
                type="text" 
                :disabled="isLoading"
                :loading="isLoading"
                class="ps-9 h-11 text-sm bg-secondary/40 border-border/60 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                placeholder="نام شما" 
                @input="formError = null"
              />
            </div>
          </div>

          <!-- Email Input -->
          <div class="space-y-1.5">
            <Label for="email" class="text-xs font-medium text-foreground/90">
              نشانی ایمیل
            </Label>
            <div class="relative">
              <span class="absolute inset-y-0 start-3 flex items-center pointer-events-none text-muted-foreground">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <Input 
                id="email"
                v-model="email" 
                type="email" 
                required 
                :disabled="isLoading"
                :loading="isLoading"
                class="ps-9 h-11 text-sm bg-secondary/40 border-border/60 focus-visible:ring-primary/40 focus-visible:border-primary transition-all font-mono text-[13px]"
                placeholder="user@example.com" 
                @input="formError = null"
              />
            </div>
          </div>

          <!-- Password Input with Show/Hide Toggle -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <Label for="password" class="text-xs font-medium text-foreground/90">
                رمز عبور
              </Label>
            </div>
            <div class="relative">
              <span class="absolute inset-y-0 start-3 flex items-center pointer-events-none text-muted-foreground">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <Input 
                id="password"
                v-model="password" 
                :type="showPassword ? 'text' : 'password'" 
                required 
                :disabled="isLoading"
                :loading="isLoading"
                class="ps-9 pe-10 h-11 text-sm bg-secondary/40 border-border/60 focus-visible:ring-primary/40 focus-visible:border-primary transition-all font-mono"
                placeholder="••••••••" 
                @input="formError = null"
              />
              <button 
                type="button" 
                class="absolute inset-y-0 end-2.5 flex items-center text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                @click="showPassword = !showPassword"
                title="نمایش یا پنهان‌سازی رمز عبور"
                tabindex="-1"
              >
                <svg v-if="!showPassword" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <Button 
            type="submit" 
            class="w-full h-11 mt-4 font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all text-sm rounded-lg" 
            :loading="isLoading" 
            :disabled="isLoading"
          >
            <span v-if="isLoading">
              در حال برقراری ارتباط...
            </span>
            <span v-else>
              {{ isSignup ? 'ایجاد حساب کاربری' : 'ورود به حساب' }}
            </span>
          </Button>
        </form>


      </div>
    </div>

  </div>
</template>

<style scoped>
/* Split Layout: Outer container is flex-row (ltr) so Left=Image, Right=Form */
.login-split-page {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: row;
  direction: ltr;
  background-color: var(--background);
  overflow-x: hidden;
}

/* Left Half: Artwork/Logo Pane — hidden on mobile, shown on md+ */
.artwork-half {
  display: none;
  position: relative;
}

@media (min-width: 768px) {
  .artwork-half {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 100vh;
    border-inline-end: 1px solid var(--border);
    padding: 40px;
    z-index: 5;
    background: transparent;
  }
}

/* Decorative glow behind logo */
.artwork-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, rgba(124, 106, 247, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

/* Right Half: Form Pane */
.form-half {
  flex: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background-color: var(--background);
  position: relative;
  z-index: 10;
}

.form-wrapper {
  width: 100%;
  max-width: 420px;
}

.login-clean-logo {
  max-width: 320px;
  max-height: 320px;
  width: 70%;
  height: auto;
  object-fit: contain;
  transition: opacity 300ms ease, transform 300ms ease;
}
</style>
