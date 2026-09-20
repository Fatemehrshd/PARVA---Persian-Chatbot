import { ref, type Ref } from 'vue'
import { ApiError } from '../services/api'
import { useUiStore } from '../stores/ui'

export interface FormSubmitOptions<TResult = any> {
  onSuccess?: (result: TResult) => void | Promise<void>
  onError?: (error: Error | ApiError) => void | Promise<void>
  successMessage?: string
  showErrorToast?: boolean
}

export interface UseFormSubmitReturn<TArgs extends any[], TResult> {
  isSubmitting: Ref<boolean>
  error: Ref<string | null>
  fieldErrors: Ref<Record<string, string>>
  submit: (...args: TArgs) => Promise<TResult | undefined>
  reset: () => void
  clearFieldError: (field: string) => void
  setFieldError: (field: string, message: string) => void
}

/**
 * Universal Composable for handling form submissions, API mutations,
 * validation errors (from NestJS class-validator), loading state,
 * and optional toast notifications.
 */
export function useFormSubmit<TArgs extends any[] = any[], TResult = any>(
  submitFn: (...args: TArgs) => Promise<TResult>,
  options?: FormSubmitOptions<TResult>
): UseFormSubmitReturn<TArgs, TResult> {
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})

  function clearFieldError(field: string) {
    if (fieldErrors.value[field]) {
      const updated = { ...fieldErrors.value }
      delete updated[field]
      fieldErrors.value = updated
    }
  }

  function setFieldError(field: string, message: string) {
    fieldErrors.value = {
      ...fieldErrors.value,
      [field]: message
    }
  }

  function reset() {
    isSubmitting.value = false
    error.value = null
    fieldErrors.value = {}
  }

  async function submit(...args: TArgs): Promise<TResult | undefined> {
    if (isSubmitting.value) return undefined

    isSubmitting.value = true
    error.value = null
    fieldErrors.value = {}

    try {
      const result = await submitFn(...args)

      if (options?.successMessage) {
        try {
          const uiStore = useUiStore()
          uiStore.showToast(options.successMessage, 'success')
        } catch {
          // In isolated unit tests where Pinia might not be active
        }
      }

      await options?.onSuccess?.(result)
      return result
    } catch (err: any) {
      let errorMessage = 'عملیات با خطا مواجه شد.'
      // rawMessage preserves the validator array (ApiError.message is a
      // joined display string after localization).
      const rawMsg = err?.rawMessage ?? err?.message

      if (Array.isArray(rawMsg)) {
        errorMessage = rawMsg.join(', ')
        // Try mapping class-validator messages to fieldErrors
        const extracted: Record<string, string> = {}
        for (const m of rawMsg) {
          if (typeof m === 'string') {
            const firstWord = m.split(' ')[0]
            if (firstWord && !extracted[firstWord]) {
              extracted[firstWord] = m
            }
          }
        }
        fieldErrors.value = extracted
      } else if (typeof rawMsg === 'string' && rawMsg.trim()) {
        errorMessage = rawMsg
      }

      error.value = errorMessage

      if (options?.showErrorToast) {
        try {
          const uiStore = useUiStore()
          uiStore.showToast(errorMessage, 'error')
        } catch {
          // Ignore if Pinia not mounted
        }
      }

      await options?.onError?.(err)
      return undefined
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    isSubmitting,
    error,
    fieldErrors,
    submit,
    reset,
    clearFieldError,
    setFieldError
  }
}

