export interface User {
  id: string
  email: string
  displayName?: string
  role: 'user' | 'admin'
  createdAt?: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface Conversation {
  id: string
  title: string
  modelId?: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

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
