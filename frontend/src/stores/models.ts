import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Model, CreateModelRequest } from '../types'
import { modelsService } from '../services/models.service'

export const useModelsStore = defineStore('models', () => {
  const initialModels: Model[] = [
    {
      id: 'm-1',
      name: 'Neural-1 Flash',
      provider: 'anthropic',
      apiIdentifier: 'claude-3-5-sonnet',
      isActive: true,
      isDefault: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'm-2',
      name: 'GPT-4o Omni',
      provider: 'openai',
      apiIdentifier: 'gpt-4o',
      isActive: true,
      isDefault: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'm-3',
      name: 'Llama 3.3 70B',
      provider: 'local',
      apiIdentifier: 'llama-3.3-70b-instruct',
      isActive: true,
      isDefault: false,
      createdAt: new Date().toISOString()
    }
  ]

  const models = ref<Model[]>(initialModels)
  const selectedModelId = ref<string>('m-1')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const defaultModel = computed(() => models.value.find((m) => m.isDefault) || models.value[0])
  const selectedModel = computed(() => models.value.find((m) => m.id === selectedModelId.value) || defaultModel.value)

  async function fetchModels() {
    loading.value = true
    try {
      const data = await modelsService.listModels()
      if (Array.isArray(data) && data.length > 0) {
        models.value = data
        const def = data.find((m) => m.isDefault)
        if (def && !selectedModelId.value) {
          selectedModelId.value = def.id
        }
      }
    } catch {
      // Keep initial sample models if backend is not yet populated
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
