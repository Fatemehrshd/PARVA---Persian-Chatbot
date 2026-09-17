import { buildUrl, request, ApiError } from './api'
import type { FileAttachmentItem } from '../types'

export interface UploadLimits {
  maxFileSizeMb: number
  maxTotalSizeMb: number
  maxFileCount: number
  maxFileSizeBytes: number
  maxTotalSizeBytes: number
}

export const filesService = {
  async getSettings(): Promise<UploadLimits> {
    try {
      const res = await request<{ data: UploadLimits } | UploadLimits>('/files/settings')
      const data = (res as any)?.data || res
      return {
        maxFileSizeMb: Number(data.maxFileSizeMb) || 20,
        maxTotalSizeMb: Number(data.maxTotalSizeMb) || 50,
        maxFileCount: Number(data.maxFileCount) || 5,
        maxFileSizeBytes: (Number(data.maxFileSizeMb) || 20) * 1024 * 1024,
        maxTotalSizeBytes: (Number(data.maxTotalSizeMb) || 50) * 1024 * 1024,
      }
    } catch {
      return {
        maxFileSizeMb: 20,
        maxTotalSizeMb: 50,
        maxFileCount: 5,
        maxFileSizeBytes: 20 * 1024 * 1024,
        maxTotalSizeBytes: 50 * 1024 * 1024,
      }
    }
  },

  uploadFile(
    file: File,
    conversationId?: string,
    onProgress?: (percent: number) => void,
    abortSignal?: AbortSignal,
  ): Promise<FileAttachmentItem> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = buildUrl('/files/upload')
      xhr.open('POST', url, true)

      const token = localStorage.getItem('token')
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          xhr.abort()
          reject(new DOMException('Upload aborted', 'AbortError'))
        })
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        let json: any
        try {
          json = JSON.parse(xhr.responseText)
        } catch {
          json = {}
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          const data = json.data || json
          resolve(data)
        } else {
          const message = json.message || json.error || 'خطا در آپلود فایل'
          reject(new ApiError(xhr.status, message))
        }
      }

      xhr.onerror = () => {
        reject(new ApiError(xhr.status || 500, 'خطای ارتباط با سرور در آپلود فایل'))
      }

      const formData = new FormData()
      formData.append('file', file)
      if (conversationId) {
        formData.append('conversationId', conversationId)
      }

      xhr.send(formData)
    })
  },

  async deleteFile(id: string): Promise<void> {
    await request(`/files/${id}`, { method: 'DELETE' }).catch(() => {})
  },

  async getFileStatus(id: string): Promise<any> {
    const res = await request<any>(`/files/${id}/status`)
    return res.data || res
  },

  async retryFile(id: string): Promise<any> {
    const res = await request<any>(`/files/${id}/retry`, { method: 'POST' })
    return res.data || res
  },
}
