<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { X, UserRound, Mail, LockKeyhole, Plus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useFormSubmit } from '../../composables/useFormSubmit'
import { profileService } from '../../services/profile.service'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'
import type { UserProfile } from '../../types'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const uiStore = useUiStore()
const profile = ref<UserProfile | null>(null)
const isLoadingProfile = ref(false)
const activeTab = ref<'profile' | 'email' | 'password'>('profile')

const displayName = ref('')
const username = ref('')
const email = ref('')
const emailPassword = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreviewUrl = ref<string | null>(null)
const avatarInput = ref<HTMLInputElement | null>(null)

const open = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close')
  },
})

function syncProfile(nextProfile: UserProfile) {
  profile.value = nextProfile
  displayName.value = nextProfile.displayName ?? ''
  username.value = nextProfile.username ?? ''
  email.value = nextProfile.email
  authStore.updateUser(nextProfile)
}

async function loadProfile() {
  isLoadingProfile.value = true
  try {
    syncProfile(await profileService.getProfile())
  } catch (error: any) {
    uiStore.showToast(error?.message || 'دریافت پروفایل ناموفق بود.', 'error')
  } finally {
    isLoadingProfile.value = false
  }
}

const profileSubmit = useFormSubmit(
  async () => {
    const normalizedUsername = username.value.trim()
    let updatedProfile = await profileService.updateProfile({
      displayName: displayName.value.trim(),
      ...(normalizedUsername ? { username: normalizedUsername } : {}),
    })

    if (avatarFile.value) {
      updatedProfile = await profileService.uploadAvatar(avatarFile.value)
    }

    return updatedProfile
  },
  {
    successMessage: 'اطلاعات نمایه با موفقیت ذخیره شد.',
    showErrorToast: true,
    onSuccess: (result) => {
      syncProfile(result)
      avatarFile.value = null
      revokeAvatarPreview()
    },
  },
)

const emailSubmit = useFormSubmit(
  () => profileService.changeEmail({ email: email.value.trim().toLowerCase(), password: emailPassword.value }),
  {
    successMessage: 'ایمیل با موفقیت تغییر کرد.',
    showErrorToast: true,
    onSuccess: (result) => {
      syncProfile(result)
      emailPassword.value = ''
    },
  },
)

const passwordSubmit = useFormSubmit(
  async () => {
    if (newPassword.value !== confirmPassword.value) {
      throw new Error('تکرار رمز عبور با رمز جدید یکسان نیست.')
    }
    return profileService.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
  },
  {
    successMessage: 'رمز عبور با موفقیت تغییر کرد.',
    showErrorToast: true,
    onSuccess: () => {
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    },
  },
)

function selectAvatar(event: Event) {
  revokeAvatarPreview()
  avatarFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
  if (avatarFile.value) avatarPreviewUrl.value = URL.createObjectURL(avatarFile.value)
}

function openAvatarPicker() {
  avatarInput.value?.click()
}

function revokeAvatarPreview() {
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarPreviewUrl.value = null
}

function resetPendingAvatar() {
  avatarFile.value = null
  revokeAvatarPreview()
}

onBeforeUnmount(revokeAvatarPreview)

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      activeTab.value = 'profile'
      loadProfile()
    } else {
      resetPendingAvatar()
    }
  },
  { immediate: true },
)
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="profile-modal-overlay" />
      <DialogContent class="profile-modal-content" dir="rtl">
        <div class="profile-modal-header">
          <div>
            <DialogTitle class="profile-modal-title">
              نمایه کاربری
            </DialogTitle>
          </div>
          <DialogClose as-child>
            <Button variant="ghost" size="icon-sm" aria-label="بستن">
              <X :size="18" />
            </Button>
          </DialogClose>
        </div>

        <div class="profile-tabs" role="tablist">
          <button
            v-for="tab in [
              { id: 'profile', label: 'اطلاعات حساب', icon: UserRound },
              { id: 'email', label: 'ایمیل', icon: Mail },
              { id: 'password', label: 'رمز عبور', icon: LockKeyhole },
            ]"
            :key="tab.id"
            class="profile-tab"
            :class="{ 'profile-tab--active': activeTab === tab.id }"
            role="tab"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id as typeof activeTab"
          >
            <component :is="tab.icon" :size="15" />
            {{ tab.label }}
          </button>
        </div>

        <div class="profile-modal-body">
          <div v-if="isLoadingProfile" class="profile-skeleton" aria-label="در حال بارگذاری نمایه">
            <Skeleton class="h-16 w-16 rounded-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-2/3" />
          </div>

          <form v-else-if="activeTab === 'profile'" id="form-profile" class="profile-form" @submit.prevent="profileSubmit.submit()">
            <div class="profile-avatar-row">
              <div class="profile-avatar-picker">
                <img v-if="avatarPreviewUrl || profile?.avatarUrl" :src="avatarPreviewUrl || profile?.avatarUrl || undefined" alt="" class="profile-avatar profile-avatar-image" />
                <div v-else class="profile-avatar">{{ displayName?.charAt(0) || email.charAt(0) || 'U' }}</div>
                <button
                  type="button"
                  class="profile-avatar-add"
                  aria-label="انتخاب تصویر نمایه"
                  title="انتخاب تصویر نمایه"
                  :disabled="profileSubmit.isSubmitting.value"
                  @click="openAvatarPicker"
                >
                  <Plus :size="14" />
                </button>
                <input
                  id="profile-avatar"
                  ref="avatarInput"
                  class="profile-avatar-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  :disabled="profileSubmit.isSubmitting.value"
                  @change="selectAvatar"
                />
              </div>
              <div>
                <p class="profile-account-name">{{ displayName || email }}</p>
                <p class="profile-account-email">{{ email }}</p>
              </div>
            </div>
            <div class="profile-field">
              <Label for="profile-display-name">نام نمایشی</Label>
              <Input id="profile-display-name" v-model="displayName" :loading="profileSubmit.isSubmitting.value" maxlength="60" />
            </div>
            <div class="profile-field">
              <Label for="profile-username">نام کاربری</Label>
              <Input id="profile-username" v-model="username" :loading="profileSubmit.isSubmitting.value" placeholder="username" />
            </div>
          </form>

          <form v-else-if="activeTab === 'email'" id="form-email" class="profile-form" @submit.prevent="emailSubmit.submit()">
            <div class="profile-tab-intro"><Mail :size="20" /><span>برای تغییر ایمیل، رمز عبور فعلی لازم است.</span></div>
            <div class="profile-field">
              <Label for="profile-email">ایمیل جدید</Label>
              <Input id="profile-email" v-model="email" type="email" :loading="emailSubmit.isSubmitting.value" required />
            </div>
            <div class="profile-field">
              <Label for="profile-email-password">رمز عبور فعلی</Label>
              <Input id="profile-email-password" v-model="emailPassword" type="password" :loading="emailSubmit.isSubmitting.value" required />
            </div>
          </form>

          <form v-else id="form-password" class="profile-form" @submit.prevent="passwordSubmit.submit()">
            <div class="profile-tab-intro"><LockKeyhole :size="20" /><span>رمز عبور جدید باید حداقل ۸ کاراکتر باشد.</span></div>
            <div class="profile-field">
              <Label for="profile-current-password">رمز عبور فعلی</Label>
              <Input id="profile-current-password" v-model="currentPassword" type="password" :loading="passwordSubmit.isSubmitting.value" required />
            </div>
            <div class="profile-field">
              <Label for="profile-new-password">رمز عبور جدید</Label>
              <Input id="profile-new-password" v-model="newPassword" type="password" minlength="8" :loading="passwordSubmit.isSubmitting.value" required />
            </div>
            <div class="profile-field">
              <Label for="profile-confirm-password">تکرار رمز عبور جدید</Label>
              <Input id="profile-confirm-password" v-model="confirmPassword" type="password" :loading="passwordSubmit.isSubmitting.value" required />
            </div>
          </form>
        </div>

        <!-- Footer مشترک برای همه تب‌ها -->
        <div v-if="!isLoadingProfile" class="profile-modal-footer">
          <Button
            v-if="activeTab === 'profile'"
            type="submit"
            form="form-profile"
            :loading="profileSubmit.isSubmitting.value"
            :disabled="isLoadingProfile"
          >
            ذخیره اطلاعات
          </Button>
          <Button
            v-else-if="activeTab === 'email'"
            type="submit"
            form="form-email"
            :loading="emailSubmit.isSubmitting.value"
          >
            تغییر ایمیل
          </Button>
          <Button
            v-else
            type="submit"
            form="form-password"
            :loading="passwordSubmit.isSubmitting.value"
          >
            تغییر رمز عبور
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.profile-modal-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.62); backdrop-filter: blur(5px); }
.profile-modal-content { position: fixed; top: 50%; left: 50%; z-index: 51; box-sizing: border-box; width: min(640px, calc(100svw - 32px)); max-width: calc(100svw - 32px); height: min(620px, calc(100svh - 32px)); max-height: calc(100svh - 32px); margin: 0; transform: translate(-50%, -50%); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--card); color: var(--foreground); box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38); }
.profile-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px 16px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--secondary) 38%, transparent); }
.profile-modal-title { font-size: 18px; font-weight: 700; }
.profile-modal-description { margin-top: 4px; color: var(--muted-foreground); font-size: 12px; }
.profile-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 12px 20px 0; border-bottom: 1px solid var(--border); }
.profile-tab { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-bottom: 2px solid transparent; color: var(--muted-foreground); font-size: 13px; }
.profile-tab:hover, .profile-tab--active { color: var(--primary); }
.profile-tab--active { border-bottom-color: var(--primary); font-weight: 600; }
.profile-modal-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 24px; }
.profile-skeleton, .profile-form { min-height: 390px; height: 100%; display: flex; flex-direction: column; gap: 18px; }
.profile-skeleton { align-items: flex-start; }
.profile-field { display: flex; flex-direction: column; gap: 8px; }
.profile-helper { color: var(--muted-foreground); font-size: 11px; }
.profile-avatar-row { display: flex; align-items: center; gap: 14px; min-width: 0; padding-bottom: 8px; }
.profile-avatar { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-hover)); color: white; font-size: 22px; font-weight: 700; }
.profile-avatar-image { object-fit: cover; }
.profile-avatar-picker { position: relative; width: 64px; height: 64px; flex-shrink: 0; }
.profile-avatar-add { position: absolute; right: -4px; bottom: -4px; width: 23px; height: 23px; display: grid; place-items: center; border: 1px solid var(--card); border-radius: 50%; background: var(--primary); color: var(--primary-foreground); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); }
.profile-avatar-add:hover { background: var(--primary-hover); }
.profile-avatar-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
.profile-account-name, .profile-account-email { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-account-name { font-size: 15px; font-weight: 600; }
.profile-account-email { margin-top: 2px; color: var(--muted-foreground); font-size: 12px; }
.profile-tab-intro { display: flex; align-items: flex-start; gap: 10px; min-height: 48px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--muted-foreground); font-size: 12px; }
.profile-tab-intro svg { flex-shrink: 0; color: var(--primary); }
.profile-form-actions { display: flex; justify-content: flex-start; margin-top: auto; padding-top: 12px; }
.profile-modal-footer { display: flex; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--border); background: color-mix(in srgb, var(--secondary) 38%, transparent); }
@media (max-width: 640px) {
  .profile-modal-content { width: calc(100svw - 24px); max-width: calc(100svw - 24px); height: min(620px, calc(100svh - 24px)); max-height: calc(100svh - 24px); border-radius: var(--radius); }
  .profile-modal-header { gap: 10px; padding: 16px; }
  .profile-modal-title { font-size: 16px; }
  .profile-modal-description { font-size: 11px; }
  .profile-tabs { grid-template-columns: repeat(3, minmax(112px, 1fr)); overflow-x: auto; padding: 10px 12px 0; }
  .profile-tab { min-height: 40px; font-size: 11px; white-space: nowrap; }
  .profile-modal-body { padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); }
  .profile-skeleton, .profile-form { min-height: 360px; height: 100%; gap: 14px; }
  .profile-form-actions { padding-top: 8px; }
  .profile-form-actions :deep(button) { width: 100%; }
  .profile-modal-footer { padding: 12px 16px; }
  .profile-modal-footer :deep(button) { width: 100%; }
}
@media (max-width: 380px) {
  .profile-modal-content { width: calc(100svw - 16px); max-width: calc(100svw - 16px); height: min(620px, calc(100svh - 16px)); max-height: calc(100svh - 16px); }
  .profile-modal-header { padding: 14px 12px; }
  .profile-modal-body { padding-inline: 12px; }
  .profile-tabs { padding-inline: 8px; }
  .profile-avatar-row { gap: 10px; }
}
</style>