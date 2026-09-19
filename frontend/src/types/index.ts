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
  isActive: boolean
  defaultModelId?: string | null
  createdAt?: string
}

export interface CreateProviderRequest {
  name: string
  baseUrl?: string
  apiKey?: string
  isActive?: boolean
}

export interface UpdateProviderRequest {
  name?: string
  baseUrl?: string
  apiKey?: string
  isActive?: boolean
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
  conversationsCount: number
  filesCount?: number
}

export interface UpdateAdminUserRequest {
  role?: 'user' | 'admin'
  displayName?: string
  email?: string
  usedTokens?: number
  tokenLimit?: number | null
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
  createdAt?: string
  supportsThinking?: boolean
  supportsVision?: boolean
  supportsDocument?: boolean
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
  supportsThinking?: boolean
  supportsVision?: boolean
  supportsDocument?: boolean
  thinkingBudgetTokens?: number | null
}

export interface UpdateModelStatusRequest {
  isActive: boolean
}

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

