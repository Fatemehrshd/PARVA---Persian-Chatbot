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
import GrokAurora from '@/components/ui/GrokAurora.vue'
import loginArtwork from '@/assets/login-artwork.jpg'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const isSignup = ref(false)
const email = ref('')
const password = ref('')
const displayName = ref('')
const showPassword = ref(false)
const formError = ref<string | null>(null)

const { isSubmitting: isLoading, submit: submitAuth } = useFormSubmit(async () => {
  let success = false
  if (isSignup.value) {
    success = await authStore.signup(email.value, password.value, displayName.value)
  } else {
    success = await authStore.login(email.value, password.value)
  }

  if (success) {
    uiStore.showToast(
      isSignup.value
        ? (uiStore.direction === 'rtl' ? 'حساب کاربری با موفقیت ایجاد شد.' : 'Account created successfully.')
        : (uiStore.direction === 'rtl' ? 'با موفقیت وارد شدید.' : 'Logged in successfully.'),
      'success'
    )
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
  <!-- Full Screen Two-Column Split with Grok Aurora Dynamic Mesh -->
  <div class="split-login-page relative overflow-hidden bg-background">
    <!-- Grok Fluid Aurora Background -->
    <GrokAurora :intensity="isLoading ? 'vibrant' : 'subtle'" />
    
    <!-- LEFT HALF: Form Pane (50%) -->
    <div class="form-half" :dir="uiStore.direction">
      <div class="form-wrapper">
        
        <!-- Brand Logo & Name Header -->
        <div class="flex items-center gap-3 mb-8">
          <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25 flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" fill="currentColor" fill-opacity="0.2"/>
              <path d="M12 6V18M6 12H18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="text-start">
            <span class="text-2xl font-bold tracking-tight text-foreground block leading-tight">NeuralChat</span>
            <span class="text-[11px] font-mono text-muted-foreground">AI Multi-Model Platform</span>
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
            @click="isSignup = false"
            :disabled="isLoading"
            type="button"
          >
            {{ uiStore.direction === 'rtl' ? 'ورود به حساب' : 'Sign In' }}
          </button>
          <button 
            :class="[
              'flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer',
              isSignup 
                ? 'bg-background text-foreground shadow-md border border-border/40 font-bold' 
                : 'text-muted-foreground hover:text-foreground'
            ]" 
            @click="isSignup = true"
            :disabled="isLoading"
            type="button"
          >
            {{ uiStore.direction === 'rtl' ? 'ثبت‌نام جدید' : 'Sign Up' }}
          </button>
        </div>

        <!-- Section Title & Description -->
        <div class="mb-6 text-start">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {{ isSignup 
              ? (uiStore.direction === 'rtl' ? 'ساخت حساب کاربری' : 'Create an Account') 
              : (uiStore.direction === 'rtl' ? 'ورود به حساب کاربری' : 'Welcome Back') 
            }}
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {{ isSignup 
              ? (uiStore.direction === 'rtl' ? 'مشخصات خود را برای دسترسی به پنل و مدل‌ها وارد کنید.' : 'Enter your details below to create your account.') 
              : (uiStore.direction === 'rtl' ? 'ایمیل و رمز عبور خود را برای ورود به سامانه وارد کنید.' : 'Enter your email and password to access your chats.') 
            }}
          </p>
        </div>

        <!-- Error Alert Banner -->
        <div 
          v-if="formError" 
          class="flex items-center gap-2.5 bg-destructive/15 border border-destructive/35 text-destructive px-4 py-3 rounded-xl text-xs mb-5 text-start leading-relaxed"
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
              {{ uiStore.direction === 'rtl' ? 'نام و نام‌خانوادگی' : 'Display Name' }}
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
                :placeholder="uiStore.direction === 'rtl' ? 'نام شما' : 'Your name'" 
              />
            </div>
          </div>

          <!-- Email Input -->
          <div class="space-y-1.5">
            <Label for="email" class="text-xs font-medium text-foreground/90">
              {{ uiStore.direction === 'rtl' ? 'نشانی ایمیل' : 'Email Address' }}
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
              />
            </div>
          </div>

          <!-- Password Input with Show/Hide Toggle -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <Label for="password" class="text-xs font-medium text-foreground/90">
                {{ uiStore.direction === 'rtl' ? 'رمز عبور' : 'Password' }}
              </Label>
              <span v-if="isSignup" class="text-[10px] text-muted-foreground font-mono">
                {{ uiStore.direction === 'rtl' ? 'حداقل ۸ کاراکتر' : 'min. 8 chars' }}
              </span>
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
              />
              <button 
                type="button" 
                class="absolute inset-y-0 end-2.5 flex items-center text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                @click="showPassword = !showPassword"
                :title="showPassword ? 'Hide password' : 'Show password'"
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
              {{ uiStore.direction === 'rtl' ? 'در حال برقراری ارتباط...' : 'Authenticating...' }}
            </span>
            <span v-else>
              {{ isSignup
                ? (uiStore.direction === 'rtl' ? 'ایجاد حساب کاربری' : 'Create Account')
                : (uiStore.direction === 'rtl' ? 'ورود به حساب' : 'Sign In')
              }}
            </span>
          </Button>
        </form>

        <!-- Back to Chat Link -->
    

      </div>
    </div>

    <!-- RIGHT HALF: Image Pane (Strictly 50% on the right side) -->
    <div class="image-half">
      <img 
        :src="loginArtwork" 
        alt="Neural Network Intelligence" 
        class="split-artwork-img"
      />
      <!-- Ambient dark gradient over the image -->
      <div class="split-artwork-gradient"></div>

      <!-- Overlay Tagline & Engine Badge on Image -->
      <div class="split-artwork-overlay" :dir="uiStore.direction">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 text-xs font-mono text-purple-300 backdrop-blur-md mb-3 w-fit shadow-lg">
          <span class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
          <span>NEURAL ENGINE • v2.0</span>
        </div>
        <h2 class="text-2xl lg:text-3xl font-extrabold text-white leading-tight drop-shadow-lg">
          {{ uiStore.direction === 'rtl' 
            ? 'سامانه یکپارچه پردازش هوش مصنوعی' 
            : 'Next-Generation Multi-Model AI Workspace' 
          }}
        </h2>
        <p class="text-xs sm:text-sm text-neutral-300 mt-2.5 max-w-md drop-shadow leading-relaxed">
          {{ uiStore.direction === 'rtl'
            ? 'ارتباط مستقیم و پرسرعت با موتورهای Claude 3.5 Sonnet، GPT-4o و Llama 3 به همراه استریم بلادرنگ و امنیت بالا.'
            : 'Real-time low-latency streaming connection to Claude 3.5 Sonnet, GPT-4o, and Llama 3 with end-to-end security.'
          }}
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Split Layout: Outer container is flex-row (direction: ltr) so Left is Form, Right is Image */
.split-login-page {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: row;
  direction: ltr; /* Keeps Left=Form and Right=Image side-by-side consistently */
  background-color: var(--background);
  overflow-x: hidden;
}

/* Left Half: Form Pane (Takes 50% on md/desktop, 100% on small mobile) */
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

/* Right Half: Image Pane (Takes exactly 50% on md/desktop) */
.image-half {
  display: none;
}

@media (min-width: 768px) {
  .image-half {
    display: block;
    flex: 1;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    background-color: #060708;
    border-inline-start: 1px solid var(--border);
  }
}

.split-artwork-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.split-artwork-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(14, 15, 17, 0.95) 0%,
    rgba(14, 15, 17, 0.4) 50%,
    transparent 100%
  );
  pointer-events: none;
}

.split-artwork-overlay {
  position: absolute;
  bottom: 0;
  inset-inline-start: 0;
  inset-inline-end: 0;
  padding: 48px 40px;
  z-index: 10;
  text-align: start;
}
</style>
