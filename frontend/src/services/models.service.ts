import { request } from './api'
import type { Model, CreateModelRequest } from '../types'

export const modelsService = {
  async listModels(): Promise<Model[]> {
    return request<Model[]>('/admin/models')
  },

  async createModel(data: CreateModelRequest): Promise<Model> {
    return request<Model>('/admin/models', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async deleteModel(modelId: string): Promise<void> {
    return request<void>(`/admin/models/${modelId}`, {
      method: 'DELETE'
    })
  },

  async setDefaultModel(modelId: string): Promise<Model> {
    return request<Model>(`/admin/models/${modelId}/default`, {
      method: 'PATCH'
    })
  }
}
