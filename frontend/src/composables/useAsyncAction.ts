import { ref, type Ref } from 'vue'

export interface AsyncActionOptions<TResult = any> {
  onSuccess?: (result: TResult) => void
  onError?: (error: unknown) => void
}

export interface UseAsyncActionReturn<TArgs extends any[], TResult> {
  isLoading: Ref<boolean>
  error: Ref<string | null>
  execute: (...args: TArgs) => Promise<TResult | undefined>
  reset: () => void
}

/**
 * Global composable to handle loading states for asynchronous operations,
 * automatically disabling inputs and buttons until the action completes.
 */
export function useAsyncAction<TArgs extends any[] = any[], TResult = any>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
  options?: AsyncActionOptions<TResult>
): UseAsyncActionReturn<TArgs, TResult> {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function execute(...args: TArgs): Promise<TResult | undefined> {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null

    try {
      const result = await asyncFn(...args)
      options?.onSuccess?.(result)
      return result
    } catch (err: any) {
      const message = err?.message || 'عملیات با خطا مواجه شد.'
      error.value = message
      options?.onError?.(err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }

  function reset() {
    isLoading.value = false
    error.value = null
  }

  return {
    isLoading,
    error,
    execute,
    reset,
  }
}

/**
 * Lightweight wrapper function to run an async block with an isolated loading ref.
 */
export function useLoadingState() {
  const isLoading = ref(false)

  async function withLoading<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (isLoading.value) return
    isLoading.value = true
    try {
      return await fn()
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    withLoading,
  }
}

