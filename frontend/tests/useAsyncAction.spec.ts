import { describe, it, expect, vi } from 'vitest'
import { useAsyncAction, useLoadingState } from '../src/composables/useAsyncAction'

describe('useAsyncAction composable', () => {
  it('manages isLoading lifecycle during async execution', async () => {
    let resolvePromise!: (val: string) => void
    const asyncFn = vi.fn().mockImplementation(() => {
      return new Promise<string>((resolve) => {
        resolvePromise = resolve
      })
    })

    const { isLoading, execute } = useAsyncAction(asyncFn)

    expect(isLoading.value).toBe(false)

    const execPromise = execute()
    expect(isLoading.value).toBe(true)

    resolvePromise('done')
    const result = await execPromise

    expect(result).toBe('done')
    expect(isLoading.value).toBe(false)
  })

  it('prevents multiple concurrent calls while loading', async () => {
    let resolvePromise!: () => void
    const asyncFn = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
    })

    const { isLoading, execute } = useAsyncAction(asyncFn)

    const firstCall = execute()
    expect(isLoading.value).toBe(true)

    // Second call while still loading should be ignored
    const secondCall = execute()
    expect(asyncFn).toHaveBeenCalledTimes(1)

    resolvePromise()
    await Promise.all([firstCall, secondCall])
    expect(isLoading.value).toBe(false)
  })

  it('handles errors and populates error ref and triggers onError', async () => {
    const errorCallback = vi.fn()
    const errorFn = vi.fn().mockRejectedValue(new Error('Network error'))

    const { isLoading, error, execute } = useAsyncAction(errorFn, {
      onError: errorCallback,
    })

    expect(error.value).toBeNull()
    const result = await execute()

    expect(result).toBeUndefined()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBe('Network error')
    expect(errorCallback).toHaveBeenCalled()
  })

  it('invokes onSuccess callback upon successful resolution', async () => {
    const successCallback = vi.fn()
    const successFn = vi.fn().mockResolvedValue({ id: '123' })

    const { execute } = useAsyncAction(successFn, {
      onSuccess: successCallback,
    })

    await execute()
    expect(successCallback).toHaveBeenCalledWith({ id: '123' })
  })

  it('can reset state via reset()', () => {
    const { isLoading, error, reset } = useAsyncAction(async () => {})
    isLoading.value = true
    error.value = 'Some error'

    reset()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })
})

describe('useLoadingState helper', () => {
  it('wraps execution with isLoading toggle', async () => {
    const { isLoading, withLoading } = useLoadingState()

    expect(isLoading.value).toBe(false)

    let resolvePromise!: () => void
    const asyncTask = new Promise<string>((resolve) => {
      resolvePromise = () => resolve('ok')
    })

    const taskPromise = withLoading(() => asyncTask)
    expect(isLoading.value).toBe(true)

    resolvePromise()
    const result = await taskPromise

    expect(result).toBe('ok')
    expect(isLoading.value).toBe(false)
  })
})
