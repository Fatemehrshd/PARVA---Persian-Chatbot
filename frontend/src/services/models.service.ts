import { request } from './api'
import type { Model, CreateModelRequest } from '../types'

/**
 * Admin Models Service (Maps 1:1 with OpenAPI tag: Admin - Models)
 * Provides CRUD operations and default model assignment for AI models.
 */
export const modelsService = {
  /**
   * List all configured AI models.
   * GET /admin/models
   */
  async listModels(): Promise<Model[]> {
    return request<Model[]>('/admin/models')
  },

  /**
   * Add a new AI model to the platform.
   * POST /admin/models
   */
  async createModel(data: CreateModelRequest): Promise<Model> {
    return request<Model>('/admin/models', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /**
   * Remove an existing AI model from the platform.
   * DELETE /admin/models/{modelId}
   */
  async deleteModel(modelId: string): Promise<void> {
    return request<void>(`/admin/models/${modelId}`, {
      method: 'DELETE'
    })
  },

  /**
   * Set an AI model as the platform-wide default engine.
   * PATCH /admin/models/{modelId}/default
   */
  async setDefaultModel(modelId: string): Promise<Model> {
    return request<Model>(`/admin/models/${modelId}/default`, {
      method: 'PATCH'
    })
  },

  /**
   * Toggle active/inactive status of an AI model.
   * PATCH /admin/models/{modelId}/status
   */
  async updateModelStatus(modelId: string, isActive: boolean): Promise<Model> {
    return request<Model>(`/admin/models/${modelId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    })
  }
}
