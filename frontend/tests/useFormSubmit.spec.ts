import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFormSubmit } from '../src/composables/useFormSubmit'
import { ApiError } from '../src/services/api'

describe('useFormSubmit Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with default idle state', () => {
    const { isSubmitting, error, fieldErrors } = useFormSubmit(async () => {})
    expect(isSubmitting.value).toBe(false)
    expect(error.value).toBeNull()
    expect(fieldErrors.value).toEqual({})
  })

  it('manages loading state and executes onSuccess callback', async () => {
    let resolved = false
    const onSuccess = vi.fn()

    const { isSubmitting, submit } = useFormSubmit(
      async () => {
        resolved = true
        return { success: true }
      },
      { onSuccess }
    )

    const promise = submit()
    expect(isSubmitting.value).toBe(true)

    const result = await promise
    expect(isSubmitting.value).toBe(false)
    expect(resolved).toBe(true)
    expect(result).toEqual({ success: true })
    expect(onSuccess).toHaveBeenCalledWith({ success: true })
  })

  it('prevents concurrent double submission', async () => {
    let count = 0
    let finishFirstSubmission!: () => void
    const longRunningPromise = new Promise<string>((resolve) => {
      finishFirstSubmission = () => resolve('first')
    })

    const { submit } = useFormSubmit(async () => {
      count++
      return longRunningPromise
    })

    const first = submit()
    const second = submit()

    expect(count).toBe(1)
    expect(await second).toBeUndefined()

    finishFirstSubmission()
    await first
  })

  it('captures server ApiError and sets error message', async () => {
    const onError = vi.fn()
    const { submit, error } = useFormSubmit(
      async () => {
        throw new ApiError(403, 'Admin only', 'Forbidden')
      },
      { onError }
    )

    const result = await submit()
    expect(result).toBeUndefined()
    expect(error.value).toBe('Admin only')
    expect(onError).toHaveBeenCalled()
  })

  it('maps class-validator array error messages into fieldErrors', async () => {
    const { submit, fieldErrors, error } = useFormSubmit(async () => {
      const err: any = new Error('Validation failed')
      err.message = ['email must be an email', 'password must be longer than 8 characters']
      throw err
    })

    await submit()
    expect(error.value).toBe('email must be an email, password must be longer than 8 characters')
    expect(fieldErrors.value['email']).toBe('email must be an email')
    expect(fieldErrors.value['password']).toBe('password must be longer than 8 characters')
  })

  it('reset() clears error and fieldErrors state', async () => {
    const { submit, error, fieldErrors, reset, setFieldError, clearFieldError } = useFormSubmit(async () => {
      throw new Error('Some error')
    })

    await submit()
    expect(error.value).toBe('Some error')

    setFieldError('customField', 'Invalid field')
    expect(fieldErrors.value['customField']).toBe('Invalid field')

    clearFieldError('customField')
    expect(fieldErrors.value['customField']).toBeUndefined()

    reset()
    expect(error.value).toBeNull()
    expect(fieldErrors.value).toEqual({})
  })
})

