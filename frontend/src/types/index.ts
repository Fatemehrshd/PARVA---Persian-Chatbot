/**
 * Domain Models & Request/Response DTOs matching api-contract.yaml
 */

// ========================
// User & Auth Schemas
// ========================

export interface User {
  id: string
  email: string
  displayName?: string
  role: 'user' | 'admin'
  createdAt?: string
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
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  isInterrupted?: boolean
}

export interface SendMessageRequest {
  content: string
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
}

export interface CreateModelRequest {
  name: string
  provider: string
  providerId?: string
  apiIdentifier: string
  apiKey?: string
  baseUrl?: string
  isActive?: boolean
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
