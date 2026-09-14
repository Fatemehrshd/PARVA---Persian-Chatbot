import { describe, it, expect, beforeEach, vi } from 'vitest'
import { modelsService } from '../../src/services/models.service'
import * as apiModule from '../../src/services/api'

describe('Models Service (models.service.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists models via GET /admin/models', async () => {
    const mockModels = [{ id: 'm-1', name: 'Claude', provider: 'anthropic', apiIdentifier: 'claude-3-5', isActive: true, isDefault: true }]
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockModels as any)

    const result = await modelsService.listModels()
    expect(requestSpy).toHaveBeenCalledWith('/admin/models')
    expect(result).toEqual(mockModels)
  })

  it('creates model via POST /admin/models', async () => {
    const newModel = { name: 'GPT-4o', provider: 'openai', apiIdentifier: 'gpt-4o', isActive: true }
    const mockCreated = { id: 'm-2', ...newModel, isDefault: false }
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockCreated as any)

    const result = await modelsService.createModel(newModel)
    expect(requestSpy).toHaveBeenCalledWith('/admin/models', {
      method: 'POST',
      body: JSON.stringify(newModel)
    })
    expect(result).toEqual(mockCreated)
  })

  it('deletes model via DELETE /admin/models/:id', async () => {
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue({} as any)

    await modelsService.deleteModel('m-2')
    expect(requestSpy).toHaveBeenCalledWith('/admin/models/m-2', {
      method: 'DELETE'
    })
  })

  it('sets model as default via PATCH /admin/models/:id/default', async () => {
    const mockUpdated = { id: 'm-2', name: 'GPT-4o', provider: 'openai', apiIdentifier: 'gpt-4o', isActive: true, isDefault: true }
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockUpdated as any)

    const result = await modelsService.setDefaultModel('m-2')
    expect(requestSpy).toHaveBeenCalledWith('/admin/models/m-2/default', {
      method: 'PATCH'
    })
    expect(result.isDefault).toBe(true)
  })
})

