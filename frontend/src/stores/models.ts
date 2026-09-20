import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Model, CreateModelRequest } from '../types'
import { modelsService } from '../services/models.service'
import { useAuthStore } from './auth'

export const useModelsStore = defineStore('models', () => {
  const authStore = useAuthStore()

  const initialModels: Model[] = [
    {
      id: 'm-1',
      name: 'Neural-1 Flash',
      provider: 'anthropic',
      apiIdentifier: 'claude-3-5-sonnet',
      isActive: true,
      isDefault: true,
      supportsThinking: false,
      supportsVision: true,
      supportsDocument: true,
      thinkingBudgetTokens: 4096,
      createdAt: new Date().toISOString()
    },
    {
      id: 'm-2',
      name: 'GPT-4o Omni',
      provider: 'openai',
      apiIdentifier: 'gpt-4o',
      isActive: true,
      isDefault: false,
      supportsThinking: false,
      supportsVision: true,
      supportsDocument: true,
      thinkingBudgetTokens: 4096,
      createdAt: new Date().toISOString()
    },
    {
      id: 'm-3',
      name: 'Llama 3.3 70B',
      provider: 'local',
      apiIdentifier: 'llama-3.3-70b-instruct',
      isActive: true,
      isDefault: false,
      supportsThinking: false,
      supportsVision: false,
      supportsDocument: true,
      thinkingBudgetTokens: 2048,
      createdAt: new Date().toISOString()
    }
  ]

  const models = ref<Model[]>(initialModels)
  const selectedModelId = ref<string>('m-1')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeModels = computed(() => models.value.filter((m) => m.isActive))
  const defaultModel = computed(() => models.value.find((m) => m.isDefault) || models.value[0])
  const selectedModel = computed(() => models.value.find((m) => m.id === selectedModelId.value) || defaultModel.value)

  async function fetchModels(forAdmin = false) {
    loading.value = true
    error.value = null
    try {
      let data: Model[]
      if (forAdmin || authStore.isAdmin) {
        try {
          const res = await modelsService.listModels()
          data = Array.isArray(res) ? res : (res?.items || [])
        } catch (err: any) {
          if (err?.statusCode === 403) {
            data = await modelsService.listActiveModels()
          } else {
            throw err
          }
        }
      } else {
        data = await modelsService.listActiveModels()
      }

      if (Array.isArray(data) && data.length > 0) {
        models.value = data
        const currentValid = data.some((m) => m.id === selectedModelId.value)
        if (!currentValid || selectedModelId.value.startsWith('m-')) {
          const def = data.find((m) => m.isDefault) || data[0]
          if (def) {
            selectedModelId.value = def.id
          }
        }
      }
    } catch (err: any) {
      error.value = err?.message || 'خطا در دریافت فهرست مدل‌ها'
      // Keep initial fallback models for offline/unauthenticated views
    } finally {
      loading.value = false
    }
  }

  async function addModel(data: CreateModelRequest): Promise<Model> {
    const newModel = await modelsService.createModel(data)
    models.value.push(newModel)
    return newModel
  }

  async function removeModel(id: string) {
    try {
      await modelsService.deleteModel(id)
    } catch (err: any) {
      if (err?.statusCode === 403 || err?.statusCode === 401) {
        throw err
      }
    }
    models.value = models.value.filter((m) => m.id !== id)
    if (selectedModelId.value === id && models.value.length > 0) {
      selectedModelId.value = models.value[0].id
    }
  }

  async function makeDefault(id: string) {
    try {
      await modelsService.setDefaultModel(id)
    } catch (err: any) {
      if (err?.statusCode === 403) {
        throw err
      }
    }
    models.value.forEach((m) => {
      m.isDefault = m.id === id
    })
  }

  function selectModel(id: string) {
    selectedModelId.value = id
  }

  async function toggleModelStatus(id: string, isActive: boolean) {
    try {
      await modelsService.updateModelStatus(id, isActive)
    } catch (err: any) {
      if (err?.statusCode === 403 || err?.statusCode === 401) {
        throw err
      }
    }
    const target = models.value.find((m) => m.id === id)
    if (target) {
      target.isActive = isActive
    }
  }

  return {
    models,
    activeModels,
    selectedModelId,
    selectedModel,
    defaultModel,
    loading,
    error,
    fetchModels,
    addModel,
    removeModel,
    makeDefault,
    toggleModelStatus,
    selectModel
  }
})
