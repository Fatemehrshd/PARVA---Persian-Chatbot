<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Sparkles,
  MessageSquare,
  Loader2,
  FileText,
  ExternalLink,
  RefreshCw,
  Eye,
  LayoutDashboard,
  Network,
  Boxes,
  Users,
} from '@lucide/vue'
import { useModelsStore } from '../stores/models'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { modelsService } from '../services/models.service'
import { adminService } from '../services/admin.service'
import { buildUrl } from '../services/api'
import { formatIranDate, formatIranTime, formatIranDateTime } from '../lib/date'
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
  AdminFileItem,
  AdminFileStats,
  AdminFileDetail,
} from '../types'
import { adjustStat } from '../utils/stats'
import { markDefaultModel } from '../utils/models'

const router = useRouter()
const modelsStore = useModelsStore()
const uiStore = useUiStore()
const authStore = useAuthStore()

type AdminSection = 'dashboard' | 'providers' | 'models' | 'users' | 'prompts' | 'chats' | 'files'

const activeSection = ref<AdminSection>('dashboard')
const sidebarOpen = ref(false)

const adminName = computed(() => authStore.user?.displayName || authStore.user?.email || 'ادمین')
const adminInitial = computed(() => adminName.value.charAt(0).toUpperCase())

// 3-Second Search Debounce
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const isSearchDebouncing = ref(false)
let searchDebounceTimer: any = null

// مشخص کردن دامنه و فیلدهای تحت جستجو بر اساس بخش فعال
const currentSearchScope = computed(() => {
  switch (activeSection.value) {
    case 'users':
      return {
        placeholder: 'جستجو در کاربران بر اساس: نام کاربر، نشانی ایمیل، نام کاربری، نقش...',
        fields: ['نام کاربر', 'ایمیل', 'نام کاربری', 'نقش'],
      }
    case 'models':
      return {
        placeholder: 'جستجو در مدل‌ها بر اساس: نام مدل، شناسه API، ارائه‌دهنده...',
        fields: ['نام مدل', 'شناسه API', 'ارائه‌دهنده'],
      }
    case 'providers':
      return {
        placeholder: 'جستجو در ارائه‌دهنده‌ها بر اساس: نام سرویس‌دهنده، آدرس Base URL...',
        fields: ['نام ارائه‌دهنده', 'آدرس Base URL'],
      }
    case 'chats':
      return {
        placeholder: 'جستجو در چت‌ها بر اساس: عنوان گفتگو، نام کاربر، ایمیل...',
        fields: ['عنوان گفتگو', 'نام کاربر', 'ایمیل'],
      }
    case 'files':
      return {
        placeholder: 'جستجو در فایل‌ها بر اساس: نام فایل، نوع، کاربر، شناسه...',
        fields: ['نام فایل', 'نوع فایل', 'کاربر', 'شناسه'],
      }
    default:
      return {
        placeholder: 'جستجو در این بخش...',
        fields: [],
      }
  }
})

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

// ─── Optimistic dashboard counters ─────────────────────────────────────────
// Mutations patch the row + KPI instantly and roll back on failure, so the
// dashboard never waits for a refresh. refreshStats() reconciles with the
// server after structural changes (add/delete) and cascades (provider toggle).
function bumpStat(
  key:
    | 'totalModels'
    | 'activeModels'
    | 'totalProviders'
    | 'activeProviders'
    | 'totalUsers'
    | 'totalConversations'
    | 'totalMessages',
  delta: number,
) {
  adjustStat(stats.value, key, delta)
}

async function refreshStats() {
  try {
    const data = await adminService.getDashboardStats()
    if (data) stats.value = data
  } catch {
    // keep optimistic values; the next full load reconciles
  }
}
const conversations = ref<AdminConversationSummary[]>([])
const isLoadingConversations = ref(false)
const chatPage = ref(1)
const chatLimit = ref(50)

// Chat Inspection Modal State
const isChatModalOpen = ref(false)
const inspectingConversation = ref<AdminConversationDetail | null>(null)
const isLoadingChatDetail = ref(false)

// ========================
// قابلیت سرچ درون چت کاربر در پنل ادمین با اسکرول خودکار (مورد ۱)
// ========================
const chatSearchQuery = ref('')
const activeChatMatchIndex = ref(0)

const matchingChatMessages = computed(() => {
  if (!inspectingConversation.value?.messages || !chatSearchQuery.value.trim()) {
    return []
  }
  const q = chatSearchQuery.value.trim().toLowerCase()
  return inspectingConversation.value.messages.filter((m) =>
    (m.content || '').toLowerCase().includes(q),
  )
})

function scrollToChatMatch(index: number) {
  if (!matchingChatMessages.value.length) return
  if (index < 0) index = matchingChatMessages.value.length - 1
  if (index >= matchingChatMessages.value.length) index = 0
  activeChatMatchIndex.value = index

  const targetMsg = matchingChatMessages.value[index]
  if (targetMsg) {
    setTimeout(() => {
      const el = document.getElementById(`admin-chat-msg-${targetMsg.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 60)
  }
}

function nextChatMatch() {
  scrollToChatMatch(activeChatMatchIndex.value + 1)
}

function prevChatMatch() {
  scrollToChatMatch(activeChatMatchIndex.value - 1)
}

function resetChatSearch() {
  chatSearchQuery.value = ''
  activeChatMatchIndex.value = 0
}

// Files Management State
const files = ref<AdminFileItem[]>([])
const fileStats = ref<AdminFileStats | null>(null)
const isLoadingFiles = ref(false)
const fileStatusFilter = ref<'all' | 'processing' | 'ready' | 'error'>('all')
const filePage = ref(1)
const fileLimit = ref(50)
const fileTotal = ref(0)
const fileTotalPages = ref(1)
const inspectingFile = ref<AdminFileDetail | null>(null)
const isFileDetailModalOpen = ref(false)
const isLoadingFileDetail = ref(false)
const isRetryingFile = ref<string | null>(null)

// ========================
// مشاهده فایل‌های آپلود شده هر کاربر با کلیک روی کاربر (مورد ۱۴)
// ========================
const fileUserFilter = ref<AdminUser | null>(null)

function filterFilesByUser(user: AdminUser) {
  fileUserFilter.value = user
  activeSection.value = 'files'
  filePage.value = 1
  loadFiles()
}

function clearFileUserFilter() {
  fileUserFilter.value = null
  filePage.value = 1
  loadFiles()
}

// Modals state
const modelModalOpen = ref(false)
const providerModalOpen = ref(false)
const userModalOpen = ref(false)
const settingsModalOpen = ref(false)
const deleteModalOpen = ref(false)
const deleteTarget = ref<{ type: 'model' | 'provider' | 'conversation' | 'file'; id: string; name: string } | null>(null)

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
  tokenRatePer1000: 10,
  systemPrompt: '',
  fileMaxSizeMb: 20,
  fileMaxTotalSizeMb: 50,
  fileMaxCount: 5,
  webSearchQuotaTotal: 2500,
  webSearchUsedCredits: 0,
})

// ========================
// محاسبات سیستم اعتبار دلاری و سهمیه توکن (موارد ۱۵ و ۱۶)
// ========================
const tokenRatePer1000 = computed(() => {
  return Number(stats.value?.tokenRatePer1000) || 10 // پیش‌فرض: هر ۱۰۰۰ توکن = ۱۰ دلار
})

/** تبدیل تعداد توکن به مبلغ دلاری */
function tokensToDollars(tokens: number): number {
  return Number(((tokens / 1000) * tokenRatePer1000.value).toFixed(2))
}

/** تبدیل مبلغ دلاری به تعداد توکن معادل */
function dollarsToTokens(dollars: number): number {
  return Math.round((dollars / tokenRatePer1000.value) * 1000)
}

/** فیلد ورودی همگام‌ساز دلار در فرم ویرایش کاربر */
const userCreditDollarInput = ref<number | null>(null)

function onCreditDollarInput(val: string | number | null) {
  if (val === null || val === undefined || String(val).trim() === '') {
    userCreditDollarInput.value = null
    userForm.value.tokenLimit = null
    return
  }
  const num = Number(val)
  if (!isNaN(num) && num >= 0) {
    userCreditDollarInput.value = num
    userForm.value.tokenLimit = dollarsToTokens(num)
  }
}

function onTokenLimitInput(val: string | number | null) {
  if (val === null || val === undefined || String(val).trim() === '') {
    userForm.value.tokenLimit = null
    userCreditDollarInput.value = null
    return
  }
  const num = Number(val)
  if (!isNaN(num) && num >= 0) {
    userForm.value.tokenLimit = Math.round(num)
    userCreditDollarInput.value = tokensToDollars(num)
  }
}

/** دکمه‌های شارژ سریع کاربر با مبالغ رایج (مورد ۲: رفع باگ شارژ کاربر) */
function quickRecharge(addDollars: number) {
  const currentDollars = userCreditDollarInput.value ?? (userForm.value.tokenLimit ? tokensToDollars(userForm.value.tokenLimit) : 0)
  const newTotal = Number((currentDollars + addDollars).toFixed(2))
  userCreditDollarInput.value = newTotal
  userForm.value.tokenLimit = dollarsToTokens(newTotal)
}

/** دریافت آمار و درصد پر شدن سقف اعتبار کاربر برای نمایش دایره‌ای و بج وضعیت */
function getUserCreditStats(user: AdminUser) {
  const rate = tokenRatePer1000.value
  const usedTokens = Number(user.usedTokens || 0)
  const usedDollars = tokensToDollars(usedTokens)

  const hasSpecificLimit = user.tokenLimit !== null && user.tokenLimit !== undefined && user.tokenLimit > 0
  const globalLimit = Number(stats.value?.globalTokenLimit) || 0
  const limitTokens = hasSpecificLimit ? Number(user.tokenLimit) : globalLimit
  const totalCreditDollars = limitTokens > 0 ? Number(((limitTokens / 1000) * rate).toFixed(2)) : 0

  let remainingDollars = limitTokens > 0 ? Math.max(0, Number((totalCreditDollars - usedDollars).toFixed(2))) : null
  let usedPercent = 0
  let remainingPercent = 100
  if (limitTokens > 0) {
    usedPercent = Math.max(0, Math.min(100, Math.round((usedTokens / limitTokens) * 100)))
    remainingPercent = Math.max(0, 100 - usedPercent)
  }

  // انتخاب رنگ برای دایره بر مبنای میزان «پر شدن» سهمیه کاربر
  let strokeColor = '#10b981' // سبز (مصرف نرمال، کمتر از ۷۰٪)
  let textColor = 'text-emerald-600 dark:text-emerald-400'
  let badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
  let dotClass = 'bg-emerald-500'
  let statusLabel = 'مصرف نرمال'

  if (usedPercent >= 90) {
    strokeColor = '#ef4444' // قرمز (بالای ۹۰٪ یا اتمام سهمیه)
    textColor = 'text-rose-600 dark:text-rose-400'
    badgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
    dotClass = 'bg-rose-500'
    statusLabel = usedPercent >= 100 ? 'اتمام اعتبار' : 'در آستانه اتمام'
  } else if (usedPercent >= 70) {
    strokeColor = '#f59e0b' // زرد (بین ۷۰٪ تا ۹۰٪)
    textColor = 'text-amber-600 dark:text-amber-400'
    badgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    dotClass = 'bg-amber-500'
    statusLabel = 'نزدیک به سقف'
  }

  if (!limitTokens) {
    statusLabel = 'بدون سقف (سراسری)'
  }

  return {
    rate,
    usedTokens,
    usedDollars,
    limitTokens,
    totalCreditDollars,
    remainingDollars,
    remainingPercent,
    usedPercent,
    statusLabel,
    strokeColor,
    textColor,
    badgeClass,
    dotClass,
    hasLimit: limitTokens > 0,
    isSpecific: hasSpecificLimit,
  }
}

// Web-search quota display (Serper credits) — derived from the form so the
// bar updates live while typing; persisted via saveSettings.
const webSearchQuota = computed(() => Number(settingsForm.value.webSearchQuotaTotal) || 2500)
const webSearchUsed = computed(() => Math.max(0, Number(settingsForm.value.webSearchUsedCredits) || 0))
const webSearchRemaining = computed(() => Math.max(0, webSearchQuota.value - webSearchUsed.value))
const webSearchPercent = computed(() =>
  webSearchQuota.value > 0 ? Math.round((webSearchRemaining.value / webSearchQuota.value) * 100) : 0,
)
const webSearchLow = computed(
  () => webSearchQuota.value > 0 && webSearchRemaining.value / webSearchQuota.value < 0.1,
)

// Persian Labels
const labels = {
  dashboard: 'داشبورد',
  providers: 'ارائه‌دهنده‌ها',
  models: 'مدل‌ها',
  users: 'کاربران و سهمیه',
  prompts: 'پرامپت سیستم',
  chats: 'گفتگوها',
  back: 'بازگشت',
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
  conversationsCount: 'گفتگو',
  usedTokens: 'توکن مصرفی',
  tokenLimit: 'سقف توکن اختصاصی',
  globalLimit: 'سقف سراسری توکن',
  systemPrompt: 'دستورالعمل سیستم (System Prompt)',
  unlimited: 'نامحدود',
  status: 'وضعیت',
  actions: 'عملیات',
  modelCount: 'مدل',
  files: 'مدیریت فایل‌ها',
  filesTitle: 'مدیریت و پایش فایل‌های آپلودشده کاربران',
}

const navItems = computed(() => {
  return [
    { id: 'dashboard', label: labels.dashboard, icon: LayoutDashboard },
    { id: 'providers', label: labels.providers, icon: Network },
    { id: 'models', label: labels.models, icon: Boxes },
    { id: 'users', label: labels.users, icon: Users },
    { id: 'prompts', label: labels.prompts, icon: Sparkles },
    { id: 'chats', label: labels.chats, icon: MessageSquare },
    { id: 'files', label: labels.files, icon: FileText },
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

// Dashboard "top token consumers" — highest usage first, capped at 5 rows.
const topTokenConsumers = computed(() =>
  [...users.value].sort((a, b) => (b.usedTokens || 0) - (a.usedTokens || 0)).slice(0, 5)
)

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
  { key: 'edit', label: labels.edit, align: 'left' as const },
  { key: 'actions', label: labels.remove, align: 'left' as const },
]

// ========================
// تفکیک نام کاربر از ایمیل در تمام جداول (مورد ۴) و نمایش نمودار دایره‌ای اعتبار (مورد ۱۶)
// ========================
const userColumns = [
  { key: 'user', label: labels.user },
  { key: 'role', label: labels.role },
  { key: 'creditGauge', label: 'وضعیت سقف و مصرف توکن' },
  { key: 'conversations', label: labels.conversations },
  { key: 'isActive', label: labels.status },
  { key: 'edit', label: labels.edit, align: 'left' as const },
]

const chatColumns = [
  { key: 'title', label: 'عنوان گفتگو' },
  { key: 'user', label: 'کاربر' },
  { key: 'messageCount', label: 'تعداد پیام‌ها' },
  { key: 'updatedAt', label: 'تاریخ آخرین فعالیت' },
  { key: 'view', label: 'مشاهده پیام‌ها', align: 'left' as const },
  { key: 'actions', label: labels.remove, align: 'left' as const },
]

const fileColumns = [
  { key: 'name', label: 'نام فایل و نوع' },
  { key: 'user', label: 'کاربر' },
  { key: 'size', label: 'حجم' },
  { key: 'status', label: 'وضعیت پردازش' },
  { key: 'createdAt', label: 'زمان آپلود' },
  { key: 'view', label: 'مشاهده جزئیات', align: 'left' as const },
  { key: 'actions', label: labels.remove, align: 'left' as const },
]

function selectSection(section: AdminSection) {
  activeSection.value = section
  sidebarOpen.value = false
  searchQuery.value = ''
  debouncedSearchQuery.value = ''
  isSearchDebouncing.value = false
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  if (section === 'files') {
    loadFiles()
    loadFilesStats()
  } else if (section === 'chats') {
    loadConversations()
  }
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
      isActive: model.isActive,
    }
  } else {
    modelForm.value = {
      name: '',
      provider: providers.value[0]?.name || '',
      providerId: providers.value[0]?.id || '',
      apiIdentifier: '',
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
  const isModelAdd = !editingModel.value
  const modelFormActive = !!modelForm.value.isActive
  const modelPrevActive = editingModel.value?.isActive
  if (isModelAdd) {
    bumpStat('totalModels', 1)
    if (modelFormActive) bumpStat('activeModels', 1)
  } else if (modelPrevActive !== undefined && modelPrevActive !== modelFormActive) {
    bumpStat('activeModels', modelFormActive ? 1 : -1)
  }
  try {
    const provider =
      providers.value.find((item) => item.id === modelForm.value.providerId) ||
      providers.value.find((item) => item.name === modelForm.value.provider)
    const payload = {
      name: modelForm.value.name.trim(),
      provider: provider?.name || modelForm.value.provider.trim(),
      providerId: provider?.id || undefined,
      apiIdentifier: modelForm.value.apiIdentifier.trim(),
      isActive: modelForm.value.isActive,
    }

    if (editingModel.value) {
      await modelsService.updateModel(editingModel.value.id, payload)
    } else {
      await modelsStore.addModel(payload)
    }
    modelModalOpen.value = false
    await modelsStore.fetchModels(true).catch(() => {})
    await refreshStats()
    uiStore.showToast(editingModel.value ? 'مدل با موفقیت ویرایش شد.' : 'مدل جدید با موفقیت اضافه شد.', 'success')
  } catch (error: any) {
    if (isModelAdd) {
      bumpStat('totalModels', -1)
      if (modelFormActive) bumpStat('activeModels', -1)
    } else if (modelPrevActive !== undefined && modelPrevActive !== modelFormActive) {
      bumpStat('activeModels', modelFormActive ? -1 : 1)
    }
    errorMessage.value = error?.message || 'ذخیره اطلاعات مدل با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

async function toggleModel(model: Model) {
  const prev = model.isActive
  const next = !prev
  model.isActive = next
  bumpStat('activeModels', next ? 1 : -1)
  try {
    const updated = await modelsService.updateModelStatus(model.id, next)
    await modelsStore.fetchModels(true)
    if (updated && typeof updated.isActive === 'boolean' && updated.isActive !== next) {
      model.isActive = updated.isActive
      bumpStat('activeModels', updated.isActive ? 1 : -1)
    }
    uiStore.showToast(`وضعیت مدل «${model.name}» تغییر کرد.`, 'info')
  } catch (error: any) {
    model.isActive = prev
    bumpStat('activeModels', prev ? 1 : -1)
    errorMessage.value = error?.message || 'تغییر وضعیت مدل با خطا مواجه شد'
  }
}

async function setPlatformDefault(model: Model) {
  const prevId = markDefaultModel(modelsStore.models, model.id)
  try {
    await modelsService.setDefaultModel(model.id)
    await modelsStore.fetchModels(true).catch(() => {})
    uiStore.showToast(`مدل «${model.name}» به عنوان پیش‌فرض پلتفرم انتخاب شد.`, 'success')
  } catch (error: any) {
    if (prevId !== undefined) {
      markDefaultModel(modelsStore.models, prevId)
    } else {
      modelsStore.models.forEach((m) => {
        m.isDefault = false
      })
    }
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
  const isProviderAdd = !editingProvider.value
  const providerFormActive = !!providerForm.value.isActive
  const providerPrevActive = editingProvider.value?.isActive
  if (isProviderAdd) {
    bumpStat('totalProviders', 1)
    if (providerFormActive) bumpStat('activeProviders', 1)
  } else if (providerPrevActive !== undefined && providerPrevActive !== providerFormActive) {
    bumpStat('activeProviders', providerFormActive ? 1 : -1)
  }
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
    await refreshStats()
    providerModalOpen.value = false
    uiStore.showToast(editingProvider.value ? 'ارائه‌دهنده با موفقیت ویرایش شد.' : 'ارائه‌دهنده جدید اضافه شد.', 'success')
  } catch (error: any) {
    if (isProviderAdd) {
      bumpStat('totalProviders', -1)
      if (providerFormActive) bumpStat('activeProviders', -1)
    } else if (providerPrevActive !== undefined && providerPrevActive !== providerFormActive) {
      bumpStat('activeProviders', providerFormActive ? -1 : 1)
    }
    errorMessage.value = error?.message || 'ذخیره اطلاعات ارائه‌دهنده با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

async function toggleProvider(provider: Provider) {
  const prev = provider.isActive
  const next = !prev
  provider.isActive = next
  bumpStat('activeProviders', next ? 1 : -1)
  try {
    const updated = await modelsService.updateProviderStatus(provider.id, next)
    if (updated && typeof updated.isActive === 'boolean') {
      provider.isActive = updated.isActive
      if (updated.isActive !== next) bumpStat('activeProviders', updated.isActive ? 1 : -1)
    }
    const data = await modelsService.listProviders()
    providers.value = Array.isArray(data) ? data : []
    await modelsStore.fetchModels(true)
    // Provider toggles can cascade to its models — reconcile counters.
    await refreshStats()
    uiStore.showToast(`وضعیت ارائه‌دهنده «${provider.name}» تغییر کرد.`, 'info')
  } catch (error: any) {
    provider.isActive = prev
    bumpStat('activeProviders', prev ? 1 : -1)
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
  userCreditDollarInput.value = user.tokenLimit
    ? Number(((user.tokenLimit / 1000) * tokenRatePer1000.value).toFixed(2))
    : null
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
      // توجه: توکن مصرفی طبق خواسته کارفرما کاملاً ثابت و غیرقابل دستکاری توسط ادمین است و در payload ارسال نمی‌شود
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
  const prevActive = user.isActive
  const nextState = prevActive === false
  user.isActive = nextState
  try {
    await adminService.updateUserStatus(user.id, nextState)
    uiStore.showToast(`وضعیت حساب «${user.displayName || user.email}» تغییر کرد.`, 'info')
  } catch (error: any) {
    user.isActive = prevActive
    errorMessage.value = error?.message || 'تغییر وضعیت کاربر با خطا مواجه شد'
  }
}

// System Prompt & Settings handlers
function openSettingsEditor() {
  settingsForm.value = {
    globalTokenLimit: stats.value?.globalTokenLimit ?? 0,
    tokenRatePer1000: stats.value?.tokenRatePer1000 ?? 10,
    systemPrompt: stats.value?.systemPrompt ?? '',
    fileMaxSizeMb: (stats.value as any)?.fileMaxSizeMb ?? 20,
    fileMaxTotalSizeMb: (stats.value as any)?.fileMaxTotalSizeMb ?? 50,
    fileMaxCount: (stats.value as any)?.fileMaxCount ?? 5,
    webSearchQuotaTotal: stats.value?.webSearchUsage?.total ?? 2500,
    webSearchUsedCredits: stats.value?.webSearchUsage?.used ?? 0,
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
      tokenRatePer1000: Number(settingsForm.value.tokenRatePer1000) || 10,
      systemPrompt: settingsForm.value.systemPrompt.trim() || undefined,
      fileMaxSizeMb: Number(settingsForm.value.fileMaxSizeMb) || 20,
      fileMaxTotalSizeMb: Number(settingsForm.value.fileMaxTotalSizeMb) || 50,
      fileMaxCount: Number(settingsForm.value.fileMaxCount) || 5,
      webSearchQuotaTotal: Number(settingsForm.value.webSearchQuotaTotal) || 2500,
      webSearchUsedCredits: Math.max(0, Number(settingsForm.value.webSearchUsedCredits) || 0),
    })
    if (stats.value) {
      stats.value.globalTokenLimit = res.globalTokenLimit
      stats.value.tokenRatePer1000 = res.tokenRatePer1000
      stats.value.systemPrompt = res.systemPrompt
      if (res.webSearchUsage) stats.value.webSearchUsage = res.webSearchUsage
    }
    settingsModalOpen.value = false
    uiStore.showToast('تنظیمات با موفقیت ذخیره شد.', 'success')
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
async function loadConversations(page = chatPage.value) {
  isLoadingConversations.value = true
  chatPage.value = page
  try {
    conversations.value = await adminService.listConversations({
      page: chatPage.value,
      limit: chatLimit.value,
    })
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
      const targetId = deleteTarget.value.id
      const wasActive = modelsStore.models.find((m) => m.id === targetId)?.isActive !== false
      bumpStat('totalModels', -1)
      if (wasActive) bumpStat('activeModels', -1)
      try {
        await modelsStore.removeModel(targetId)
        await refreshStats()
      } catch (err) {
        bumpStat('totalModels', 1)
        if (wasActive) bumpStat('activeModels', 1)
        throw err
      }
    } else if (deleteTarget.value.type === 'provider') {
      const targetId = deleteTarget.value.id
      const prevList = [...providers.value]
      const wasActive = prevList.find((p) => p.id === targetId)?.isActive !== false
      providers.value = prevList.filter((p) => p.id !== targetId)
      bumpStat('totalProviders', -1)
      if (wasActive) bumpStat('activeProviders', -1)
      try {
        await modelsService.deleteProvider(targetId)
        const data = await modelsService.listProviders()
        providers.value = Array.isArray(data) ? data : []
        await modelsStore.fetchModels(true)
        await refreshStats()
      } catch (err) {
        providers.value = prevList
        bumpStat('totalProviders', 1)
        if (wasActive) bumpStat('activeProviders', 1)
        throw err
      }
    } else if (deleteTarget.value.type === 'conversation') {
      const targetId = deleteTarget.value.id
      const prevList = [...conversations.value]
      conversations.value = prevList.filter((c) => c.id !== targetId)
      bumpStat('totalConversations', -1)
      try {
        await adminService.deleteConversation(targetId)
        await refreshStats()
        uiStore.showToast('گفتگو با موفقیت حذف شد.', 'success')
      } catch (err) {
        conversations.value = prevList
        bumpStat('totalConversations', 1)
        throw err
      }
    } else if (deleteTarget.value.type === 'file') {
      await adminService.deleteFile(deleteTarget.value.id)
      files.value = files.value.filter((f) => f.id !== deleteTarget.value?.id)
      uiStore.showToast('فایل با موفقیت حذف شد.', 'success')
      loadFilesStats()
    }
    deleteModalOpen.value = false
    deleteTarget.value = null
  } catch (error: any) {
    errorMessage.value = error?.message || 'حذف مورد انتخابی با خطا مواجه شد'
  } finally {
    isSaving.value = false
  }
}

// Files management handlers
async function loadFiles() {
  isLoadingFiles.value = true
  try {
    const res = await adminService.listFiles({
      page: filePage.value,
      limit: fileLimit.value,
      status: fileStatusFilter.value !== 'all' ? fileStatusFilter.value : undefined,
      search: debouncedSearchQuery.value || undefined,
      userId: fileUserFilter.value?.id || undefined,
    })
    files.value = res.items || []
    fileTotal.value = res.total || 0
    fileTotalPages.value = res.totalPages || 1
  } catch (err: any) {
    console.error('Failed to load admin files:', err)
  } finally {
    isLoadingFiles.value = false
  }
}

async function loadFilesStats() {
  try {
    fileStats.value = await adminService.getFileStats()
  } catch (err: any) {
    console.error('Failed to load admin file stats:', err)
  }
}

function changeFileStatusFilter(status: 'all' | 'processing' | 'ready' | 'error') {
  fileStatusFilter.value = status
  filePage.value = 1
  loadFiles()
}

function changeFilePage(newPage: number) {
  if (newPage < 1 || newPage > fileTotalPages.value) return
  filePage.value = newPage
  loadFiles()
}

async function openFileDetails(file: AdminFileItem) {
  isLoadingFileDetail.value = true
  isFileDetailModalOpen.value = true
  try {
    inspectingFile.value = await adminService.getFileDetail(file.id)
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در دریافت جزئیات فایل', 'error')
    isFileDetailModalOpen.value = false
  } finally {
    isLoadingFileDetail.value = false
  }
}

async function handleRetryFile(file: AdminFileItem) {
  isRetryingFile.value = file.id
  try {
    await adminService.retryFile(file.id)
    file.status = 'processing'
    file.errorMessage = undefined
    uiStore.showToast(`فایل «${file.originalName}» برای پردازش مجدد به صف ارسال شد.`, 'success')
    loadFilesStats()
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تلاش مجدد فایل', 'error')
  } finally {
    isRetryingFile.value = null
  }
}

function promptDeleteFile(file: AdminFileItem) {
  deleteTarget.value = { type: 'file', id: file.id, name: file.originalName || 'فایل' }
  deleteModalOpen.value = true
}

function openSignozDashboard() {
  window.open('http://localhost:3301', '_blank')
}

function getFileDownloadUrl(fileId: string): string {
  const token = localStorage.getItem('token')
  const qs = token ? `?token=${encodeURIComponent(token)}` : ''
  return buildUrl(`/files/${fileId}/content${qs}`)
}

function formatFileSize(bytes?: number): string {
  const b = bytes || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'ready':
      return 'status-ready'
    case 'processing':
      return 'status-processing'
    case 'error':
      return 'status-error'
    case 'uploading':
      return 'status-uploading'
    default:
      return ''
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return 'آماده'
    case 'processing':
      return 'در حال پردازش...'
    case 'error':
      return 'خطا در پردازش'
    case 'uploading':
      return 'در حال آپلود...'
    default:
      return status
  }
}

function getAttBadgeClass(fileType: string): string {
  switch (fileType) {
    case 'pdf':
      return 'badge-pdf'
    case 'excel':
      return 'badge-excel'
    case 'image':
      return 'badge-image'
    default:
      return 'badge-text'
  }
}

watch(debouncedSearchQuery, () => {
  if (activeSection.value === 'files') {
    filePage.value = 1
    loadFiles()
  }
})

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
        <img
          v-if="authStore.user?.avatarUrl"
          :src="authStore.user.avatarUrl"
          alt=""
          class="admin-avatar admin-avatar-image"
        />
        <div v-else class="admin-avatar">{{ adminInitial }}</div>
        <div class="admin-brand-text">
          <strong>{{ adminName }}</strong>
        </div>
      </div>

      <nav class="admin-nav" aria-label="منوی مدیریت">
        <button
          v-for="item in navItems"
          :key="item.id"
          :data-admin-section="item.id"
          :class="{ active: activeSection === item.id }"
          @click="selectSection(item.id as AdminSection)"
        >
          <component
            :is="item.icon"
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
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          {{ labels.back }}
        </button>
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
                : activeSection === 'files'
                ? labels.filesTitle
                : labels.chatsTitle
            }}
          </h1>
          <span class="sr-only">ADMIN</span>
        </div>

        <div class="topbar-actions">
          <!-- سرچ بالای هر صفحه با مشخص بودن دقیق فیلدهای مورد جستجو بر اساس بخش فعال -->
          <div
            v-if="activeSection !== 'dashboard' && activeSection !== 'prompts'"
            class="topbar-search-container flex flex-col items-start gap-1"
          >
            <div class="search-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                v-model="searchQuery"
                class="admin-search search-input"
                :placeholder="currentSearchScope.placeholder"
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
            <!-- نمایش فیلدهای تحت جستجو بر اساس دیتا گرید -->
            <div v-if="currentSearchScope.fields.length" class="search-fields-chips flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
              <span>فیلدهای جستجو:</span>
              <span
                v-for="f in currentSearchScope.fields"
                :key="f"
                class="px-1.5 py-0.2 rounded bg-secondary text-foreground text-[10px] font-medium"
              >
                {{ f }}
              </span>
            </div>
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
                v-for="user in topTokenConsumers"
                :key="user.id"
                class="usage-row"
              >
                <span class="avatar-chip">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ user.displayName || user.email }}</strong>
                  <small>{{ user.conversationsCount }} {{ labels.conversationsCount }}</small>
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
            paginated
            searchable
            :pageSize="5"
            :pageSizes="[5, 10, 20]"
          >
            <template #row="{ item: model }">
              <td :data-label="labels.modelName">
                <div class="cell-primary">
                  <strong>{{ model.name }}</strong>
                  <span v-if="model.isDefault" class="subtext-badge">{{ labels.default }}</span>
                </div>
              </td>
              <td :data-label="labels.provider"><span class="tag">{{ model.provider }}</span></td>
              <td :data-label="labels.apiId" class="mono subtext">{{ model.apiIdentifier }}</td>
              <td :data-label="labels.status">
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
          paginated
          searchable
          :pageSize="10"
          :pageSizes="[10, 25, 50, 100]"
        >
          <template #row="{ item: model }">
            <td :data-label="labels.modelName">
              <div class="cell-primary">
                <strong>{{ model.name }}</strong>
                <span v-if="model.isDefault" class="subtext-badge">{{ labels.default }}</span>
              </div>
            </td>
            <td :data-label="labels.provider"><span class="tag">{{ model.provider }}</span></td>
            <td :data-label="labels.apiId" class="mono subtext">{{ model.apiIdentifier }}</td>
            <td :data-label="labels.status">
              <BaseToggle
                :model-value="model.isActive"
                size="sm"
                @update:model-value="toggleModel(model)"
              />
            </td>
            <td :data-label="labels.actions" class="actions-cell">
              <div class="action-buttons">
                <BaseButton
                  variant="ghost"
                  size="sm"
                  icon
                  :title="model.isDefault ? 'مدل پیش‌فرض فعلی' : 'تعیین به‌عنوان مدل پیش‌فرض سراسری'"
                  :disabled="model.isDefault"
                  data-testid="make-default-model"
                  @click="setPlatformDefault(model)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" :fill="model.isDefault ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" :class="model.isDefault ? 'text-amber-400' : ''">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </BaseButton>
                <BaseButton variant="ghost" size="sm" @click="openModelEditor(model)">
                  {{ labels.edit }}
                </BaseButton>
                <BaseButton variant="danger" size="sm" icon :title="labels.remove" @click="promptDeleteModel(model)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
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

        <AdminTable :columns="userColumns" :items="filteredUsers" paginated searchable :pageSize="10" :pageSizes="[10, 25, 50, 100]">
          <template #row="{ item: user }">
            <!-- تفکیک ستون نام کاربر (مورد ۴) -->
            <td data-label="نام کاربر">
              <div class="user-cell">
                <span class="avatar-chip">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ user.displayName || '—' }}</strong>
                  <span class="subtext">{{ user.email }}</span>
                </div>
              </div>
            </td>
            <td :data-label="labels.role">
              <span class="tag" :class="{ 'tag-admin': user.role === 'admin' }">
                {{ user.role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی' }}
              </span>
            </td>

            <!-- وضعیت سقف و مصرف توکن به صورت دایره با نمایش درصد پر شده -->
            <td data-label="وضعیت سقف و مصرف توکن">
              <div class="user-credit-gauge-cell flex items-center gap-3">
                <!-- حلقه دایره‌ای SVG پیشرفت -->
                <div class="credit-ring-box shrink-0" :title="`میزان پر شده: ${getUserCreditStats(user).usedPercent}٪`">
                  <svg width="44" height="44" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      class="stroke-muted/30 dark:stroke-muted/20"
                      stroke-width="3.2"
                    />
                    <circle
                      v-if="getUserCreditStats(user).hasLimit"
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      :stroke="getUserCreditStats(user).strokeColor"
                      stroke-width="3.2"
                      stroke-linecap="round"
                      stroke-dasharray="100"
                      :stroke-dashoffset="100 - getUserCreditStats(user).usedPercent"
                      class="transition-all duration-500 ease-out"
                    />
                    <text
                      x="18"
                      y="20.5"
                      text-anchor="middle"
                      class="text-[9.5px] font-bold font-mono fill-foreground"
                    >
                      {{ getUserCreditStats(user).hasLimit ? `${getUserCreditStats(user).usedPercent}٪` : '∞' }}
                    </text>
                  </svg>
                </div>

                <!-- اطلاعات متنی تکمیلی در کنار دایره -->
                <div class="credit-info-details flex flex-col gap-0.5">
                  <div class="flex items-center gap-1 text-xs">
                    <span class="font-bold text-foreground font-mono">{{ Number(user.usedTokens || 0).toLocaleString('fa-IR') }}</span>
                    <span class="text-muted-foreground text-[10px]">از {{ user.tokenLimit ? Number(user.tokenLimit).toLocaleString('fa-IR') : 'نامحدود' }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                    <span>${{ getUserCreditStats(user).usedDollars }} مصرفی</span>
                    <span v-if="getUserCreditStats(user).hasLimit">/ ${{ getUserCreditStats(user).totalCreditDollars }} کل</span>
                  </div>
                  <div>
                    <span class="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold" :class="getUserCreditStats(user).badgeClass">
                      {{ getUserCreditStats(user).statusLabel }}
                    </span>
                  </div>
                </div>
              </div>
            </td>

            <!-- تعداد گفتگوها -->
            <td :data-label="labels.conversations" class="mono">{{ user.conversationsCount }}</td>

            <!-- وضعیت فعالیت -->
            <td :data-label="labels.status">
              <BaseToggle
                :model-value="user.isActive !== false"
                size="sm"
                @update:model-value="toggleUser(user)"
              />
            </td>

            <!-- عملیات: ویرایش و مشاهده فایل‌های اختصاصی کاربر (مورد ۱۴) -->
            <td :data-label="labels.actions" class="actions-cell">
              <div class="action-buttons flex items-center gap-1.5">
                <BaseButton variant="ghost" size="sm" @click="openUserEditor(user)">
                  {{ labels.edit }}
                </BaseButton>
                <BaseButton
                  variant="secondary"
                  size="sm"
                  title="مشاهده تمام فایل‌های آپلود شده توسط این کاربر"
                  @click="filterFilesByUser(user)"
                >
                  فایل‌ها
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

        <AdminTable :columns="chatColumns" :items="filteredChats" paginated searchable :pageSize="10" :pageSizes="[10, 25, 50, 100]">
          <template #row="{ item: conv }">
            <td data-label="عنوان گفتگو">
              <div class="chat-title-cell">
                <MessageSquare :size="15" class="chat-row-icon" />
                <div>
                  <strong>{{ conv.title || 'بدون عنوان' }}</strong>
                  <span class="subtext mono">{{ conv.id.slice(0, 8) }}...</span>
                </div>
              </div>
            </td>
            <td data-label="کاربر">
              <div class="user-cell">
                <span class="avatar-chip">{{ (conv.user?.displayName || conv.user?.email || 'U').charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ conv.user?.displayName || '—' }}</strong>
                  <span class="subtext">{{ conv.user?.email || 'کاربر ناشناس' }}</span>
                </div>
              </div>
            </td>
            <td data-label="تعداد پیام‌ها" class="mono">
              <span class="message-count-badge">{{ conv.messageCount }} پیام</span>
            </td>

            <!-- تاریخ آخرین فعالیت با منطقه زمانی رسمی ایران (مورد ۸) -->
            <td data-label="تاریخ آخرین فعالیت" class="mono subtext text-xs">
              {{ formatIranDate(conv.updatedAt || conv.createdAt) }}
            </td>
            <td :data-label="labels.actions" class="actions-cell">
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

        <!-- Pagination Controls for Chats Table -->
        <div class="table-pagination-bar" v-if="filteredChats.length > 0 || chatPage > 1">
          <div class="pagination-info">
            <span>صفحه {{ chatPage.toLocaleString('fa-IR') }}</span>
            <span class="pagination-subtext">(نمایش ۵۰ مورد در هر صفحه)</span>
          </div>
          <div class="pagination-actions">
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="chatPage <= 1 || isLoadingConversations"
              @click="loadConversations(chatPage - 1)"
            >
              صفحه قبل
            </BaseButton>
            <span class="pagination-page-badge">{{ chatPage.toLocaleString('fa-IR') }}</span>
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="conversations.length < chatLimit || isLoadingConversations"
              @click="loadConversations(chatPage + 1)"
            >
              صفحه بعد
            </BaseButton>
          </div>
        </div>
      </section>

      <!-- 7. FILES MANAGEMENT SECTION -->
      <section v-else-if="activeSection === 'files'" class="admin-content files-panel">
        <!-- Section Toolbar -->
        <div class="section-toolbar">
          <div class="section-title-wrap">
            <h3 class="section-heading">{{ labels.filesTitle }}</h3>
            <span class="record-badge">{{ fileTotal }} فایل ثبت‌شده</span>
          </div>
          <div class="toolbar-actions flex items-center gap-2">
            <BaseButton
              variant="secondary"
              size="sm"
              class="signoz-btn flex items-center gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
              title="باز کردن داشبورد مانیتورینگ SigNoz (پورت 3301)"
              @click="openSignozDashboard"
            >
              <ExternalLink :size="14" />
              <span>داشبورد SigNoz (مانیتورینگ تریس‌ها)</span>
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="md"
              icon
              title="تازه‌سازی لیست فایل‌ها"
              @click="loadFiles(); loadFilesStats()"
            >
              <RefreshCw :size="15" />
            </BaseButton>
          </div>
        </div>

        <!-- راهنمای شفاف‌سازی وضعیت در حال پردازش و چرخه حیات فایل‌ها (موارد ۵، ۱۱ و ۱۲) -->
        <div class="file-lifecycle-guide p-3.5 rounded-xl bg-secondary/70 border border-border mb-4 text-xs">
          <div class="flex items-center gap-2 font-bold text-foreground mb-1.5">
            <Sparkles :size="16" class="text-primary" />
            <span>راهنمای چرخه پردازش فایل‌ها و وضعیت «در حال پردازش» در صف سیستم:</span>
          </div>
          <p class="text-muted-foreground leading-relaxed mb-2">
            فایل‌های بارگذاری‌شده کاربران (شامل PDF، تصاویر، اکسل و متون) جهت جلوگیری از کُند شدن چت، مستقیماً وارد مسیر اصلی هوش مصنوعی نمی‌شوند؛ بلکه به صف پردازش پس‌زمینه (BullMQ) ارسال می‌شوند تا متن، جداول و ابعاد آن‌ها استخراج شود.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
            <div class="p-2 rounded-lg bg-background/80 border border-border">
              <span class="font-bold text-primary block mb-0.5">۱. در حال پردازش (Processing)</span>
              <span class="text-muted-foreground">فایل در فضای ذخیره‌سازی قرار گرفته و جاب پردازش متنی/OCR آن در صف Redis/BullMQ در حال اجراست.</span>
            </div>
            <div class="p-2 rounded-lg bg-background/80 border border-border">
              <span class="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">۲. آماده (Ready)</span>
              <span class="text-muted-foreground">استخراج محتوا و تحلیل تصویر با موفقیت پایان یافته و مدل می‌تواند به پیام کاربر پاسخ دهد.</span>
            </div>
            <div class="p-2 rounded-lg bg-background/80 border border-border">
              <span class="font-bold text-rose-600 dark:text-rose-400 block mb-0.5">۳. پاکسازی فایل‌های معلق (۴۸ ساعته)</span>
              <span class="text-muted-foreground">اگر کاربر فایلی آپلود کند اما پیامی ارسال نکند، پس از ۴۸ ساعت کران‌جاب پاکسازی خودکار آن را حذف امن می‌کند.</span>
            </div>
          </div>
        </div>

        <!-- بنر نمایش فیلتر فایل‌های اختصاصی کاربر (مورد ۱۴) -->
        <div
          v-if="fileUserFilter"
          class="user-filter-banner flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 mb-4 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="font-bold text-primary">فیلتر فعال: فایل‌های کاربر</span>
            <span class="font-semibold text-foreground">{{ fileUserFilter.displayName || fileUserFilter.email }}</span>
            <span class="mono text-muted-foreground text-[11px]">({{ fileUserFilter.email }})</span>
          </div>
          <button
            type="button"
            class="text-xs text-destructive hover:underline font-medium flex items-center gap-1"
            @click="clearFileUserFilter"
          >
            <span>✕</span>
            <span>نمایش همه فایل‌ها</span>
          </button>
        </div>

        <!-- KPI Metrics for Files -->
        <div class="kpi-strip files-kpi-strip">
          <!-- Total Files -->
          <article class="kpi-card metric-card">
            <div class="kpi-head">
              <span class="kpi-title">کل فایل‌ها</span>
              <div class="kpi-icon-pill">
                <FileText :size="16" />
              </div>
            </div>
            <strong class="kpi-value">{{ fileStats?.totalFiles ?? fileTotal }}</strong>
            <small class="kpi-sub">{{ fileStats?.totalSizeMb ?? 0 }} مگابایت مصرف فضا</small>
          </article>

          <!-- Processing Files -->
          <article class="kpi-card metric-card">
            <div class="kpi-head">
              <span class="kpi-title">در حال پردازش در صف</span>
              <div class="kpi-icon-pill status-pill-blue">
                <Loader2 :size="16" class="animate-spin text-primary" />
              </div>
            </div>
            <strong class="kpi-value">{{ fileStats?.processingFiles ?? 0 }}</strong>
            <small class="kpi-sub">جاب‌های فعال صف BullMQ</small>
          </article>

          <!-- Ready Files -->
          <article class="kpi-card metric-card">
            <div class="kpi-head">
              <span class="kpi-title">آماده و پردازش‌شده</span>
              <div class="kpi-icon-pill status-pill-green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <strong class="kpi-value text-green-500">{{ fileStats?.readyFiles ?? 0 }}</strong>
            <small class="kpi-sub">متن استخراج‌شده و قابل چت</small>
          </article>

          <!-- Error Files -->
          <article class="kpi-card metric-card" :class="{ 'card-has-error': (fileStats?.errorFiles || 0) > 0 }">
            <div class="kpi-head">
              <span class="kpi-title">دارای خطا</span>
              <div class="kpi-icon-pill status-pill-red">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            </div>
            <strong class="kpi-value" :class="(fileStats?.errorFiles || 0) > 0 ? 'text-red-500' : ''">
              {{ fileStats?.errorFiles ?? 0 }}
            </strong>
            <small class="kpi-sub">نیازمند بازبینی یا تلاش مجدد</small>
          </article>
        </div>

        <!-- Filter Chips Bar -->
        <div class="file-filter-chips flex items-center gap-2 mb-4">
          <span class="text-xs text-muted-foreground ml-1">فیلتر وضعیت:</span>
          <button
            type="button"
            class="filter-chip"
            :class="{ active: fileStatusFilter === 'all' }"
            @click="changeFileStatusFilter('all')"
          >
            همه ({{ fileStats?.totalFiles ?? fileTotal }})
          </button>
          <button
            type="button"
            class="filter-chip filter-chip-processing"
            :class="{ active: fileStatusFilter === 'processing' }"
            @click="changeFileStatusFilter('processing')"
          >
            در حال پردازش ({{ fileStats?.processingFiles ?? 0 }})
          </button>
          <button
            type="button"
            class="filter-chip filter-chip-ready"
            :class="{ active: fileStatusFilter === 'ready' }"
            @click="changeFileStatusFilter('ready')"
          >
            آماده ({{ fileStats?.readyFiles ?? 0 }})
          </button>
          <button
            type="button"
            class="filter-chip filter-chip-error"
            :class="{ active: fileStatusFilter === 'error' }"
            @click="changeFileStatusFilter('error')"
          >
            دارای خطا ({{ fileStats?.errorFiles ?? 0 }})
          </button>
        </div>

        <!-- Files Table -->
        <AdminTable :columns="fileColumns" :items="files" paginated searchable :pageSize="10" :pageSizes="[10, 25, 50, 100]">
          <template #row="{ item: file }">
            <td data-label="نام فایل و نوع">
              <div class="file-name-cell flex items-center gap-2.5">
                <span :class="['att-badge px-2 py-1 rounded text-[10px] font-bold uppercase', getAttBadgeClass(file.fileType)]">
                  {{ file.fileType }}
                </span>
                <strong class="block truncate max-w-[200px]" :title="file.originalName">{{ file.originalName }}</strong>
              </div>
            </td>
            <td>
              <div class="user-cell">
                <span class="avatar-chip">{{ (file.user?.displayName || file.user?.email || 'U').charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ file.user?.displayName || '—' }}</strong>
                  <span class="subtext">{{ file.user?.email || 'کاربر ناشناس' }}</span>
                </div>
              </div>
            </td>
            <td class="mono text-xs">
              {{ formatFileSize(file.fileSize) }}
            </td>
            <td>
              <div class="status-cell flex items-center gap-1.5">
                <span :class="['status-badge-pill px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1', getStatusClass(file.status)]">
                  <span v-if="file.status === 'processing'" class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                  <span v-else-if="file.status === 'ready'" class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span v-else-if="file.status === 'error'" class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {{ getStatusLabel(file.status) }}
                </span>
              </div>
            </td>

            <!-- زمان آپلود بر مبنای منطقه زمانی رسمی ایران (مورد ۸) -->
            <td class="mono subtext text-xs">
              {{ formatIranDateTime(file.createdAt) }}
            </td>
            <td class="actions-cell">
              <div class="action-buttons flex items-center gap-1.5">
                <BaseButton variant="secondary" size="sm" @click="openFileDetails(file)">
                  مشاهده جزئیات
                </BaseButton>
                <BaseButton
                  v-if="file.status === 'error'"
                  variant="secondary"
                  size="sm"
                  :loading="isRetryingFile === file.id"
                  @click="handleRetryFile(file)"
                >
                  تلاش مجدد
                </BaseButton>
                <BaseButton variant="danger" size="sm" @click="promptDeleteFile(file)">
                  {{ labels.remove }}
                </BaseButton>
              </div>
            </td>
          </template>
        </AdminTable>

        <!-- Pagination for files -->
        <div v-if="fileTotalPages > 1" class="table-pagination-bar flex items-center justify-between mt-4 p-2">
          <span class="text-xs text-muted-foreground">
            صفحه {{ filePage }} از {{ fileTotalPages }} (کل: {{ fileTotal }} فایل)
          </span>
          <div class="flex items-center gap-2">
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="filePage <= 1"
              @click="changeFilePage(filePage - 1)"
            >
              صفحه قبل
            </BaseButton>
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="filePage >= fileTotalPages"
              @click="changeFilePage(filePage + 1)"
            >
              صفحه بعد
            </BaseButton>
          </div>
        </div>
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
          <!-- توکن مصرف‌شده: کاملاً ثابت و غیرقابل دستکاری توسط ادمین (درخواست کارفرما) -->
          <div class="user-consumed-box p-3 rounded-lg bg-muted/40 border border-border flex flex-col gap-1">
            <span class="field-label text-xs font-semibold text-muted-foreground">{{ labels.usedTokens }} (ثابت):</span>
            <div class="flex items-center justify-between">
              <span class="font-mono text-sm font-bold text-foreground">
                {{ Number(userForm.usedTokens || 0).toLocaleString('fa-IR') }} توکن
              </span>
              <span class="font-mono text-xs text-muted-foreground">
                معادل ${{ tokensToDollars(userForm.usedTokens || 0) }} مصرف‌شده
              </span>
            </div>
          </div>

          <!-- فیلد تخصیص اعتبار دلاری و سهمیه معادل با قابلیت شارژ سریع (مورد ۲: رفع باگ شارژ کاربر) -->
          <div class="col-span-full p-3.5 rounded-xl bg-secondary/70 border border-border space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-foreground">شارژ و سقف اعتبار کاربر:</span>
              <span class="text-[11px] text-muted-foreground mono font-medium">نرخ فعال: هر ۱۰۰۰ توکن = ${{ tokenRatePer1000 }}</span>
            </div>

            <!-- دکمه‌های شارژ سریع -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs text-muted-foreground">شارژ سریع:</span>
              <button
                type="button"
                class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
                @click="quickRecharge(10)"
              >
                + ۱۰$
              </button>
              <button
                type="button"
                class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
                @click="quickRecharge(25)"
              >
                + ۲۵$
              </button>
              <button
                type="button"
                class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
                @click="quickRecharge(50)"
              >
                + ۵۰$
              </button>
              <button
                type="button"
                class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
                @click="quickRecharge(100)"
              >
                + ۱۰۰$
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span class="field-label">شارژ سقف دلاری ($ USD)</span>
                <input
                  :value="userCreditDollarInput"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="مثال: 50"
                  :disabled="isSaving"
                  @input="onCreditDollarInput(($event.target as HTMLInputElement).value)"
                />
              </label>
              <label>
                <span class="field-label">معادل سقف توکن</span>
                <input
                  :value="userForm.tokenLimit"
                  type="number"
                  min="0"
                  placeholder="خالی = سقف سراسری سامانه"
                  :disabled="isSaving"
                  @input="onTokenLimitInput(($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>
            <small class="text-[11px] text-muted-foreground block leading-relaxed">
              با تغییر هر یک از فیلدهای بالا (دلار یا توکن)، فیلد دیگر به صورت خودکار با نرخ برابری روزانه همگام می‌شود. برای حذف سقف اختصاصی، کادر را خالی بگذارید.
            </small>
          </div>
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
      title="تنظیمات سقف مصرف، نرخ اعتبار و پرامپت سیستم"
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
          <!-- فیلد تنظیم نرخ دلاری توکن‌ها (مورد ۱۵) -->
          <label class="col-span-full">
            <span class="field-label">
              نرخ هر ۱۰۰۰ توکن به دلار ($ USD) — برای سیستم اعتبار و کسر سهمیه
            </span>
            <input
              v-model.number="settingsForm.tokenRatePer1000"
              type="number"
              step="0.1"
              min="0.1"
              required
              placeholder="مثال: 10 (هر ۱۰۰۰ توکن = ۱۰ دلار)"
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

          <!-- Web Search Quota (Serper credits) -->
          <div class="col-span-full settings-section-divider">
            <span class="settings-section-label">اعتبار جستجوی وب (Serper)</span>
          </div>
          <div class="col-span-full">
            <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>باقی‌مانده: {{ webSearchRemaining.toLocaleString() }} از {{ webSearchQuota.toLocaleString() }}</span>
              <span v-if="webSearchLow" class="font-medium text-amber-600 dark:text-amber-400">اعتبار رو به اتمام است</span>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-all" :style="{ width: webSearchPercent + '%' }"></div>
            </div>
          </div>
          <label>
            <span class="field-label">سقف اعتبار جستجو</span>
            <input
              v-model.number="settingsForm.webSearchQuotaTotal"
              type="number"
              min="1"
              :disabled="isSaving"
            />
          </label>
          <label>
            <span class="field-label">مصرف‌شده (اصلاح دستی برای تطبیق با داشبورد Serper)</span>
            <input
              v-model.number="settingsForm.webSearchUsedCredits"
              type="number"
              min="0"
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
      @close="isChatModalOpen = false; inspectingConversation = null; resetChatSearch()"
    >
      <div class="chat-viewer-modal">
        <div v-if="isLoadingChatDetail" class="chat-viewer-loading">
          <Loader2 :size="28" class="animate-spin" />
          <span>در حال بارگذاری پیام‌های گفتگو...</span>
        </div>

        <div v-else-if="inspectingConversation" class="chat-viewer-body">
          <div class="chat-viewer-meta flex items-center justify-between">
            <div class="meta-item">
              <span>کاربر:</span>
              <strong>{{ inspectingConversation.user?.displayName || inspectingConversation.user?.email || 'ناشناس' }}</strong>
            </div>
            <div class="meta-item">
              <span>تعداد کل پیام‌ها:</span>
              <strong>{{ inspectingConversation.messages?.length || 0 }}</strong>
            </div>
          </div>

          <!-- نوار جستجو درون پیام‌های این گفتگو با قابلیت اسکرول خودکار (مورد ۱) -->
          <div class="chat-search-bar flex items-center gap-2 p-2 bg-secondary/70 border border-border rounded-lg mt-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              v-model="chatSearchQuery"
              type="text"
              class="chat-search-input flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground"
              placeholder="جستجو در متن پیام‌های این گفتگو..."
              @keydown.enter="nextChatMatch"
            />
            <div v-if="chatSearchQuery.trim()" class="search-match-nav flex items-center gap-2 text-xs">
              <span class="match-count text-muted-foreground mono font-medium">
                {{ matchingChatMessages.length > 0 ? `${(activeChatMatchIndex + 1).toLocaleString('fa-IR')} از ${matchingChatMessages.length.toLocaleString('fa-IR')}` : 'یافت نشد' }}
              </span>
              <button
                type="button"
                :disabled="!matchingChatMessages.length"
                class="search-nav-btn px-2 py-0.5 rounded border border-border bg-card hover:bg-secondary disabled:opacity-40"
                title="پیام قبلی"
                @click="prevChatMatch"
              >
                ▲
              </button>
              <button
                type="button"
                :disabled="!matchingChatMessages.length"
                class="search-nav-btn px-2 py-0.5 rounded border border-border bg-card hover:bg-secondary disabled:opacity-40"
                title="پیام بعدی"
                @click="nextChatMatch"
              >
                ▼
              </button>
              <button
                type="button"
                class="clear-search-btn text-muted-foreground hover:text-foreground font-bold px-1"
                title="پاک کردن جستجو"
                @click="resetChatSearch"
              >
                ×
              </button>
            </div>
          </div>

          <div class="chat-messages-container mt-3">
            <div
              v-for="msg in inspectingConversation.messages"
              :id="`admin-chat-msg-${msg.id}`"
              :key="msg.id"
              class="chat-bubble-row transition-all duration-300"
              :class="[
                msg.role === 'user' ? 'role-user' : 'role-assistant',
                chatSearchQuery && msg.content?.toLowerCase().includes(chatSearchQuery.toLowerCase()) ? 'search-match-bubble' : '',
                matchingChatMessages[activeChatMatchIndex]?.id === msg.id ? 'active-search-match-bubble' : ''
              ]"
            >
              <div class="chat-bubble-avatar">
                {{ msg.role === 'user' ? 'کاربر' : 'پروا' }}
              </div>
              <div class="chat-bubble-content">
                <div class="chat-bubble-header">
                  <span class="bubble-sender">{{ msg.role === 'user' ? 'کاربر' : 'دستیار هوش مصنوعی' }}</span>
                  <!-- زمان پیام بر مبنای ساعت رسمی ایران (مورد ۸) -->
                  <span class="bubble-time mono">
                    {{ formatIranTime(msg.createdAt) }}
                  </span>
                </div>
                <!-- Attached files for message in admin chat inspector -->
                <div v-if="msg.attachments && msg.attachments.length > 0" class="admin-msg-attachments flex flex-wrap gap-2 mb-2">
                  <div
                    v-for="att in msg.attachments"
                    :key="att.id"
                    class="admin-att-card flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background/80 border border-border text-xs"
                  >
                    <span :class="['att-badge px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', getAttBadgeClass(att.fileType)]">
                      {{ att.fileType }}
                    </span>
                    <span class="att-name max-w-[140px] truncate font-medium" :title="att.originalName">{{ att.originalName }}</span>
                    <span class="att-size text-muted-foreground text-[10px]">({{ formatFileSize(att.fileSize) }})</span>
                    <span :class="['att-status text-[10px] px-1.5 py-0.5 rounded', getStatusClass(att.status)]">
                      {{ getStatusLabel(att.status) }}
                    </span>
                    <a
                      v-if="att.id"
                      :href="getFileDownloadUrl(att.id)"
                      target="_blank"
                      class="text-primary hover:underline flex items-center gap-0.5 text-[10px] mr-1"
                      title="دانلود یا مشاهده محتوای فایل"
                    >
                      <Eye :size="12" />
                    </a>
                  </div>
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

    <!-- MODAL 6: File Details & Diagnostics Modal -->
    <AdminModal
      v-if="isFileDetailModalOpen && inspectingFile"
      eyebrow="مدیریت فایل‌ها"
      title="جزئیات فایل و بررسی لاگ پردازش"
      @close="isFileDetailModalOpen = false"
    >
      <div class="file-detail-dialog space-y-4">
        <!-- File Header Card -->
        <div class="file-detail-head p-3 rounded-xl bg-card border border-border flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span :class="['att-badge px-2.5 py-1 rounded text-xs font-bold uppercase', getAttBadgeClass(inspectingFile.fileType)]">
              {{ inspectingFile.fileType }}
            </span>
            <div>
              <strong class="block text-sm font-semibold">{{ inspectingFile.originalName }}</strong>
              <span class="text-xs text-muted-foreground mono">{{ formatFileSize(inspectingFile.fileSize) }} | {{ inspectingFile.mimeType }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span :class="['status-badge-pill px-2.5 py-1 rounded-full text-xs font-medium', getStatusClass(inspectingFile.status)]">
              {{ getStatusLabel(inspectingFile.status) }}
            </span>
            <a
              :href="getFileDownloadUrl(inspectingFile.id)"
              target="_blank"
              class="download-btn flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground"
              title="دانلود فایل اصلی"
            >
              <Eye :size="13" />
              <span>مشاهده / دانلود</span>
            </a>
          </div>
        </div>

        <!-- Meta Grid -->
        <div class="file-meta-grid grid grid-cols-2 gap-3 text-xs">
          <div class="meta-item p-2.5 rounded-lg bg-card/60 border border-border">
            <span class="text-muted-foreground block mb-1">کاربر ارسال‌کننده:</span>
            <strong>{{ inspectingFile.user?.displayName || inspectingFile.user?.email || 'نامشخص' }}</strong>
            <span v-if="inspectingFile.user?.displayName" class="block text-muted-foreground text-[11px]">{{ inspectingFile.user.email }}</span>
          </div>
          <div class="meta-item p-2.5 rounded-lg bg-card/60 border border-border">
            <span class="text-muted-foreground block mb-1">زمان پردازش / تاریخ:</span>
            <strong v-if="inspectingFile.metadata?.processingDurationMs">{{ inspectingFile.metadata.processingDurationMs }} میلی‌ثانیه</strong>
            <strong v-else>—</strong>
            <span class="block text-muted-foreground text-[11px]">{{ formatIranDateTime(inspectingFile.createdAt) }}</span>
          </div>
        </div>

        <!-- Error Alert if status is error -->
        <div v-if="inspectingFile.status === 'error'" class="error-detail-box p-3 rounded-xl bg-destructive/10 border border-destructive/30 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-destructive flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              پیام و علت خطای پردازش:
            </span>
            <BaseButton
              variant="secondary"
              size="sm"
              :loading="isRetryingFile === inspectingFile.id"
              @click="handleRetryFile(inspectingFile)"
            >
              تلاش مجدد پردازش
            </BaseButton>
          </div>
          <p class="text-xs text-destructive/90 font-medium">{{ inspectingFile.errorMessage || 'خطای نامشخص در حین استخراج فایل' }}</p>
          <pre v-if="inspectingFile.metadata?.errorDetails" class="text-[11px] p-2 rounded bg-black/20 overflow-x-auto text-destructive-foreground/80 mono">{{ inspectingFile.metadata.errorDetails }}</pre>
        </div>

        <!-- Extracted Text Area -->
        <div class="extracted-text-section space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-foreground">محتوای استخراج‌شده از فایل (جهت ارسال به هوش مصنوعی):</span>
            <span v-if="inspectingFile.extractedText" class="text-[11px] text-muted-foreground">
              {{ inspectingFile.extractedText.length.toLocaleString('fa-IR') }} کاراکتر
            </span>
          </div>
          <div v-if="inspectingFile.extractedText" class="extracted-content-box p-3 rounded-xl bg-card border border-border text-xs max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {{ inspectingFile.extractedText }}
          </div>
          <div v-else class="empty-extracted p-4 rounded-xl bg-card/40 border border-dashed border-border text-center text-xs text-muted-foreground">
            {{ inspectingFile.status === 'processing' ? 'فایل در حال پردازش در صف پس‌زمینه است...' : 'هیچ متنی از این فایل استخراج نشده است.' }}
          </div>
        </div>

        <!-- Technical Metadata -->
        <div v-if="inspectingFile.metadata" class="metadata-section space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">متادیتای فنی و تله‌متری (Trace):</span>
          <pre class="text-[11px] p-2.5 rounded-xl bg-card border border-border overflow-x-auto mono text-muted-foreground max-h-32">{{ JSON.stringify(inspectingFile.metadata, null, 2) }}</pre>
        </div>

        <div class="modal-actions mt-4 flex justify-end">
          <BaseButton variant="ghost" size="md" @click="isFileDetailModalOpen = false">
            بستن
          </BaseButton>
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

.admin-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 700;
  font-size: 18px;
  overflow: hidden;
}

.admin-avatar-image {
  object-fit: cover;
}

.admin-brand-text strong {
  display: block;
  font-size: 17px;
  font-weight: 700;
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

/* Align the "view all" ghost button flush with the panel edge so it lines up
   with the values column underneath (token counts, model counts). */
.panel-heading > :last-child {
  margin-inline-start: auto;
}

.panel-heading > :last-child:is(button),
.panel-heading > :last-child > button {
  margin-inline-end: -10px;
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

/* Providers status rows: fixed columns so the middle (model count) column
   lines up vertically across all rows. */
.status-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 88px 64px;
}

.status-row > span:nth-child(3),
.status-row em {
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-style: normal;
}

.status-row > span:nth-child(3) {
  text-align: center;
}

.status-row em {
  text-align: center;
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
  min-width: 104px;
  text-align: start;
  font-size: 12px;
  font-family: var(--font-mono);
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

/* =======================================================
   FILES MANAGEMENT PANEL STYLES
   ======================================================= */
.files-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.files-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.files-kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.file-kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 18px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: border-color 0.15s ease;
}

.file-kpi-card:hover {
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
}

.file-kpi-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  font-family: var(--font-mono);
}

.file-kpi-card.kpi-processing .file-kpi-num {
  color: #f59e0b;
}

.file-kpi-card.kpi-ready .file-kpi-num {
  color: #10b981;
}

.file-kpi-card.kpi-error .file-kpi-num {
  color: #ef4444;
}

.file-kpi-lbl {
  font-size: 12px;
  color: var(--muted-foreground);
  font-weight: 500;
}

.files-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.files-search-wrap {
  position: relative;
  flex: 1 1 260px;
  max-width: 360px;
  display: flex;
  align-items: center;
}

.files-search-wrap .search-icon {
  position: absolute;
  inset-inline-start: 12px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.files-search-wrap input {
  width: 100%;
  height: 38px;
  padding: 0 14px;
  padding-inline-start: 36px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.files-search-wrap input:focus {
  border-color: var(--primary);
}

.files-status-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-chip:hover {
  background: var(--secondary);
  color: var(--foreground);
}

.filter-chip.is-active {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 600;
}

.status-count {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--border) 60%, transparent);
  font-size: 10.5px;
  font-family: var(--font-mono);
}

.filter-chip.is-active .status-count {
  background: color-mix(in srgb, var(--primary) 25%, transparent);
  color: var(--primary);
}

.signoz-shortcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted-foreground);
  border: 1px solid var(--border);
  background: var(--background);
  cursor: pointer;
  transition: all 0.15s ease;
}

.signoz-shortcut-btn:hover {
  border-color: #8b5cf6;
  color: #8b5cf6;
  background: color-mix(in srgb, #8b5cf6 8%, transparent);
}

.files-table-container {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  overflow: hidden;
}

.files-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: start;
}

.files-table th {
  padding: 12px 14px;
  background: var(--secondary);
  color: var(--muted-foreground);
  font-weight: 600;
  font-size: 11.5px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.files-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.file-row:last-child td {
  border-bottom: none;
}

.file-row:hover td {
  background: color-mix(in srgb, var(--secondary) 40%, transparent);
}

.file-user-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-user-cell strong {
  font-size: 12.5px;
  color: var(--foreground);
}

.file-user-cell .user-email {
  font-size: 11px;
  color: var(--muted-foreground);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.icon-action-btn {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-action-btn:hover {
  background: var(--secondary);
  color: var(--foreground);
  border-color: var(--border);
}

.icon-action-btn.delete:hover {
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  color: var(--destructive);
  border-color: color-mix(in srgb, var(--destructive) 30%, transparent);
}

.empty-files-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.files-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--card);
}

/* File Badges & Status Pills */
.att-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-pdf {
  background: rgba(239, 68, 68, 0.14);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.badge-excel {
  background: rgba(16, 185, 129, 0.14);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.badge-image {
  background: rgba(59, 130, 246, 0.14);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.badge-text {
  background: rgba(139, 92, 246, 0.14);
  color: #8b5cf6;
  border: 1px solid rgba(139, 92, 246, 0.25);
}

.badge-default {
  background: var(--secondary);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}

.status-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 9999px;
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
}

.badge-ready {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.badge-processing {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.badge-error {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.badge-pending {
  background: var(--secondary);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}

/* Chat modal file attachments in admin conversation inspection */
.admin-msg-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.admin-att-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--card) 85%, var(--background));
  border: 1px solid var(--border);
  font-size: 12px;
}

.admin-att-card .att-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.admin-att-card .att-size {
  color: var(--muted-foreground);
  font-size: 10px;
}

/* File Diagnostics & Details Modal */
.file-detail-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--border);
}

.file-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.meta-item {
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--card);
  border: 1px solid var(--border);
  font-size: 12px;
}

.meta-item strong {
  display: block;
  font-size: 13px;
  margin-bottom: 2px;
}

.error-detail-box {
  padding: 12px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--destructive) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--destructive) 25%, transparent);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extracted-content-box {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 220px;
  overflow-y: auto;
}

.empty-extracted {
  padding: 24px 16px;
  border-radius: 12px;
  background: var(--card);
  border: 1px dashed var(--border);
  text-align: center;
  color: var(--muted-foreground);
  font-size: 12.5px;
}

@media (max-width: 1080px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .admin-menu-button {
    display: block;
  }

  /* Sidebar is off-canvas below 768px, so the content offset must go. */
  .admin-main {
    margin-inline-start: 0;
  }

  .admin-topbar {
    min-height: 64px;
    padding: 14px 12px;
  }

  .admin-content {
    padding: 12px 0 20px;
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

/* ────────────── Chats Table Pagination ────────────── */
.table-pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 12px 18px;
  background: color-mix(in srgb, var(--card) 95%, transparent);
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--foreground);
  font-weight: 500;
}

.pagination-subtext {
  font-size: 11.5px;
  color: var(--muted-foreground);
  font-weight: normal;
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-page-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

/* ────────────── In-Chat Search Highlight (مورد ۱) ────────────── */
.search-match-bubble {
  border-right: 3px solid var(--primary) !important;
  background-color: color-mix(in srgb, var(--primary) 8%, var(--card)) !important;
}

.active-search-match-bubble {
  border-right: 4px solid var(--primary) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent) !important;
  background-color: color-mix(in srgb, var(--primary) 15%, var(--card)) !important;
}

/* ────────────── Circular Credit Gauge (مورد ۱۶) ────────────── */
.credit-ring-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.credit-ring-box svg {
}

/* ────────────── File Lifecycle Guide & Banner (موارد ۵، ۱۱، ۱۴) ────────────── */
.file-lifecycle-guide {
  line-height: 1.6;
}

.user-filter-banner {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
</style>
