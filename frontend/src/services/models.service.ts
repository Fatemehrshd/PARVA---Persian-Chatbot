import { request } from './api'
import type { Model, CreateModelRequest, Provider, CreateProviderRequest, UpdateProviderRequest } from '../types'

/**
 * Models & Providers Service (Maps 1:1 with OpenAPI tags: Chat and Admin - Models)
 * Provides user-facing active model listing for chat, plus admin CRUD operations for models & providers.
 */
export const modelsService = {
  /**
   * List active AI models available for chatting.
   * Accessible to all authenticated users (used by chat composer).
   * GET /models
   */
  async listActiveModels(): Promise<Model[]> {
    return request<Model[]>('/models')
  },

  /**
   * List all configured AI models (admin only).
   * GET /admin/models
   */
  async listModels(): Promise<Model[]> {
    return request<Model[]>('/admin/models')
  },

  /**
   * Add a new AI model to the platform (admin only).
   * POST /admin/models
   */
  async createModel(data: CreateModelRequest): Promise<Model> {
    return request<Model>('/admin/models', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async updateModel(modelId: string, data: Partial<CreateModelRequest>): Promise<Model> {
    return request<Model>(`/admin/models/${modelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  /**
   * Remove an existing AI model from the platform (admin only).
   * DELETE /admin/models/{modelId}
   */
  async deleteModel(modelId: string): Promise<void> {
    return request<void>(`/admin/models/${modelId}`, {
      method: 'DELETE'
    })
  },

  /**
   * Set an AI model as the platform-wide default engine (admin only).
   * PATCH /admin/models/{modelId}/default
   */
  async setDefaultModel(modelId: string): Promise<Model> {
    return request<Model>(`/admin/models/${modelId}/default`, {
      method: 'PATCH'
    })
  },

  /**
   * Toggle active/inactive status of an AI model (admin only).
   * PATCH /admin/models/{modelId}/status
   */
  async updateModelStatus(modelId: string, isActive: boolean): Promise<Model> {
    return request<Model>(`/admin/models/${modelId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    })
  },

  // ========================
  // Provider Admin Endpoints
  // ========================

  /**
   * List configured AI providers (admin only).
   * GET /admin/providers
   */
  async listProviders(): Promise<Provider[]> {
    return request<Provider[]>('/admin/providers')
  },

  /**
   * Register a new AI provider (admin only).
   * POST /admin/providers
   */
  async createProvider(data: CreateProviderRequest): Promise<Provider> {
    return request<Provider>('/admin/providers', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /**
   * Update provider metadata (admin only).
   * PATCH /admin/providers/{providerId}
   */
  async updateProvider(providerId: string, data: UpdateProviderRequest): Promise<Provider> {
    return request<Provider>(`/admin/providers/${providerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  /**
   * Toggle provider active/inactive status (admin only).
   * PATCH /admin/providers/{providerId}/status
   */
  async updateProviderStatus(providerId: string, isActive: boolean): Promise<Provider> {
    return request<Provider>(`/admin/providers/${providerId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    })
  },

  /**
   * Set provider's default model (admin only).
   * PATCH /admin/providers/{providerId}/default
   */
  async setProviderDefault(providerId: string, modelId: string): Promise<Provider> {
    return request<Provider>(`/admin/providers/${providerId}/default`, {
      method: 'PATCH',
      body: JSON.stringify({ modelId })
    })
  },

  /**
   * Delete a provider and cascade-delete all its models (admin only).
   * DELETE /admin/providers/{providerId}
   */
  async deleteProvider(providerId: string): Promise<void> {
    return request<void>(`/admin/providers/${providerId}`, {
      method: 'DELETE'
    })
  }
}
