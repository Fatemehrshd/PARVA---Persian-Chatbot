/**
 * Domain Models & Request/Response DTOs matching api-contract.yaml
 */

// ========================
// User & Auth Schemas
// ========================

export interface User {
  id: string
  email: string
  displayName?: string | null
  username?: string | null
  avatarUrl?: string | null
  role: 'user' | 'admin'
  isActive?: boolean
  createdAt?: string
}

export interface UserProfile extends User {
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  themePreference?: 'dark' | 'light' | null
}

export interface UpdateProfileRequest {
  displayName?: string
  username?: string
}

export interface ChangeEmailRequest {
  email: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface SignupRequest {
  email: string
  password: string
  displayName?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LogoutRequest {
  refreshToken?: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

// ========================
// Chat Schemas
// ========================

export interface Conversation {
  id: string
  title: string
  modelId?: string
  isPinned?: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateConversationRequest {
  modelId?: string
  title?: string
}

export interface UpdateConversationRequest {
  title?: string
  modelId?: string
  isPinned?: boolean
}

export interface FileAttachmentItem {
  id: string
  tempId?: string
  originalName: string
  mimeType: string
  fileType: 'image' | 'pdf' | 'excel' | 'text'
  fileSize: number
  status: 'uploading' | 'processing' | 'ready' | 'error'
  errorMessage?: string
  previewUrl?: string
  progress?: number
  abortController?: AbortController
  rawFile?: File
  metadata?: Record<string, any>
  extractedText?: string
}

export interface WebSource {
  title: string
  url: string
  snippet?: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  isInterrupted?: boolean
  stoppedByUser?: boolean
  status?: 'sending' | 'sent' | 'error' | 'queued' | 'processing_files'
  errorText?: string
  attachments?: FileAttachmentItem[]
  fileIds?: string[]
  sources?: WebSource[] | null
  searchFailed?: boolean
  feedback?: 'like' | 'dislike' | null
  reasoning_content?: string | null
  thinkingDurationMs?: number | null
}

export interface ActiveStreamStatus {
  active: boolean
  status: 'thinking' | 'streaming' | 'completed' | 'error'
  accumulatedText: string
  title?: string
  messageId?: string
  sources?: WebSource[]
  reasoningText?: string
  accumulatedReasoning?: string
  thinkingDurationMs?: number
  isThinkingComplete?: boolean
}

export interface SendMessageRequest {
  content: string
  fileIds?: string[]
  useWebSearch?: boolean
  useThinking?: boolean
}

export interface QueuedMessage {
  id: string
  conversationId: string
  content: string
  fileIds?: string[]
  files?: FileAttachmentItem[]
  options?: {
    useWebSearch?: boolean
    useThinking?: boolean
  }
  createdAt: string
}

export interface SearchResult {
  id: string
  title: string
  updatedAt: string
  matchedIn: 'title' | 'message'
  snippet: string
}

// ========================
// Provider Schemas (Admin)
// ========================

export interface Provider {
  id: string
  name: string
  baseUrl?: string | null
  apiKey?: string | null
  defaultModelId?: string | null
  createdAt?: string
}

export interface CreateProviderRequest {
  name: string
  baseUrl?: string
  apiKey?: string
}

export interface UpdateProviderRequest {
  name?: string
  baseUrl?: string
  apiKey?: string
}

export interface WebSearchUsage {
  used: number
  total: number
  remaining: number
}

export interface AdminDashboardStats {
  totalUsers: number
  totalModels: number
  activeModels: number
  totalProviders: number
  activeProviders: number
  totalConversations: number
  totalMessages: number
  totalTokensUsed: number
  totalLikes?: number
  totalDislikes?: number
  satisfactionRate?: number
  globalTokenLimit: number
  tokenRatePer1000?: number
  systemPrompt: string
  webSearchUsage?: WebSearchUsage | null
}

export interface FeedbackItem {
  id: string
  conversationId: string
  conversationTitle: string
  contentSnippet: string
  feedback: 'like' | 'dislike'
  createdAt: string
}

export interface AdminUser extends User {
  usedTokens: number
  tokenLimit?: number | null
  /** سقف مؤثر resolve شده در بک‌اند: اختصاصی ← طرح اشتراک ← نقش ← سراسری ← مدیر (null = نامحدود) */
  effectiveTokenLimit?: number | null
  effectiveMessageLimit?: number | null
  tokenLimitSource?: 'personal' | 'plan' | 'role' | 'global' | 'admin'
  planName?: string | null
  planId?: string | null
  conversationsCount: number
  filesCount?: number
  messageLimit?: number | null
  periodStart?: string | null
  periodUsedTokens?: number
  periodUsedMessages?: number
  usageByType?: Record<string, number>
  usedCostUsd?: number
  /** درصد باقی‌مانده مؤثر (min توکن و پیام) که بک‌اند محاسبه می‌کند؛ null = نامحدود */
  remainingPercent?: number | null
}

export interface UpdateAdminUserRequest {
  role?: 'user' | 'admin'
  displayName?: string
  email?: string
  usedTokens?: number
  tokenLimit?: number | null
  messageLimit?: number | null
}

export interface QuotaState {
  blocked: boolean
  reason: 'tokens' | 'messages' | null
  remainingTokens: number | null
  remainingMessages: number | null
  remainingPercent: number | null
  resetAt: string | null
  tokenLimit?: number | null
  usedTokens?: number
  periodUsedTokens?: number
  messageLimit?: number | null
  usedMessages?: number
  planName?: string | null
  limitSource?: 'personal' | 'plan' | 'role' | 'global' | 'admin' | null
  isAdmin?: boolean
}

export interface AdminConversationSummary {
  id: string
  title: string
  userId: string
  user: { id: string; email: string; displayName?: string } | null
  messageCount: number
  createdAt: string
  updatedAt: string
  modelId?: string | null
}

export interface AdminConversationDetail extends AdminConversationSummary {
  messages: Message[]
}


// ========================
// Model Schemas (Admin & Chat)
// ========================

export type ModelAccessLevel = 'public' | 'commercial' | 'private'

export interface Model {
  id: string
  name: string
  provider: string
  providerId?: string | null
  apiIdentifier: string
  apiKey?: string | null
  baseUrl?: string | null
  isActive: boolean
  isDefault: boolean
  /** سطح دسترسی: عمومی برای همه، تجاری برای نقش‌های مجاز، اختصاصی برای کاربران وایت‌لیست. */
  accessLevel?: ModelAccessLevel
  /** کاربران مجاز مدل اختصاصی. */
  allowedUserIds?: string[]
  createdAt?: string
  supportsThinking?: boolean
  supportsVision?: boolean
  supportsDocument?: boolean
  supportsWebSearch?: boolean
  thinkingBudgetTokens?: number | null
}

export interface CreateModelRequest {
  name: string
  provider: string
  providerId?: string
  apiIdentifier: string
  apiKey?: string
  baseUrl?: string
  isActive?: boolean
  accessLevel?: ModelAccessLevel
  allowedUserIds?: string[]
  supportsThinking?: boolean
  supportsVision?: boolean
  supportsDocument?: boolean
  supportsWebSearch?: boolean
  thinkingBudgetTokens?: number | null
}

export interface UpdateModelStatusRequest {
  isActive: boolean
}

/** نقش → سطوح دسترسی مدل مجاز (پنل ادمین). */
export type ModelAccessMap = Record<string, ModelAccessLevel[]>

// ========================
// API Envelope & Error Schemas
// ========================

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data: T
}

export interface ApiErrorResponse {
  success?: boolean
  message: string
  data?: any
  statusCode?: number
  error?: string
}

// ========================
// Admin Files Schemas
// ========================

export interface AdminFileItem {
  id: string
  originalName: string
  mimeType: string
  fileType: 'image' | 'pdf' | 'excel' | 'text'
  fileSize: number
  status: 'uploading' | 'processing' | 'ready' | 'error'
  errorMessage?: string
  createdAt: string
  updatedAt: string
  conversationId?: string
  messageId?: string
  hasExtractedText: boolean
  metadata?: Record<string, any>
  user?: { id: string; email: string; displayName?: string } | null
}

export interface AdminFileListResponse {
  items: AdminFileItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminFileStats {
  totalFiles: number
  processingFiles: number
  readyFiles: number
  errorFiles: number
  totalSizeBytes: number
  totalSizeMb: number
}

export interface AdminFileDetail extends AdminFileItem {
  extractedText?: string
  minioKey?: string
  conversationTitle?: string
}

// ========================
// Subscriptions & Plans
// ========================

export interface PlanFeatureSet {
  webSearch?: boolean
  thinking?: boolean
  document?: boolean
  maxFileSizeMb?: number
  [key: string]: any
}

export interface SubscriptionPlan {
  id: string
  slug: string
  name: string
  description?: string | null
  price: string | number
  currency: string
  durationDays: number
  tokenQuota: number
  messageQuota?: number | null
  resetHours: number
  features: PlanFeatureSet
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  planModels?: Array<{ id: string; modelId: string; model?: { id: string; name: string } }>
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING'
  startDate: string
  endDate?: string | null
  paymentId?: string | null
  source: string
  cancelledAt?: string | null
  cancellationReason?: string | null
  plan?: SubscriptionPlan
  user?: { id: string; email: string; displayName?: string }
  createdAt: string
  updatedAt: string
}

export interface UserEntitlements {
  userId: string
  role: string
  isAdmin: boolean
  plan: SubscriptionPlan | null
  hasActiveSubscription: boolean
  effectiveTokenLimit: number | null
  effectiveMessageLimit: number | null
  limitSource: 'personal' | 'plan' | 'role' | 'global' | 'admin'
  subscriptionExpired?: boolean
  expiredPlanName?: string | null
  features: {
    webSearch: boolean
    thinking: boolean
    document: boolean
    maxFileSizeMb: number
  }
  allowedModelIds: string[] | null
}

export interface CurrentSubscriptionResponse {
  activeSubscription: Subscription | null
  entitlements: UserEntitlements
  history: Subscription[]
}

// ========================
// Payments & Gateways
// ========================

export interface Payment {
  id: string
  userId: string
  planId: string
  amount: string | number
  currency: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
  gateway: string
  authority?: string | null
  refId?: string | null
  idempotencyKey?: string | null
  verifiedAt?: string | null
  createdAt: string
  updatedAt: string
  plan?: SubscriptionPlan
  user?: { id: string; email: string; displayName?: string }
}

export interface CheckoutResponse {
  paymentId: string
  authority?: string
  paymentUrl?: string
  status?: string
  message?: string
}

export interface VerifyPaymentResponse {
  success: boolean
  refId?: string | null
  message?: string
  alreadyVerified?: boolean
  payment?: Payment
}

// ========================
// Audit Logs
// ========================

export interface AuditLogItem {
  id: string
  traceId?: string | null
  spanId?: string | null
  actorId?: string | null
  actorEmail?: string | null
  actorName?: string | null
  actorType: 'admin' | 'user' | 'system'
  action: string
  entityType: string
  entityId?: string | null
  method?: string | null
  path?: string | null
  statusCode?: number | null
  durationMs?: number | null
  errorMessage?: string | null
  changes?: { before?: any; after?: any } | null
  metadata?: Record<string, any>
  ip?: string | null
  userAgent?: string | null
  createdAt: string
}

// ========================
// Chat Share (Frozen Snapshot)
// ========================

export interface ShareSnapshotMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  sources?: { title: string; url: string; snippet?: string }[] | null
  reasoning_content?: string | null
  thinkingDurationMs?: number | null
  attachments?: {
    id: string
    originalName: string
    mimeType: string
    fileType: string
    fileSize: number
  }[]
}

export interface ChatShareSummary {
  id: string
  shareCode: string
  title: string
  modelId?: string | null
  modelName?: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
  isActive: boolean
  viewCount?: number
}

export interface PublicShareResponse {
  shareCode: string
  title: string
  modelId?: string | null
  modelName?: string | null
  messages: ShareSnapshotMessage[]
  createdAt: string
  updatedAt: string
}

// ========================
// Coupons & Discounts
// ========================

export type DiscountType = 'PERCENTAGE' | 'FIXED'

export interface Coupon {
  id: string
  code: string
  description?: string | null
  discountType: DiscountType
  discountValue: number
  maxDiscountAmount?: number | null
  minOrderAmount?: number | null
  usageLimit?: number | null
  usedCount: number
  perUserLimit: number
  expiresAt?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCouponRequest {
  code: string
  description?: string
  discountType: DiscountType
  discountValue: number
  maxDiscountAmount?: number | null
  minOrderAmount?: number | null
  usageLimit?: number | null
  perUserLimit?: number
  expiresAt?: string | null
  isActive?: boolean
}

export interface UpdateCouponRequest {
  description?: string
  discountType?: DiscountType
  discountValue?: number
  maxDiscountAmount?: number | null
  minOrderAmount?: number | null
  usageLimit?: number | null
  perUserLimit?: number
  expiresAt?: string | null
  isActive?: boolean
}

export interface ValidateCouponResponse {
  valid: boolean
  couponId: string
  code: string
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  originalAmount: number
  finalAmount: number
  message: string
}



