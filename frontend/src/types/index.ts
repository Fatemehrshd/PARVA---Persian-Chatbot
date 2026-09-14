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

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface SendMessageRequest {
  content: string
}

// ========================
// Model Schemas (Admin)
// ========================

export interface Model {
  id: string
  name: string
  provider: string
  apiIdentifier: string
  isActive: boolean
  isDefault: boolean
  createdAt?: string
}

export interface CreateModelRequest {
  name: string
  provider: string
  apiIdentifier: string
  isActive?: boolean
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
