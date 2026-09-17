<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Sparkles,
  MessageSquare,
  Loader2,
} from '@lucide/vue'
import { useModelsStore } from '../stores/models'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { modelsService } from '../services/models.service'
import { adminService } from '../services/admin.service'
import AdminModal from '../components/admin/AdminModal.vue'
import AdminTable from '../components/admin/AdminTable.vue'
import DeleteConfirmModal from '../components/admin/DeleteConfirmModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseToggle from '../components/ui/BaseToggle.vue'
import { useDisclosure } from '../composables/useDisclosure'
import type {
  AdminDashboardStats,
  AdminUser,
  Model,
  Provider,
  UpdateAdminUserRequest,
  AdminConversationSummary,
  AdminConversationDetail,
} from '../types'

// Nav icons — blue for light mode, white for dark mode
import logoBlue from '../assets/logo-blue.png'
import logoWhite from '../assets/logo-white.png'
import providersBlue from '../assets/providers-blue.svg'
import providersWhite from '../assets/providers-white.svg'
import modelsBlue from '../assets/moelel-blue.svg'
import modelsWhite from '../assets/models-white.svg'
import usersBlue from '../assets/users-blue.svg'
import usersWhite from '../assets/users-white.svg'

const router = useRouter()
const modelsStore = useModelsStore()
const uiStore = useUiStore()
const authStore = useAuthStore()

const activeSection = ref<'dashboard' | 'providers' | 'models' | 'users' | 'prompts' | 'chats'>('dashboard')
const sidebarOpen = ref(false)

// 3-Second Search Debounce
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const isSearchDebouncing = ref(false)
let searchDebounceTimer: any = null

watch(searchQuery, (newVal) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  if (!newVal.trim()) {
    isSearchDebouncing.value = false
    debouncedSearchQuery.value = ''
    return
  }
  isSearchDebouncing.value = true
  searchDebounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newVal
    isSearchDebouncing.value = false
  }, 3000)
})

const isSaving = ref(false)
const errorMessage = ref('')
const providers = ref<Provider[]>([])
const users = ref<AdminUser[]>([])
const stats = ref<AdminDashboardStats | null>(null)
const conversations = ref<AdminConversationSummary[]>([])
const isLoadingConversations = ref(false)

// Chat Inspection Modal State
const isChatModalOpen = ref(false)
const inspectingConversation = ref<AdminConversationDetail | null>(null)
const isLoadingChatDetail = ref(false)

// Modals state
const modelModalOpen = ref(false)
const providerModalOpen = ref(false)
const userModalOpen = ref(false)
const settingsModalOpen = ref(false)
const deleteModalOpen = ref(false)
const deleteTarget = ref<{ type: 'model' | 'provider' | 'conversation'; id: string; name: string } | null>(null)

// Selected entities for editing
const editingModel = ref<Model | null>(null)
const editingProvider = ref<Provider | null>(null)
const editingUser = ref<AdminUser | null>(null)
const selectedProvider = ref<Provider | null>(null)

const providerModelsModal = useDisclosure()

// Form states
const modelForm = ref({
  name: '',
  provider: '',
  providerId: '',
  apiIdentifier: '',
  baseUrl: '',
  apiKey: '',
  isActive: true,
})

const providerForm = ref({
  name: '',
  baseUrl: '',
  apiKey: '',
  isActive: true,
})

const userForm = ref<{
  displayName: string
  email: string
  role: 'user' | 'admin'
  usedTokens: number
  tokenLimit: number | null
}>({
  displayName: '',
  email: '',
  role: 'user',
  usedTokens: 0,
  tokenLimit: null,
})

const DEFAULT_SYSTEM_PROMPT =
  'شما یک دستیار هوشمند، حرفه‌ای و دقیق فارسی‌زبان به نام «پروا» هستید که به کاربران در زمینه‌های مختلف کمک می‌کنید. پاسخ‌های شما همواره ساختاریافته، مودبانه و مستند است.'

const PROMPT_PRESETS = [
  {
    name: 'دستیار عمومی پروا',
    description: 'پاسخ‌دهی دقیق، ساختاریافته و محترمانه به تمام پرسش‌های عمومی کاربران به زبان فارسی.',
    prompt: DEFAULT_SYSTEM_PROMPT,
  },
  {
    name: 'متخصص برنامه‌نویسی و توسعه نرم‌افزار',
    description: 'تمرکز بر کدهای بهینه، تمیز، امنیت کد، اصول Clean Code و ارائه توضیحات مرحله‌به‌مرحله با نمونه کد.',
    prompt:
      'شما یک مهندس ارشد نرم‌افزار و معمار سیستم هستید. پاسخ‌های شما بر پایه بهترین الگوهای طراحی (Best Practices)، کدهای تمیز، رعایت نکات امنیتی و معماری مقیاس‌پذیر ارائه می‌شود. قبل از ارائه کد، ساختار منطق را به اختصار بیان کنید و در صورت نیاز تست‌های پیشنهادی ارائه دهید.',
  },
  {
    name: 'ویراستار و نگارنده رسمی متون',
    description: 'نگارش و ویرایش متون، رعایت دقیق دستور زبان فارسی و نیم‌فاصله‌ها، لحن فاخر و اداری.',
    prompt:
      'شما یک ویراستار و ادیب کارکشته زبان و ادبیات فارسی هستید. وظیفه شما بازنویسی، روان‌سازی و پیرایش متون ارسالی است. کلیه اصول رسم‌الخط، نشانه‌گذاری استاندارد، نیم‌فاصله‌ها و پالایش کلمات نامانوس را با دقت فراوان لحاظ فرمایید.',
  },
  {
    name: 'مشاور تحلیلی و حل مسئله',
    description: 'تحلیل داده‌ها، استدلال منطقی مرحله‌به‌مرحله و ارائه راهکارهای تصمیم‌گیری.',
    prompt:
      'شما یک مشاور استراتژیک و تحلیل‌گر ارشد حل مسئله هستید. برای بررسی هر موضوع، ابتدا آن را به اجزای کوچک‌تر بشکنید، جوانب مثبت و منفی و سناریوهای مختلف را ارزیابی کنید و راهکار عملیاتی با اولویت‌بندی ارائه فرمایید.',
  },
]

const settingsForm = ref({
  globalTokenLimit: 0,
  systemPrompt: '',
  fileMaxSizeMb: 20,
  fileMaxTotalSizeMb: 50,
  fileMaxCount: 5,
})

// Persian Labels
const labels = {
  dashboard: 'داشبورد',
  providers: 'ارائه‌دهنده‌ها',
  models: 'مدل‌ها',
  users: 'کاربران و سهمیه',
  prompts: 'پرامپت سیستم',
  chats: 'گفتگوها',
  back: 'بازگشت به چت',
  add: 'افزودن',
  save: 'ذخیره تغییرات',
  cancel: 'انصراف',
  active: 'فعال',
  inactive: 'غیرفعال',
  noData: 'داده‌ای برای نمایش وجود ندارد.',
  search: 'جستجو در این بخش...',
  edit: 'ویرایش',
  remove: 'حذف',
  default: 'پیش‌فرض',
  usersTitle: 'مدیریت کاربران و مصرف توکن',
  providersTitle: 'مدیریت ارائه‌دهنده‌های هوش مصنوعی',
  modelsTitle: 'مدل‌های هوش مصنوعی',
  dashboardTitle: 'داشبورد مدیریت سیستم',
  promptsTitle: 'مدیریت دستورالعمل سراسری سیستم (System Prompt)',
  chatsTitle: 'مشاهده و بازبینی گفتگوهای کاربران',
  totalUsers: 'کل کاربران',
  totalModels: 'مدل‌های ثبت‌شده',
  totalProviders: 'ارائه‌دهنده‌ها',
  tokens: 'مجموع مصرف توکن',
  addProvider: 'ارائه‌دهنده جدید',
  addModel: 'مدل جدید',
  modelName: 'نام مدل',
  provider: 'ارائه‌دهنده',
  apiId: 'شناسه API',
  baseUrl: 'آدرس API (Base URL)',
  apiKey: 'کلید API (API Key)',
  name: 'نام',
  user: 'کاربر',
  role: 'نقش کاربری',
  conversations: 'گفتگوها',
  usedTokens: 'توکن مصرفی',
  tokenLimit: 'سقف توکن اختصاصی',
  globalLimit: 'سقف سراسری توکن',
  systemPrompt: 'دستورالعمل سیستم (System Prompt)',
  unlimited: 'نامحدود',
  status: 'وضعیت',
  actions: 'عملیات',
  modelCount: 'مدل',
}

const navItems = computed(() => {
  const isDark = uiStore.theme === 'dark'
  return [
    { id: 'dashboard', label: labels.dashboard, icon: isDark ? logoWhite : logoBlue, iconType: 'img' },
    { id: 'providers', label: labels.providers, icon: isDark ? providersWhite : providersBlue, iconType: 'img' },
    { id: 'models', label: labels.models, icon: isDark ? modelsWhite : modelsBlue, iconType: 'img' },
    { id: 'users', label: labels.users, icon: isDark ? usersWhite : usersBlue, iconType: 'img' },
    { id: 'prompts', label: labels.prompts, icon: Sparkles, iconType: 'component' },
    { id: 'chats', label: labels.chats, icon: MessageSquare, iconType: 'component' },
  ]
})

// Search filters based on debounced search query (3-second delay)
const filteredModels = computed(() => {
  const query = debouncedSearchQuery.value.trim().toLowerCase()
  if (!query) return modelsStore.models
  return modelsStore.models.filter((model) =>
    [model.name, model.provider, model.apiIdentifier].some((val) =>
      val.toLowerCase().includes(query)
    )
  )
})

const filteredProviders = computed(() => {
  const query = debouncedSearchQuery.value.trim().toLowerCase()
  if (!query) return providers.value
  return providers.value.filter((provider) =>
    provider.name.toLowerCase().includes(query) ||
    (provider.baseUrl || '').toLowerCase().includes(query)
  )
})

const filteredUsers = computed(() => {
  const query = debouncedSearchQuery.value.trim().toLowerCase()
  if (!query) return users.value
  return users.value.filter((user) =>
    [user.email, user.displayName || '', user.username || '', user.role].some((val) =>
      val.toLowerCase().includes(query)
    )
  )
})

const filteredChats = computed(() => {
  const query = debouncedSearchQuery.value.trim().toLowerCase()
  if (!query) return conversations.value
  return conversations.value.filter((c) =>
    c.title.toLowerCase().includes(query) ||
    (c.user?.email && c.user.email.toLowerCase().includes(query)) ||
    (c.user?.displayName && c.user.displayName.toLowerCase().includes(query))
  )
})

const providerModels = (provider: Provider) =>
  modelsStore.models.filter(
    (model) => model.providerId === provider.id || model.provider === provider.name
  )
const activeModelsCount = computed(() => modelsStore.models.filter((model) => model.isActive).length)

// Table column definitions
const dashboardModelColumns = [
  { key: 'name', label: labels.modelName },
  { key: 'provider', label: labels.provider },
  { key: 'apiIdentifier', label: labels.apiId },
  { key: 'isActive', label: labels.status },
]

const fullModelColumns = [
  { key: 'name', label: labels.modelName },
  { key: 'provider', label: labels.provider },
  { key: 'apiIdentifier', label: labels.apiId },
  { key: 'isActive', label: labels.status },
  { key: 'actions', label: labels.actions, align: 'left' as const },
]

const userColumns = [
  { key: 'user', label: labels.user },
  { key: 'role', label: labels.role },
  { key: 'conversations', label: labels.conversations },
  { key: 'usedTokens', label: labels.usedTokens },
  { key: 'tokenLimit', label: labels.tokenLimit },
  { key: 'isActive', label: labels.status },
  { key: 'actions', label: labels.actions, align: 'left' as const },
]

const chatColumns = [
  { key: 'title', label: 'عنوان گفتگو' },
  { key: 'user', label: 'کاربر' },
  { key: 'messageCount', label: 'تعداد پیام‌ها' },
  { key: 'updatedAt', label: 'تاریخ آخرین فعالیت' },
  { key: 'actions', label: labels.actions, align: 'left' as const },
]

function selectSection(section: typeof activeSection.value) {
  activeSection.value = section
  sidebarOpen.value = false
  searchQuery.value = ''
  debouncedSearchQuery.value = ''
  isSearchDebouncing.value = false
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
}

// Model handlers
function openModelEditor(model?: Model) {
  editingModel.value = model || null
  if (model) {
    modelForm.value = {
      name: model.name,
      provider: model.provider,
      providerId: model.providerId || '',
      apiIdentifier: model.apiIdentifier,
      baseUrl: model.baseUrl || '',
      apiKey: '',
      isActive: model.isActive,
    }
  } else {
    modelForm.value = {
      name: '',
      provider: providers.value[0]?.name || '',
      providerId: providers.value[0]?.id || '',
      apiIdentifier: '',
      baseUrl: '',
      apiKey: '',
      isActive: true,
    }
  }
  modelModalOpen.value = true
  errorMessage.value = ''
}

async function saveModel() {
  if (!modelForm.value.name.trim() || !modelForm.value.apiIdentifier.trim()) return
  isSaving.value = true
  errorMessage.value = ''
  try {
    const provider =
      providers.value.find((item) => item.id === modelForm.value.providerId) ||
      providers.value.find((item) => item.name === modelForm.value.provider)
    const payload = {
      name: modelForm.value.name.trim(),
      provider: provider?.name || modelForm.value.provider.trim(),
      providerId: provider?.id || undefined,
      apiIdentifier: modelForm.value.apiIdentifier.trim(),
      baseUrl: modelForm.value.baseUrl.trim() || undefined,
      apiKey: modelForm.value.apiKey.trim() || undefined,
      isActive: modelForm.value.isActive,
    }

    if (editingModel.value) {
      await modelsService.updateModel(editingModel.value.id, payload)
    } else {
      await modelsStore.addModel(payload)
    }
    modelModalOpen.value = false
    await modelsStore.fetchModels(true).catch(() => {})
    uiStore.showToast(editingModel.value ? 'مدل با موفقیت ویرایش شد.' : 'مدل جدید با موفقیت اضافه شد.', 'success')
  } catch (error: any) {
    errorMessage.value = error?.message || 'ذخیره اطلاعات مدل با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

async function toggleModel(model: Model) {
  try {
    await modelsService.updateModelStatus(model.id, !model.isActive)
    await modelsStore.fetchModels(true)
    uiStore.showToast(`وضعیت مدل «${model.name}» تغییر کرد.`, 'info')
  } catch (error: any) {
    errorMessage.value = error?.message || 'تغییر وضعیت مدل با خطا مواجه شد'
  }
}

async function setPlatformDefault(model: Model) {
  try {
    await modelsService.setDefaultModel(model.id)
    await modelsStore.fetchModels(true)
    uiStore.showToast(`مدل «${model.name}» به عنوان پیش‌فرض پلتفرم انتخاب شد.`, 'success')
  } catch (error: any) {
    errorMessage.value = error?.message || 'تنظیم مدل پیش‌فرض با خطا مواجه شد'
  }
}

function promptDeleteModel(model: Model) {
  deleteTarget.value = { type: 'model', id: model.id, name: model.name }
  deleteModalOpen.value = true
}

// Provider handlers
function openProviderEditor(provider?: Provider) {
  editingProvider.value = provider || null
  if (provider) {
    providerForm.value = {
      name: provider.name,
      baseUrl: provider.baseUrl || '',
      apiKey: '',
      isActive: provider.isActive,
    }
  } else {
    providerForm.value = {
      name: '',
      baseUrl: '',
      apiKey: '',
      isActive: true,
    }
  }
  providerModalOpen.value = true
  errorMessage.value = ''
}

async function saveProvider() {
  if (!providerForm.value.name.trim()) return
  isSaving.value = true
  errorMessage.value = ''
  try {
    const payload = {
      name: providerForm.value.name.trim(),
      baseUrl: providerForm.value.baseUrl.trim() || undefined,
      apiKey: providerForm.value.apiKey.trim() || undefined,
      isActive: providerForm.value.isActive,
    }

    if (editingProvider.value) {
      await modelsService.updateProvider(editingProvider.value.id, payload)
    } else {
      await modelsService.createProvider(payload)
    }
    const data = await modelsService.listProviders()
    providers.value = Array.isArray(data) ? data : []
    await modelsStore.fetchModels(true)
    providerModalOpen.value = false
    uiStore.showToast(editingProvider.value ? 'ارائه‌دهنده با موفقیت ویرایش شد.' : 'ارائه‌دهنده جدید اضافه شد.', 'success')
  } catch (error: any) {
    errorMessage.value = error?.message || 'ذخیره اطلاعات ارائه‌دهنده با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

async function toggleProvider(provider: Provider) {
  try {
    await modelsService.updateProviderStatus(provider.id, !provider.isActive)
    const data = await modelsService.listProviders()
    providers.value = Array.isArray(data) ? data : []
    await modelsStore.fetchModels(true)
    uiStore.showToast(`وضعیت ارائه‌دهنده «${provider.name}» تغییر کرد.`, 'info')
  } catch (error: any) {
    errorMessage.value = error?.message || 'تغییر وضعیت ارائه‌دهنده با خطا مواجه شد'
  }
}

function promptDeleteProvider(provider: Provider) {
  deleteTarget.value = { type: 'provider', id: provider.id, name: provider.name }
  deleteModalOpen.value = true
}

function openProviderModels(provider: Provider) {
  selectedProvider.value = provider
  providerModelsModal.open()
}

// User handlers
function openUserEditor(user: AdminUser) {
  editingUser.value = user
  userForm.value = {
    displayName: user.displayName || '',
    email: user.email,
    role: user.role,
    usedTokens: user.usedTokens,
    tokenLimit: user.tokenLimit ?? null,
  }
  userModalOpen.value = true
  errorMessage.value = ''
}

async function saveUser() {
  if (!editingUser.value) return
  isSaving.value = true
  errorMessage.value = ''
  try {
    const payload: UpdateAdminUserRequest = {
      displayName: userForm.value.displayName.trim() || undefined,
      email: userForm.value.email.trim(),
      role: userForm.value.role,
      usedTokens: Number(userForm.value.usedTokens) || 0,
      tokenLimit: userForm.value.tokenLimit !== null && userForm.value.tokenLimit !== undefined && userForm.value.tokenLimit !== ('' as any)
        ? Number(userForm.value.tokenLimit)
        : null,
    }
    const updated = await adminService.updateUser(editingUser.value.id, payload)
    const idx = users.value.findIndex((u) => u.id === editingUser.value?.id)
    if (idx !== -1) {
      users.value[idx] = { ...users.value[idx], ...updated }
    }
    userModalOpen.value = false
    uiStore.showToast('اطلاعات کاربر با موفقیت به‌روزرسانی شد.', 'success')
  } catch (error: any) {
    errorMessage.value = error?.message || 'به‌روزرسانی کاربر با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

async function toggleUser(user: AdminUser) {
  try {
    const nextState = user.isActive === false
    await adminService.updateUserStatus(user.id, nextState)
    user.isActive = nextState
    uiStore.showToast(`وضعیت حساب «${user.displayName || user.email}» تغییر کرد.`, 'info')
  } catch (error: any) {
    errorMessage.value = error?.message || 'تغییر وضعیت کاربر با خطا مواجه شد'
  }
}

// System Prompt & Settings handlers
function openSettingsEditor() {
  settingsForm.value = {
    globalTokenLimit: stats.value?.globalTokenLimit ?? 0,
    systemPrompt: stats.value?.systemPrompt ?? '',
    fileMaxSizeMb: (stats.value as any)?.fileMaxSizeMb ?? 20,
    fileMaxTotalSizeMb: (stats.value as any)?.fileMaxTotalSizeMb ?? 50,
    fileMaxCount: (stats.value as any)?.fileMaxCount ?? 5,
  }
  settingsModalOpen.value = true
  errorMessage.value = ''
}

async function saveSettings() {
  isSaving.value = true
  errorMessage.value = ''
  try {
    const res = await adminService.updateSettings({
      globalTokenLimit: Number(settingsForm.value.globalTokenLimit) || 0,
      systemPrompt: settingsForm.value.systemPrompt.trim() || undefined,
      fileMaxSizeMb: Number(settingsForm.value.fileMaxSizeMb) || 20,
      fileMaxTotalSizeMb: Number(settingsForm.value.fileMaxTotalSizeMb) || 50,
      fileMaxCount: Number(settingsForm.value.fileMaxCount) || 5,
    })
    if (stats.value) {
      stats.value.globalTokenLimit = res.globalTokenLimit
      stats.value.systemPrompt = res.systemPrompt
    }
    settingsModalOpen.value = false
    uiStore.showToast('تنظیمات سراسری ذخیره شد.', 'success')
  } catch (error: any) {
    errorMessage.value = error?.message || 'ذخیره تنظیمات با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

function applyPromptPreset(promptText: string) {
  settingsForm.value.systemPrompt = promptText
  uiStore.showToast('الگوی پرامپت انتخاب شد. برای اعمال نهایی بر روی «ذخیره دستورالعمل» کلیک کنید.', 'info')
}

async function saveSystemPrompt() {
  isSaving.value = true
  errorMessage.value = ''
  try {
    const res = await adminService.updateSettings({
      systemPrompt: settingsForm.value.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
    })
    if (stats.value) {
      stats.value.systemPrompt = res.systemPrompt
    }
    uiStore.showToast('دستورالعمل سیستم با موفقیت به‌روزرسانی شد.', 'success')
  } catch (error: any) {
    errorMessage.value = error?.message || 'ذخیره دستورالعمل سیستم با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

// Conversation viewer handlers
async function loadConversations() {
  isLoadingConversations.value = true
  try {
    conversations.value = await adminService.listConversations()
  } catch (err: any) {
    console.error('Failed to load conversations:', err)
  } finally {
    isLoadingConversations.value = false
  }
}

async function openChatViewer(conv: AdminConversationSummary) {
  isLoadingChatDetail.value = true
  isChatModalOpen.value = true
  try {
    inspectingConversation.value = await adminService.getConversation(conv.id)
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در دریافت پیام‌های گفتگو', 'error')
    isChatModalOpen.value = false
  } finally {
    isLoadingChatDetail.value = false
  }
}

function promptDeleteConversation(conv: AdminConversationSummary) {
  deleteTarget.value = { type: 'conversation', id: conv.id, name: conv.title || 'گفتگو' }
  deleteModalOpen.value = true
}

// Unified delete executor
async function executeDelete() {
  if (!deleteTarget.value) return
  isSaving.value = true
  errorMessage.value = ''
  try {
    if (deleteTarget.value.type === 'model') {
      await modelsStore.removeModel(deleteTarget.value.id)
    } else if (deleteTarget.value.type === 'provider') {
      await modelsService.deleteProvider(deleteTarget.value.id)
      providers.value = providers.value.filter((p) => p.id !== deleteTarget.value?.id)
      await modelsStore.fetchModels(true)
    } else if (deleteTarget.value.type === 'conversation') {
      await adminService.deleteConversation(deleteTarget.value.id)
      conversations.value = conversations.value.filter((c) => c.id !== deleteTarget.value?.id)
      uiStore.showToast('گفتگو با موفقیت حذف شد.', 'success')
    }
    deleteModalOpen.value = false
    deleteTarget.value = null
  } catch (error: any) {
    errorMessage.value = error?.message || 'حذف مورد انتخابی با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

async function loadData() {
  errorMessage.value = ''
  await Promise.allSettled([
    modelsStore.fetchModels(true),
    modelsService.listProviders().then((data) => {
      providers.value = Array.isArray(data) ? data : []
    }),
    adminService.getDashboardStats().then((data) => {
      stats.value = data
      if (data?.systemPrompt) {
        settingsForm.value.systemPrompt = data.systemPrompt
      }
      if (data?.globalTokenLimit) {
        settingsForm.value.globalTokenLimit = data.globalTokenLimit
      }
    }),
    adminService.listUsers().then((data) => {
      users.value = Array.isArray(data) ? data : []
    }),
    loadConversations(),
  ])
}

onMounted(loadData)
</script>

<template>
  <div class="admin-shell" dir="rtl">
    <div
      v-if="sidebarOpen"
      class="admin-sidebar-backdrop"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside class="admin-sidebar" :class="{ 'is-open': sidebarOpen }">
      <div class="admin-brand">
        <div class="admin-brand-mark">پ</div>
        <div class="admin-brand-text">
          <strong>پروا</strong>
          <span class="admin-brand-sub">پنل مدیریت سیستم</span>
          <span class="sr-only">ADMIN</span>
        </div>
      </div>

      <nav class="admin-nav" aria-label="منوی مدیریت">
        <button
          v-for="item in navItems"
          :key="item.id"
          :data-admin-section="item.id"
          :class="{ active: activeSection === item.id }"
          @click="selectSection(item.id as typeof activeSection.value)"
        >
          <img
            v-if="item.iconType === 'img'"
            :src="item.icon as string"
            class="nav-icon-img"
            :alt="item.label"
            aria-hidden="true"
          />
          <component
            :is="item.icon"
            v-else
            :size="18"
            class="nav-icon-lucide"
            aria-hidden="true"
          />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="admin-sidebar-bottom">
        <button class="admin-back" @click="router.push('/')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {{ labels.back }}
        </button>
        <span class="admin-user-pill">{{ authStore.user?.email || 'admin' }}</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="admin-main">
      <header class="admin-topbar">
        <button class="admin-menu-button" aria-label="باز کردن منو" @click="sidebarOpen = true">
          ☰
        </button>
        <div class="topbar-title">
          <h1>
            {{
              activeSection === 'dashboard'
                ? labels.dashboardTitle
                : activeSection === 'providers'
                ? labels.providersTitle
                : activeSection === 'models'
                ? labels.modelsTitle
                : activeSection === 'users'
                ? labels.usersTitle
                : activeSection === 'prompts'
                ? labels.promptsTitle
                : labels.chatsTitle
            }}
          </h1>
          <span class="sr-only">ADMIN</span>
        </div>

        <div class="topbar-actions">
          <!-- Search input hidden on dashboard and prompts sections -->
          <div
            v-if="activeSection !== 'dashboard' && activeSection !== 'prompts'"
            class="search-input-wrap"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              v-model="searchQuery"
              class="admin-search search-input"
              :placeholder="activeSection === 'chats' ? 'جستجو در چت‌ها بر اساس عنوان یا ایمیل...' : labels.search"
            />
            <Loader2 v-if="isSearchDebouncing" :size="14" class="search-debouncing-spinner animate-spin" />
            <button
              v-else-if="searchQuery"
              class="search-clear-btn"
              type="button"
              aria-label="پاک کردن جستجو"
              @click="searchQuery = ''; debouncedSearchQuery = ''"
            >
              ×
            </button>
          </div>

          <BaseButton variant="ghost" icon size="md" title="تازه‌سازی اطلاعات" @click="loadData">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </BaseButton>
        </div>
      </header>

      <div v-if="errorMessage" class="admin-alert">{{ errorMessage }}</div>

      <!-- 1. DASHBOARD SECTION -->
      <section v-if="activeSection === 'dashboard'" class="admin-content">
        <div class="kpi-grid">
          <!-- Card 1: Users -->
          <article class="kpi-card metric-card">
            <div class="kpi-head">
              <span class="kpi-title">{{ labels.totalUsers }}</span>
              <div class="kpi-icon-pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <strong class="kpi-value">{{ stats?.totalUsers ?? users.length }}</strong>
            <small class="kpi-sub">{{ stats?.totalConversations ?? conversations.length }} {{ labels.conversations }}</small>
          </article>

          <!-- Card 2: Providers -->
          <article class="kpi-card metric-card">
            <div class="kpi-head">
              <span class="kpi-title">{{ labels.totalProviders }}</span>
              <div class="kpi-icon-pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
            </div>
            <strong class="kpi-value">{{ stats?.totalProviders ?? providers.length }}</strong>
            <small class="kpi-sub">
              {{ stats?.activeProviders ?? providers.filter((p) => p.isActive).length }} {{ labels.active }}
            </small>
          </article>

          <!-- Card 3: Models -->
          <article class="kpi-card metric-card">
            <div class="kpi-head">
              <span class="kpi-title">{{ labels.totalModels }}</span>
              <div class="kpi-icon-pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
            </div>
            <strong class="kpi-value">{{ stats?.totalModels ?? modelsStore.models.length }}</strong>
            <small class="kpi-sub">{{ stats?.activeModels ?? activeModelsCount }} {{ labels.active }}</small>
          </article>

          <!-- Card 4: Tokens & Quota Limit -->
          <article class="kpi-card metric-card accent">
            <div class="kpi-head">
              <span class="kpi-title">{{ labels.tokens }}</span>
              <button
                class="kpi-settings-btn"
                title="تنظیم سقف توکن سراسری و پرامپت سیستم"
                @click="openSettingsEditor"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
            <strong class="kpi-value">
              {{ (stats?.totalTokensUsed ?? users.reduce((sum, u) => sum + u.usedTokens, 0)).toLocaleString() }}
            </strong>
            <small class="kpi-sub">
              سقف سراسری:
              {{ stats?.globalTokenLimit ? stats.globalTokenLimit.toLocaleString() : labels.unlimited }}
            </small>
          </article>
        </div>

        <!-- Dashboard Grid: Providers Status & Usage -->
        <div class="dashboard-grid">
          <!-- Recent Providers Overview -->
          <article class="surface-panel">
            <div class="panel-heading">
              <h3 class="panel-title">ارائه‌دهنده‌های متصل</h3>
              <BaseButton variant="ghost" size="sm" @click="selectSection('providers')">
                مشاهده همه
              </BaseButton>
            </div>
            <div class="status-list">
              <div
                v-for="provider in providers.slice(0, 5)"
                :key="provider.id"
                class="status-row"
              >
                <span class="status-dot" :class="{ off: !provider.isActive }"></span>
                <strong>{{ provider.name }}</strong>
                <span>{{ providerModels(provider).length }} {{ labels.modelCount }}</span>
                <em>{{ provider.isActive ? labels.active : labels.inactive }}</em>
              </div>
              <p v-if="!providers.length" class="empty-state">{{ labels.noData }}</p>
            </div>
          </article>

          <!-- High Usage Users Overview -->
          <article class="surface-panel">
            <div class="panel-heading">
              <h3 class="panel-title">بیشترین مصرف‌کنندگان توکن</h3>
              <BaseButton variant="ghost" size="sm" @click="selectSection('users')">
                مشاهده همه
              </BaseButton>
            </div>
            <div class="usage-list">
              <div
                v-for="user in users.slice(0, 5)"
                :key="user.id"
                class="usage-row"
              >
                <span class="avatar-chip">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ user.displayName || user.email }}</strong>
                  <small>{{ user.conversationsCount }} {{ labels.conversations }}</small>
                </div>
                <b>{{ user.usedTokens.toLocaleString() }} توکن</b>
              </div>
              <p v-if="!users.length" class="empty-state">{{ labels.noData }}</p>
            </div>
          </article>
        </div>

        <!-- Dashboard Models Table -->
        <div class="dashboard-models surface-panel">
          <div class="panel-heading">
            <h3 class="panel-title">مدل‌های ثبت‌شده در سیستم</h3>
            <BaseButton variant="primary" size="sm" @click="openModelEditor()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {{ labels.addModel }}
            </BaseButton>
          </div>

          <AdminTable
            :columns="dashboardModelColumns"
            :items="filteredModels"
            table-class="dashboard-table"
          >
            <template #row="{ item: model }">
              <td>
                <div class="cell-primary">
                  <strong>{{ model.name }}</strong>
                  <span v-if="model.isDefault" class="subtext-badge">{{ labels.default }}</span>
                </div>
              </td>
              <td><span class="tag">{{ model.provider }}</span></td>
              <td class="mono subtext">{{ model.apiIdentifier }}</td>
              <td>
                <BaseToggle
                  :model-value="model.isActive"
                  size="sm"
                  @update:model-value="toggleModel(model)"
                />
              </td>
            </template>
          </AdminTable>
        </div>
      </section>

      <!-- 2. PROVIDERS SECTION (Uniform Cards, Connected Models, No System Badge) -->
      <section v-else-if="activeSection === 'providers'" class="admin-content">
        <div class="section-toolbar">
          <h3 class="section-heading">{{ labels.providersTitle }}</h3>
          <BaseButton variant="primary" size="md" @click="openProviderEditor()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {{ labels.addProvider }}
          </BaseButton>
        </div>

        <div class="provider-grid">
          <article
            v-for="provider in filteredProviders"
            :key="provider.id"
            class="provider-card"
          >
            <div class="provider-card-top">
              <div class="provider-card-head">
                <div class="provider-name-section">
                  <span class="status-dot" :class="{ off: !provider.isActive }"></span>
                  <button class="provider-name-button" @click="openProviderModels(provider)">
                    {{ provider.name }}
                  </button>
                </div>
                <BaseToggle
                  :model-value="provider.isActive"
                  size="sm"
                  @update:model-value="toggleProvider(provider)"
                />
              </div>

              <div class="provider-status-row">
                <span class="provider-status-label">{{ labels.status }}:</span>
                <span class="provider-status-badge" :class="{ active: provider.isActive }">
                  {{ provider.isActive ? labels.active : labels.inactive }}
                </span>
              </div>

              <p class="mono provider-url" :title="provider.baseUrl || 'آدرس پیش‌فرض'">
                {{ provider.baseUrl || '— آدرس پیش‌فرض سرویس‌دهنده —' }}
              </p>

              <!-- Connected Models section under providers -->
              <div class="provider-models-section">
                <span class="provider-models-label">
                  مدل‌های متصل ({{ providerModels(provider).length }}):
                </span>
                <div class="provider-models-chips">
                  <span
                    v-for="model in providerModels(provider)"
                    :key="model.id"
                    class="connected-model-chip"
                    :class="{ inactive: !model.isActive }"
                    :title="model.isActive ? 'مدل فعال' : 'مدل غیرفعال'"
                  >
                    <span class="chip-status-dot" :class="{ off: !model.isActive }"></span>
                    {{ model.name }}
                  </span>
                  <span v-if="!providerModels(provider).length" class="empty-models-chip">
                    بدون مدل متصل
                  </span>
                </div>
              </div>
            </div>

            <div class="card-actions">
              <BaseButton variant="ghost" size="sm" @click="openProviderEditor(provider)">
                {{ labels.edit }}
              </BaseButton>
              <BaseButton variant="danger" size="sm" @click="promptDeleteProvider(provider)">
                {{ labels.remove }}
              </BaseButton>
            </div>
          </article>
        </div>
        <p v-if="!filteredProviders.length" class="empty-state">{{ labels.noData }}</p>
      </section>

      <!-- 3. MODELS SECTION -->
      <section v-else-if="activeSection === 'models'" class="admin-content">
        <div class="section-toolbar">
          <h3 class="section-heading">{{ labels.modelsTitle }}</h3>
          <BaseButton variant="primary" size="md" @click="openModelEditor()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {{ labels.addModel }}
          </BaseButton>
        </div>

        <AdminTable
          :columns="fullModelColumns"
          :items="filteredModels"
          table-class="dashboard-table"
        >
          <template #row="{ item: model }">
            <td>
              <div class="cell-primary">
                <strong>{{ model.name }}</strong>
                <span v-if="model.isDefault" class="subtext-badge">{{ labels.default }}</span>
              </div>
            </td>
            <td><span class="tag">{{ model.provider }}</span></td>
            <td class="mono subtext">{{ model.apiIdentifier }}</td>
            <td>
              <BaseToggle
                :model-value="model.isActive"
                size="sm"
                @update:model-value="toggleModel(model)"
              />
            </td>
            <td class="actions-cell">
              <div class="action-buttons">
                <BaseButton
                  variant="ghost"
                  size="sm"
                  icon
                  :title="model.isDefault ? 'مدل پیش‌فرض' : 'تنظیم به عنوان پیش‌فرض'"
                  @click="setPlatformDefault(model)"
                >
                  {{ model.isDefault ? '★' : '☆' }}
                </BaseButton>
                <BaseButton variant="ghost" size="sm" @click="openModelEditor(model)">
                  {{ labels.edit }}
                </BaseButton>
                <BaseButton variant="danger" size="sm" @click="promptDeleteModel(model)">
                  {{ labels.remove }}
                </BaseButton>
              </div>
            </td>
          </template>
        </AdminTable>
      </section>

      <!-- 4. USERS SECTION -->
      <section v-else-if="activeSection === 'users'" class="admin-content users-panel">
        <div class="section-toolbar">
          <div class="section-title-wrap">
            <h3 class="section-heading">{{ labels.usersTitle }}</h3>
            <span class="record-badge">{{ filteredUsers.length }} کاربر</span>
          </div>
        </div>

        <AdminTable :columns="userColumns" :items="filteredUsers">
          <template #row="{ item: user }">
            <td>
              <div class="user-cell">
                <span class="avatar-chip">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ user.displayName || '—' }}</strong>
                  <span class="subtext">{{ user.email }}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="tag" :class="{ 'tag-admin': user.role === 'admin' }">
                {{ user.role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی' }}
              </span>
            </td>
            <td class="mono">{{ user.conversationsCount }}</td>
            <td class="mono">{{ user.usedTokens.toLocaleString() }}</td>
            <td class="mono">
              {{ user.tokenLimit !== null && user.tokenLimit !== undefined ? user.tokenLimit.toLocaleString() : 'سقف سراسری' }}
            </td>
            <td>
              <BaseToggle
                :model-value="user.isActive !== false"
                size="sm"
                @update:model-value="toggleUser(user)"
              />
            </td>
            <td class="actions-cell">
              <div class="action-buttons">
                <BaseButton variant="ghost" size="sm" @click="openUserEditor(user)">
                  {{ labels.edit }}
                </BaseButton>
              </div>
            </td>
          </template>
        </AdminTable>
      </section>

      <!-- 5. PROMPTS SECTION (Dedicated System Prompt Section) -->
      <section v-else-if="activeSection === 'prompts'" class="admin-content prompts-panel">
        <div class="section-toolbar">
          <div class="section-title-wrap">
            <h3 class="section-heading">{{ labels.promptsTitle }}</h3>
            <span class="record-badge">تنظیمات رفتار هوش مصنوعی</span>
          </div>
          <BaseButton
            variant="primary"
            size="md"
            :loading="isSaving"
            :disabled="isSaving"
            @click="saveSystemPrompt"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            ذخیره دستورالعمل
          </BaseButton>
        </div>

        <div class="prompt-workspace">
          <!-- Guide / Explanation Card -->
          <div class="prompt-info-banner">
            <div class="banner-icon">
              <Sparkles :size="20" />
            </div>
            <div class="banner-text">
              <strong>دستورالعمل سراسری سیستم چیست؟</strong>
              <p>
                این متن به عنوان پیام زمینه (System Message) در ابتدای تمامی چت‌ها و گفتگوهای کاربران اعمال می‌شود و لحن، قوانین و رفتار کلی مدل‌های هوش مصنوعی را در سراسر سامانه تعیین می‌کند.
              </p>
            </div>
          </div>

          <!-- Quick Presets -->
          <div class="prompt-presets-container">
            <span class="presets-label">الگوهای آماده برای راه‌اندازی سریع:</span>
            <div class="presets-grid">
              <button
                v-for="preset in PROMPT_PRESETS"
                :key="preset.name"
                type="button"
                class="preset-card"
                @click="applyPromptPreset(preset.prompt)"
              >
                <strong>{{ preset.name }}</strong>
                <p>{{ preset.description }}</p>
              </button>
            </div>
          </div>

          <!-- Prompt Editor Box -->
          <div class="prompt-editor-card">
            <div class="editor-header">
              <label for="adminSystemPrompt" class="editor-label">متن دستورالعمل فعال سیستم:</label>
              <div class="editor-stats">
                <span>{{ (settingsForm.systemPrompt || '').length }} کاراکتر</span>
                <span>{{ (settingsForm.systemPrompt || '').split('\n').length }} خط</span>
              </div>
            </div>

            <textarea
              id="adminSystemPrompt"
              v-model="settingsForm.systemPrompt"
              class="prompt-textarea"
              rows="10"
              placeholder="دستورالعمل سیستم را وارد کنید..."
              dir="rtl"
            ></textarea>

            <div class="editor-footer">
              <BaseButton
                variant="ghost"
                size="sm"
                @click="settingsForm.systemPrompt = DEFAULT_SYSTEM_PROMPT"
              >
                بازنشانی به متن پیش‌فرض
              </BaseButton>
              <BaseButton
                variant="primary"
                size="md"
                :loading="isSaving"
                :disabled="isSaving"
                @click="saveSystemPrompt"
              >
                {{ labels.save }}
              </BaseButton>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. CHATS SECTION (Admin Chat Inspector) -->
      <section v-else-if="activeSection === 'chats'" class="admin-content chats-panel">
        <div class="section-toolbar">
          <div class="section-title-wrap">
            <h3 class="section-heading">{{ labels.chatsTitle }}</h3>
            <span class="record-badge">{{ filteredChats.length }} گفتگو</span>
          </div>
          <BaseButton variant="ghost" size="md" icon title="تازه‌سازی گفتگوها" @click="loadConversations">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </BaseButton>
        </div>

        <AdminTable :columns="chatColumns" :items="filteredChats">
          <template #row="{ item: conv }">
            <td>
              <div class="chat-title-cell">
                <MessageSquare :size="15" class="chat-row-icon" />
                <div>
                  <strong>{{ conv.title || 'بدون عنوان' }}</strong>
                  <span class="subtext mono">{{ conv.id.slice(0, 8) }}...</span>
                </div>
              </div>
            </td>
            <td>
              <div class="user-cell">
                <span class="avatar-chip">{{ (conv.user?.displayName || conv.user?.email || 'U').charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ conv.user?.displayName || '—' }}</strong>
                  <span class="subtext">{{ conv.user?.email || 'کاربر ناشناس' }}</span>
                </div>
              </div>
            </td>
            <td class="mono">
              <span class="message-count-badge">{{ conv.messageCount }} پیام</span>
            </td>
            <td class="mono subtext">
              {{ new Date(conv.updatedAt || conv.createdAt).toLocaleDateString('fa-IR') }}
            </td>
            <td class="actions-cell">
              <div class="action-buttons">
                <BaseButton variant="secondary" size="sm" @click="openChatViewer(conv)">
                  مشاهده پیام‌ها
                </BaseButton>
                <BaseButton variant="danger" size="sm" @click="promptDeleteConversation(conv)">
                  {{ labels.remove }}
                </BaseButton>
              </div>
            </td>
          </template>
        </AdminTable>
      </section>
    </main>

    <!-- MODAL 1: Model Create / Edit -->
    <AdminModal
      v-if="modelModalOpen"
      :eyebrow="editingModel ? 'ویرایش' : 'ثبت'"
      :title="editingModel ? 'ویرایش مدل هوش مصنوعی' : 'افزودن مدل جدید'"
      @close="modelModalOpen = false"
    >
      <form class="admin-form" @submit.prevent="saveModel">
        <div class="form-grid">
          <label>
            <span class="field-label">{{ labels.modelName }} <span class="req">*</span></span>
            <input id="modelName" v-model="modelForm.name" required :disabled="isSaving" />
          </label>
          <label>
            <span class="field-label">{{ labels.provider }}</span>
            <select v-model="modelForm.providerId" :disabled="isSaving">
              <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                {{ provider.name }}
              </option>
            </select>
          </label>
          <label class="col-span-full">
            <span class="field-label">{{ labels.apiId }} <span class="req">*</span></span>
            <input id="apiIdentifier" v-model="modelForm.apiIdentifier" class="mono" required :disabled="isSaving" />
          </label>
          <label class="col-span-full">
            <span class="field-label">{{ labels.baseUrl }}</span>
            <input v-model="modelForm.baseUrl" class="mono" :disabled="isSaving" />
          </label>
          <label class="col-span-full">
            <span class="field-label">{{ labels.apiKey }}</span>
            <input
              v-model="modelForm.apiKey"
              type="password"
              class="mono"
              placeholder="در صورت عدم تغییر، خالی بگذارید"
              :disabled="isSaving"
            />
          </label>
          <label class="toggle-label col-span-full">
            <BaseToggle v-model="modelForm.isActive" :disabled="isSaving" />
            <span>مدل در پلتفرم فعال باشد</span>
          </label>
        </div>
        <div class="modal-actions">
          <BaseButton variant="ghost" size="md" :disabled="isSaving" @click="modelModalOpen = false">
            {{ labels.cancel }}
          </BaseButton>
          <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
            {{ labels.save }}
          </BaseButton>
        </div>
      </form>
    </AdminModal>

    <!-- MODAL 2: Provider Create / Edit -->
    <AdminModal
      v-if="providerModalOpen"
      :eyebrow="editingProvider ? 'ویرایش' : 'ثبت'"
      :title="editingProvider ? 'ویرایش ارائه‌دهنده سرویس' : 'افزودن ارائه‌دهنده جدید'"
      @close="providerModalOpen = false"
    >
      <form class="admin-form" @submit.prevent="saveProvider">
        <div class="form-grid">
          <label class="col-span-full">
            <span class="field-label">{{ labels.name }} <span class="req">*</span></span>
            <input v-model="providerForm.name" required :disabled="isSaving" />
          </label>
          <label class="col-span-full">
            <span class="field-label">{{ labels.baseUrl }}</span>
            <input v-model="providerForm.baseUrl" class="mono" :disabled="isSaving" />
          </label>
          <label class="col-span-full">
            <span class="field-label">{{ labels.apiKey }}</span>
            <input
              v-model="providerForm.apiKey"
              type="password"
              class="mono"
              placeholder="در صورت عدم تغییر، خالی بگذارید"
              :disabled="isSaving"
            />
          </label>
          <label class="toggle-label col-span-full">
            <BaseToggle v-model="providerForm.isActive" :disabled="isSaving" />
            <span>ارائه‌دهنده فعال باشد</span>
          </label>
        </div>
        <div class="modal-actions">
          <BaseButton variant="ghost" size="md" :disabled="isSaving" @click="providerModalOpen = false">
            {{ labels.cancel }}
          </BaseButton>
          <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
            {{ labels.save }}
          </BaseButton>
        </div>
      </form>
    </AdminModal>

    <!-- MODAL 3: User Edit & Quota Modal -->
    <AdminModal
      v-if="userModalOpen"
      eyebrow="کاربران"
      title="ویرایش سهمیه و وضعیت کاربر"
      @close="userModalOpen = false"
    >
      <form class="admin-form" @submit.prevent="saveUser">
        <div class="form-grid">
          <label>
            <span class="field-label">نام کاربر</span>
            <input v-model="userForm.displayName" :disabled="isSaving" />
          </label>
          <label>
            <span class="field-label">ایمیل</span>
            <input v-model="userForm.email" type="email" required :disabled="isSaving" />
          </label>
          <label>
            <span class="field-label">{{ labels.role }}</span>
            <select v-model="userForm.role" :disabled="isSaving">
              <option value="user">کاربر عادی</option>
              <option value="admin">مدیر سیستم</option>
            </select>
          </label>
          <label>
            <span class="field-label">{{ labels.usedTokens }}</span>
            <input v-model.number="userForm.usedTokens" type="number" min="0" :disabled="isSaving" />
          </label>
          <label class="col-span-full">
            <span class="field-label">
              {{ labels.tokenLimit }} (خالی = استفاده از سقف سراسری سیستم)
            </span>
            <input
              v-model.number="userForm.tokenLimit"
              type="number"
              min="0"
              placeholder="مثال: 50000 یا خالی برای پیش‌فرض"
              :disabled="isSaving"
            />
          </label>
        </div>
        <div class="modal-actions">
          <BaseButton variant="ghost" size="md" :disabled="isSaving" @click="userModalOpen = false">
            {{ labels.cancel }}
          </BaseButton>
          <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
            {{ labels.save }}
          </BaseButton>
        </div>
      </form>
    </AdminModal>

    <!-- MODAL 4: Global Settings Modal (Quota & System Prompt) -->
    <AdminModal
      v-if="settingsModalOpen"
      eyebrow="تنظیمات"
      title="تنظیمات سقف مصرف و پرامپت سیستم"
      @close="settingsModalOpen = false"
    >
      <form class="admin-form" @submit.prevent="saveSettings">
        <div class="form-grid">
          <label class="col-span-full">
            <span class="field-label">
              {{ labels.globalLimit }} (سقف سراسری توکن - 0 یعنی نامحدود)
            </span>
            <input
              v-model.number="settingsForm.globalTokenLimit"
              type="number"
              min="0"
              required
              :disabled="isSaving"
            />
          </label>
          <label class="col-span-full">
            <span class="field-label">{{ labels.systemPrompt }}</span>
            <textarea
              v-model="settingsForm.systemPrompt"
              class="admin-textarea"
              rows="6"
              placeholder="دستورالعمل سیستم را به زبان فارسی وارد کنید..."
              :disabled="isSaving"
            ></textarea>
          </label>

          <!-- File Upload Limits -->
          <div class="col-span-full settings-section-divider">
            <span class="settings-section-label">تنظیمات آپلود فایل</span>
          </div>
          <label>
            <span class="field-label">حداکثر حجم هر فایل (مگابایت)</span>
            <input
              v-model.number="settingsForm.fileMaxSizeMb"
              type="number"
              min="1"
              max="100"
              :disabled="isSaving"
            />
          </label>
          <label>
            <span class="field-label">حداکثر مجموع حجم در هر پیام (مگابایت)</span>
            <input
              v-model.number="settingsForm.fileMaxTotalSizeMb"
              type="number"
              min="1"
              max="500"
              :disabled="isSaving"
            />
          </label>
          <label>
            <span class="field-label">حداکثر تعداد فایل در هر پیام</span>
            <input
              v-model.number="settingsForm.fileMaxCount"
              type="number"
              min="1"
              max="20"
              :disabled="isSaving"
            />
          </label>
        </div>
        <div class="modal-actions">
          <BaseButton variant="ghost" size="md" :disabled="isSaving" @click="settingsModalOpen = false">
            {{ labels.cancel }}
          </BaseButton>
          <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
            {{ labels.save }}
          </BaseButton>
        </div>
      </form>
    </AdminModal>

    <!-- MODAL 5: Delete Confirm Modal -->
    <DeleteConfirmModal
      :open="deleteModalOpen"
      :title="
        deleteTarget?.type === 'model'
          ? 'حذف مدل هوش مصنوعی'
          : deleteTarget?.type === 'provider'
          ? 'حذف ارائه‌دهنده'
          : 'حذف گفتگوی کاربر'
      "
      :item-name="deleteTarget?.name"
      :loading="isSaving"
      @close="deleteModalOpen = false"
      @confirm="executeDelete"
    />

    <!-- MODAL 6: Provider Models Detail Modal -->
    <AdminModal
      v-if="providerModelsModal.isOpen.value && selectedProvider"
      eyebrow="ارائه‌دهنده"
      :title="selectedProvider.name"
      @close="providerModelsModal.close()"
    >
      <div class="provider-modal-content">
        <div class="provider-info-grid">
          <div class="provider-info-item">
            <span>نام ارائه‌دهنده</span>
            <strong>{{ selectedProvider.name }}</strong>
          </div>
          <div class="provider-info-item">
            <span>وضعیت فعالیت</span>
            <strong>{{ selectedProvider.isActive ? labels.active : labels.inactive }}</strong>
          </div>
          <div class="provider-info-item provider-info-item-wide">
            <span>آدرس پایه (Base URL)</span>
            <strong class="mono">{{ selectedProvider.baseUrl || '—' }}</strong>
          </div>
        </div>
        <div class="provider-modal-footer">
          <BaseButton variant="secondary" size="md" @click="openProviderEditor(selectedProvider)">
            {{ labels.edit }}
          </BaseButton>
          <BaseButton variant="primary" size="md" @click="openModelEditor()">
            {{ labels.addModel }}
          </BaseButton>
        </div>
      </div>
    </AdminModal>

    <!-- MODAL 7: Conversation Messages Inspector Modal -->
    <AdminModal
      v-if="isChatModalOpen"
      eyebrow="بازبینی چت"
      :title="inspectingConversation?.title || 'مشاهده تاریخچه پیام‌ها'"
      @close="isChatModalOpen = false; inspectingConversation = null"
    >
      <div class="chat-viewer-modal">
        <div v-if="isLoadingChatDetail" class="chat-viewer-loading">
          <Loader2 :size="28" class="animate-spin" />
          <span>در حال بارگذاری پیام‌های گفتگو...</span>
        </div>

        <div v-else-if="inspectingConversation" class="chat-viewer-body">
          <div class="chat-viewer-meta">
            <div class="meta-item">
              <span>کاربر:</span>
              <strong>{{ inspectingConversation.user?.displayName || inspectingConversation.user?.email || 'ناشناس' }}</strong>
            </div>
            <div class="meta-item">
              <span>تعداد کل پیام‌ها:</span>
              <strong>{{ inspectingConversation.messages?.length || 0 }}</strong>
            </div>
            <div class="meta-item">
              <span>مدل:</span>
              <strong class="mono">{{ inspectingConversation.modelId || 'پیش‌فرض' }}</strong>
            </div>
          </div>

          <div class="chat-messages-container">
            <div
              v-for="msg in inspectingConversation.messages"
              :key="msg.id"
              class="chat-bubble-row"
              :class="msg.role === 'user' ? 'role-user' : 'role-assistant'"
            >
              <div class="chat-bubble-avatar">
                {{ msg.role === 'user' ? 'کاربر' : 'پروا' }}
              </div>
              <div class="chat-bubble-content">
                <div class="chat-bubble-header">
                  <span class="bubble-sender">{{ msg.role === 'user' ? 'کاربر' : 'دستیار هوش مصنوعی' }}</span>
                  <span class="bubble-time mono">
                    {{ new Date(msg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) }}
                  </span>
                </div>
                <div class="bubble-text">{{ msg.content }}</div>
                <div v-if="msg.isInterrupted" class="bubble-tag tag-interrupted">قطع ارتباط</div>
                <div v-if="msg.stoppedByUser" class="bubble-tag tag-stopped">توقف توسط کاربر</div>
              </div>
            </div>

            <div v-if="!inspectingConversation.messages?.length" class="empty-state">
              هیچ پیامی در این گفتگو ثبت نشده است.
            </div>
          </div>
        </div>
      </div>
    </AdminModal>
  </div>
</template>

<style scoped>
/* Base Layout */
.admin-shell {
  min-height: 100vh;
  display: flex;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}

.admin-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  inset-inline-start: 0;
  height: 100vh;
  width: 260px;
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  padding: 24px 18px;
  background: var(--card);
  border-inline-end: 1px solid var(--border);
  overflow: hidden;
  z-index: 30;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.admin-brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 700;
  font-size: 20px;
}

.admin-brand-text strong {
  display: block;
  font-size: 17px;
  font-weight: 700;
}

.admin-brand-sub {
  display: block;
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 2px;
}

.admin-nav {
  display: grid;
  gap: 6px;
  padding-top: 24px;
}

.admin-nav button,
.admin-back {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--muted-foreground);
  text-align: start;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.admin-nav button:hover,
.admin-nav button.active,
.admin-back:hover {
  background: var(--secondary);
  color: var(--foreground);
}

.admin-nav button.active {
  font-weight: 600;
  color: var(--primary);
}

.nav-icon-img {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  object-fit: contain;
}

.nav-icon-lucide {
  color: inherit;
  flex-shrink: 0;
}

.admin-sidebar-bottom {
  margin-top: auto;
  display: grid;
  gap: 12px;
  padding-top: 24px;
}

.admin-back {
  font-size: 12.5px;
}

.admin-user-pill {
  overflow: hidden;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--muted-foreground);
  font: 11px var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Topbar */
.admin-main {
  min-width: 0;
  flex: 1;
  margin-inline-start: 260px;
}

.admin-topbar {
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px clamp(20px, 4vw, 48px);
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--background) 90%, var(--card));
}

.topbar-title h1 {
  margin: 0;
  font-size: clamp(20px, 2.2vw, 26px);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.admin-menu-button {
  display: none;
  border: 0;
  background: transparent;
  color: var(--foreground);
  font-size: 22px;
  cursor: pointer;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Logical padding RTL search input */
.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  inset-inline-start: 13px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.admin-search {
  width: min(280px, 36vw);
  height: 38px;
  padding-block: 0;
  padding-inline-start: 38px;
  padding-inline-end: 36px;
  border: 1px solid var(--border);
  border-radius: 10px;
  outline: 0;
  background: var(--card);
  color: var(--foreground);
  font: 13px var(--font-sans);
  transition: border-color 0.15s ease;
}

.admin-search::placeholder {
  color: var(--muted-foreground);
  opacity: 0.75;
  font-size: 12.5px;
}

.admin-search:focus {
  border-color: var(--primary);
}

.search-debouncing-spinner {
  position: absolute;
  inset-inline-end: 12px;
  color: var(--primary);
}

.search-clear-btn {
  position: absolute;
  inset-inline-end: 10px;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 16px;
  cursor: pointer;
}

/* Content Area */
.admin-content {
  padding: clamp(24px, 4vw, 48px);
  max-width: 1440px;
  margin: auto;
}

/* KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.kpi-card {
  min-height: 128px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kpi-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.kpi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kpi-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted-foreground);
}

.kpi-icon-pill {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--secondary);
  color: var(--muted-foreground);
}

.kpi-settings-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.kpi-settings-btn:hover {
  background: var(--secondary);
  color: var(--foreground);
}

.kpi-value {
  font-size: 32px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: -0.03em;
  margin: 10px 0 4px;
}

.kpi-sub {
  font-size: 12px;
  color: var(--muted-foreground);
}

.kpi-card.accent {
  background: color-mix(in srgb, var(--primary) 6%, var(--card));
  border-color: color-mix(in srgb, var(--primary) 20%, var(--border));
}

.kpi-card.accent .kpi-value {
  color: var(--primary);
}

/* Dashboard Surface Panels */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.surface-panel {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.dashboard-models {
  margin-top: 24px;
}

.panel-heading,
.section-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.panel-title,
.section-heading {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-badge {
  font-size: 12px;
  color: var(--muted-foreground);
  background: var(--secondary);
  padding: 4px 10px;
  border-radius: 8px;
}

.status-list,
.usage-list {
  display: grid;
  gap: 10px;
}

.status-row,
.usage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  font-size: 13px;
}

.status-row > span:nth-child(3),
.status-row em {
  margin-inline-start: auto;
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-style: normal;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  background: #22c55e;
}

.status-dot.off {
  background: var(--muted-foreground);
}

.usage-row div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.usage-row b {
  margin-inline-start: auto;
  font: 12px var(--font-mono);
  color: var(--primary);
}

.avatar-chip {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
  font: 600 13px var(--font-sans);
}

/* =======================================================
   PROVIDER CARDS: STRICTLY UNIFORM & HARMONIOUS UNDER ALL CONDITIONS
   ======================================================= */
.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  align-items: stretch;
}

.provider-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  min-height: 250px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: border-color 0.15s ease;
}

.provider-card:hover {
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
}

.provider-card-top {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.provider-name-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.provider-name-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
  font: 700 16px var(--font-sans);
  transition: color 0.15s ease;
}

.provider-name-button:hover {
  color: var(--primary);
}

.provider-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-status-label {
  font-size: 12px;
  color: var(--muted-foreground);
}

.provider-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 500;
  background: color-mix(in srgb, var(--muted-foreground) 12%, transparent);
  color: var(--muted-foreground);
}

.provider-status-badge.active {
  background: color-mix(in srgb, #22c55e 14%, transparent);
  color: #16a34a;
}

.provider-url {
  overflow: hidden;
  margin: 0;
  font-size: 11.5px;
  color: var(--muted-foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Connected models list inside each provider card */
.provider-models-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--secondary) 45%, transparent);
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.provider-models-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.provider-models-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.connected-model-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--foreground);
}

.connected-model-chip.inactive {
  opacity: 0.6;
  border-style: dashed;
}

.chip-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.chip-status-dot.off {
  background: var(--muted-foreground);
}

.empty-models-chip {
  font-size: 11px;
  color: var(--muted-foreground);
  font-style: italic;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

/* =======================================================
   PROMPTS PANEL STYLES
   ======================================================= */
.prompts-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.prompt-workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.prompt-info-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary) 8%, var(--card));
  border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
}

.banner-icon {
  color: var(--primary);
  margin-top: 2px;
}

.banner-text strong {
  display: block;
  font-size: 14px;
  color: var(--foreground);
  margin-bottom: 4px;
}

.banner-text p {
  margin: 0;
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.prompt-presets-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.presets-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.preset-card {
  text-align: start;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-card:hover {
  border-color: var(--primary);
  background: var(--secondary);
}

.preset-card strong {
  display: block;
  font-size: 13.5px;
  color: var(--foreground);
  margin-bottom: 4px;
}

.preset-card p {
  margin: 0;
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.5;
}

.prompt-editor-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.editor-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}

.editor-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
}

.prompt-textarea {
  width: 100%;
  min-height: 240px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.7;
  resize: vertical;
  outline: 0;
  transition: border-color 0.15s ease;
}

.prompt-textarea:focus {
  border-color: var(--primary);
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

/* =======================================================
   CHATS PANEL & CHAT VIEWER MODAL
   ======================================================= */
.chat-title-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-row-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.message-count-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--secondary);
  font-size: 12px;
}

.chat-viewer-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-viewer-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--muted-foreground);
}

.chat-viewer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--secondary);
  font-size: 12.5px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-item span {
  color: var(--muted-foreground);
}

.chat-messages-container {
  max-height: 480px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 4px;
}

.chat-bubble-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.chat-bubble-row.role-user {
  flex-direction: row-reverse;
}

.chat-bubble-avatar {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 11.5px;
  font-weight: 700;
  background: var(--secondary);
  color: var(--foreground);
}

.role-user .chat-bubble-avatar {
  background: var(--primary);
  color: var(--primary-foreground);
}

.chat-bubble-content {
  max-width: 82%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-user .chat-bubble-content {
  align-items: flex-end;
}

.chat-bubble-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
}

.bubble-sender {
  font-weight: 600;
  color: var(--foreground);
}

.bubble-time {
  color: var(--muted-foreground);
}

.bubble-text {
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--secondary);
  color: var(--foreground);
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.role-user .bubble-text {
  background: color-mix(in srgb, var(--primary) 12%, var(--card));
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
}

.bubble-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10.5px;
  margin-top: 4px;
}

.tag-interrupted {
  background: color-mix(in srgb, var(--destructive) 15%, transparent);
  color: var(--destructive);
}

.tag-stopped {
  background: var(--secondary);
  color: var(--muted-foreground);
}

/* Forms in Modals */
.admin-form {
  display: grid;
  gap: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-grid label {
  display: grid;
  gap: 7px;
  color: var(--muted-foreground);
  font-size: 12.5px;
}

.col-span-full {
  grid-column: 1 / -1;
}

.field-label {
  font-weight: 500;
}

.req {
  color: var(--destructive);
}

.form-grid input,
.form-grid select,
.admin-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 9px;
  outline: 0;
  background: var(--background);
  color: var(--foreground);
  font: 13px var(--font-sans);
  transition: border-color 0.15s ease;
}

.form-grid input::placeholder,
.admin-textarea::placeholder {
  color: var(--muted-foreground);
  opacity: 0.75;
}

.form-grid input:focus,
.form-grid select:focus,
.admin-textarea:focus {
  border-color: var(--primary);
}

.admin-textarea {
  resize: vertical;
  line-height: 1.6;
}

.toggle-label {
  display: flex !important;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.settings-section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  margin: 4px 0;
}

.settings-section-divider::before,
.settings-section-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--border);
}

.settings-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Provider Details Modal */
.provider-modal-content {
  display: grid;
  gap: 20px;
}

.provider-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.provider-info-item {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: var(--secondary);
}

.provider-info-item-wide {
  grid-column: 1 / -1;
}

.provider-info-item span {
  font-size: 11px;
  color: var(--muted-foreground);
}

.provider-info-item strong {
  font-size: 13px;
}

.provider-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* Common UI helpers */
.cell-primary strong {
  display: block;
}

.subtext-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
  margin-top: 3px;
}

.tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: var(--secondary);
}

.tag-admin {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
  font-weight: 600;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.subtext {
  font-size: 11px;
  color: var(--muted-foreground);
}

.mono {
  font-family: var(--font-mono);
}

.actions-cell {
  width: 1%;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-state {
  text-align: center;
  padding: 36px 16px;
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.admin-alert {
  margin: 16px clamp(20px, 4vw, 48px) 0;
  padding: 12px 16px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--destructive) 25%, transparent);
  color: var(--destructive);
  font-size: 13px;
}

.admin-sidebar-backdrop {
  display: none;
}

@media (max-width: 1080px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .admin-menu-button {
    display: block;
  }

  .admin-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    inset-inline-start: 0;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    z-index: 90;
  }

  .admin-sidebar.is-open {
    transform: translateX(0);
  }

  .admin-sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 85;
    display: block;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .provider-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
