import { ref, computed, onMounted } from 'vue'
import type { FileAttachmentItem } from '../types'
import { filesService, type UploadLimits } from '../services/files.service'
import { useUiStore } from '../stores/ui'

export function useFileUpload(conversationIdProvider: () => string | null) {
  const uiStore = useUiStore()

  const attachedFiles = ref<FileAttachmentItem[]>([])
  const isDraggingOver = ref(false)

  const limits = ref<UploadLimits>({
    maxFileSizeMb: 20,
    maxTotalSizeMb: 50,
    maxFileCount: 5,
    maxFileSizeBytes: 20 * 1024 * 1024,
    maxTotalSizeBytes: 50 * 1024 * 1024,
  })

  onMounted(async () => {
    try {
      limits.value = await filesService.getSettings()
    } catch {
      // keep fallback
    }
  })

  const hasUploadingFiles = computed(() =>
    attachedFiles.value.some((f) => f.status === 'uploading'),
  )

  const hasProcessingFiles = computed(() =>
    attachedFiles.value.some((f) => f.status === 'processing'),
  )

  const hasErrorFiles = computed(() =>
    attachedFiles.value.some((f) => f.status === 'error'),
  )

  const allReadyFiles = computed(() =>
    attachedFiles.value.filter((f) => f.status === 'ready'),
  )

  const readyFileIds = computed(() =>
    allReadyFiles.value.map((f) => f.id),
  )

  /**
   * Validates incoming File list against size and count limits.
   */
  function validateFiles(newFiles: File[]): { valid: boolean; message?: string } {
    const currentCount = attachedFiles.value.length
    if (currentCount + newFiles.length > limits.value.maxFileCount) {
      return {
        valid: false,
        message: `حداکثر ${limits.value.maxFileCount} فایل می‌توانید در یک پیام پیوست کنید`,
      }
    }

    const currentTotalBytes = attachedFiles.value.reduce(
      (sum, f) => sum + (f.fileSize || 0),
      0,
    )
    const newTotalBytes = newFiles.reduce((sum, f) => sum + f.size, 0)

    const ALLOWED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.gif', '.svg']
    const ALLOWED_DOC_EXTS = ['.pdf', '.xlsx', '.xls', '.csv']
    const ALL_ALLOWED_EXTS = [...ALLOWED_IMAGE_EXTS, ...ALLOWED_DOC_EXTS]

    for (const f of newFiles) {
      const name = f.name.toLowerCase()
      const hasValidExt = ALL_ALLOWED_EXTS.some((ext) => name.endsWith(ext))

      if (!hasValidExt || !isFileTypeSupported(f)) {
        return {
          valid: false,
          message: `فرمت فایل «${f.name}» مجاز نیست. تنها فرمت‌های عکس (PNG, JPG, JFIF, WEBP, GIF, SVG)، اسناد PDF و اکسل (XLSX, XLS, CSV) مجاز هستند.`,
        }
      }
      if (f.size > limits.value.maxFileSizeBytes) {
        return {
          valid: false,
          message: `حجم فایل "${f.name}" بیش از سقف مجاز (${limits.value.maxFileSizeMb} مگابایت) است`,
        }
      }
    }

    if (currentTotalBytes + newTotalBytes > limits.value.maxTotalSizeBytes) {
      return {
        valid: false,
        message: `مجموع حجم فایل‌ها از سقف مجاز (${limits.value.maxTotalSizeMb} مگابایت) فراتر می‌رود`,
      }
    }

    return { valid: true }
  }

  function isFileTypeSupported(file: File): boolean {
    const name = file.name.toLowerCase()
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|jfif|webp|gif|svg)$/i.test(name)
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf')
    const isExcel =
      file.type.includes('spreadsheet') ||
      file.type.includes('excel') ||
      file.type.includes('csv') ||
      file.type === 'text/csv' ||
      /\.(xlsx|xls|csv)$/i.test(name)
    return isImage || isPdf || isExcel
  }

  function resolveFileType(file: File): 'image' | 'pdf' | 'excel' {
    const name = file.name.toLowerCase()
    if (file.type.startsWith('image/') || /\.(png|jpe?g|jfif|webp|gif|svg)$/i.test(name)) {
      return 'image'
    }
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      return 'pdf'
    }
    return 'excel'
  }

  /**
   * Adds and immediately starts uploading files.
   */
  async function addFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    const validation = validateFiles(fileArray)
    if (!validation.valid) {
      uiStore.showToast(validation.message || 'فایل‌های انتخابی مجاز نیستند', 'error')
      return
    }

    for (const file of fileArray) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      const fileType = resolveFileType(file)
      const previewUrl = fileType === 'image' ? URL.createObjectURL(file) : undefined

      const abortController = new AbortController()

      const item: FileAttachmentItem = {
        id: tempId,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileType,
        fileSize: file.size,
        status: 'uploading',
        progress: 0,
        previewUrl,
        abortController,
      }

      attachedFiles.value.push(item)

      // Grab reactive proxy from array to ensure all property mutations trigger Vue reactivity
      const reactiveItem = attachedFiles.value[attachedFiles.value.length - 1]
      startUpload(reactiveItem, file)
    }
  }

  async function startUpload(item: FileAttachmentItem, file: File) {
    const convId = conversationIdProvider() || undefined
    const tempId = item.id

    // Smooth visual progress ticker for instant/local uploads
    item.progress = 20
    const progressTimer = setInterval(() => {
      const current = attachedFiles.value.find((f) => f.id === item.id || f.id === tempId) || item
      if (current.status === 'uploading' && (current.progress || 0) < 85) {
        current.progress = Math.min(85, (current.progress || 20) + 20)
      }
    }, 100)

    try {
      const result = await filesService.uploadFile(
        file,
        convId,
        (percent) => {
          const current = attachedFiles.value.find((f) => f.id === item.id || f.id === tempId) || item
          current.progress = Math.max(current.progress || 20, percent)
        },
        item.abortController?.signal,
      )

      clearInterval(progressTimer)
      const current = attachedFiles.value.find((f) => f.id === item.id || f.id === tempId) || item
      // Replace tempId with actual server id
      current.id = result.id
      item.id = result.id
      current.status = (result.status as any) || 'processing'
      item.status = current.status
      current.progress = 100
      item.progress = 100

      // Start polling for processing status until ready or error
      pollFileStatus(current)
    } catch (err: any) {
      clearInterval(progressTimer)
      if (err?.name === 'AbortError' || err?.message === 'Upload aborted') {
        // User cancelled, ignore
        return
      }

      const current = attachedFiles.value.find((f) => f.id === item.id || f.id === tempId) || item
      current.status = 'error'
      item.status = 'error'
      current.errorMessage = err?.message || 'خطا در آپلود فایل'
      item.errorMessage = current.errorMessage
      uiStore.showToast(current.errorMessage || 'خطا در آپلود فایل', 'error')
    }
  }

  async function pollFileStatus(item: FileAttachmentItem) {
    let attempts = 0
    const maxAttempts = 60 // 60 * 1.5s = 90s

    // Check immediately first: small files/images process in ~10ms
    try {
      const immediateRes = await filesService.getFileStatus(item.id)
      const current = attachedFiles.value.find((f) => f.id === item.id) || item
      current.status = immediateRes.status
      current.errorMessage = immediateRes.errorMessage
      current.metadata = immediateRes.metadata
      item.status = immediateRes.status
      item.errorMessage = immediateRes.errorMessage
      item.metadata = immediateRes.metadata

      if (immediateRes.status === 'ready') {
        return
      }
      if (immediateRes.status === 'error') {
        uiStore.showToast(
          `خطا در پردازش فایل "${current.originalName}": ${immediateRes.errorMessage || 'خطا'}`,
          'error',
        )
        return
      }
    } catch {
      // continue to polling
    }

    const interval = setInterval(async () => {
      const current = attachedFiles.value.find((f) => f.id === item.id)
      // If item was removed from array, stop polling
      if (!current) {
        clearInterval(interval)
        return
      }

      attempts++
      try {
        const res = await filesService.getFileStatus(current.id)
        current.status = res.status
        current.errorMessage = res.errorMessage
        current.metadata = res.metadata
        item.status = res.status
        item.errorMessage = res.errorMessage
        item.metadata = res.metadata

        if (res.status === 'ready' || res.status === 'error') {
          clearInterval(interval)
          if (res.status === 'error') {
            uiStore.showToast(
              `خطا در پردازش فایل "${current.originalName}": ${res.errorMessage || 'خطا'}`,
              'error',
            )
          }
        }
      } catch {
        // network issue or temporary error
      }

      if (attempts >= maxAttempts && current.status === 'processing') {
        clearInterval(interval)
        current.status = 'error'
        current.errorMessage = 'پردازش فایل به دلیل اتمام زمان مجاز با خطا مواجه شد'
        item.status = 'error'
        item.errorMessage = current.errorMessage
        uiStore.showToast(current.errorMessage, 'error')
      }
    }, 1500)
  }

  /**
   * Helper to await completion of any in-flight byte transfers.
   */
  async function waitForUploads(): Promise<boolean> {
    if (!hasUploadingFiles.value) return true
    const start = Date.now()
    while (hasUploadingFiles.value && Date.now() - start < 20000) {
      await new Promise((r) => setTimeout(r, 100))
    }
    return !hasUploadingFiles.value
  }

  /**
   * Cancels active upload or removes uploaded file.
   */
  async function removeFile(item: FileAttachmentItem) {
    if (item.status === 'uploading' && item.abortController) {
      item.abortController.abort()
    }

    // Revoke blob URL when explicitly removed
    if (item.previewUrl) {
      try {
        URL.revokeObjectURL(item.previewUrl)
      } catch {}
    }

    // Call backend delete if already persisted
    if (item.id && !item.id.startsWith('temp-')) {
      filesService.deleteFile(item.id).catch(() => {})
    }

    attachedFiles.value = attachedFiles.value.filter((f) => f.id !== item.id)
  }

  async function retryFile(item: FileAttachmentItem) {
    if (!item.id || item.id.startsWith('temp-')) return

    item.status = 'processing'
    item.errorMessage = undefined
    try {
      await filesService.retryFile(item.id)
      pollFileStatus(item)
    } catch (err: any) {
      item.status = 'error'
      item.errorMessage = err?.message || 'خطا در تلاش مجدد'
      uiStore.showToast(item.errorMessage || 'خطا در تلاش مجدد', 'error')
    }
  }

  function clearAttachedFiles() {
    // Preserve blob URLs so sent message bubble can still display thumbnails
    attachedFiles.value = []
  }

  // Drag & drop event handlers
  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    isDraggingOver.value = true
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    isDraggingOver.value = false
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    isDraggingOver.value = false

    if (e.dataTransfer && e.dataTransfer.files) {
      addFiles(e.dataTransfer.files)
    }
  }

  return {
    attachedFiles,
    limits,
    isDraggingOver,
    hasUploadingFiles,
    hasProcessingFiles,
    hasErrorFiles,
    allReadyFiles,
    readyFileIds,
    waitForUploads,
    addFiles,
    removeFile,
    retryFile,
    clearAttachedFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
