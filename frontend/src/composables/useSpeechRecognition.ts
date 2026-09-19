import { ref, onUnmounted, getCurrentInstance } from 'vue'

export interface SpeechRecognitionOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (transcript: string, isFinal: boolean) => void
  onError?: (error: any) => void
  onEnd?: () => void
}

export function useSpeechRecognition() {
  const isListening = ref(false)
  const isSupported = ref(
    typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  )
  const transcript = ref('')
  const error = ref<string | null>(null)

  let recognition: any = null

  function initRecognition(options: SpeechRecognitionOptions = {}) {
    if (!isSupported.value) return null

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const instance = new SpeechRecognitionAPI()

    instance.lang = options.lang || 'fa-IR'
    instance.continuous = options.continuous ?? true
    instance.interimResults = options.interimResults ?? true

    instance.onstart = () => {
      isListening.value = true
      error.value = null
    }

    instance.onresult = (event: any) => {
      let currentInterim = ''
      let currentFinal = ''

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''
        if (result.isFinal) {
          currentFinal += text
        } else {
          currentInterim += text
        }
      }

      const latest = currentFinal || currentInterim
      transcript.value = latest

      if (options.onResult) {
        options.onResult(latest, Boolean(currentFinal))
      }
    }

    instance.onerror = (event: any) => {
      error.value = event.error || 'speech_recognition_error'
      if (options.onError) {
        options.onError(event)
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListening.value = false
      }
    }

    instance.onend = () => {
      isListening.value = false
      if (options.onEnd) {
        options.onEnd()
      }
    }

    return instance
  }

  function start(options: SpeechRecognitionOptions = {}) {
    if (!isSupported.value) return false

    if (recognition && isListening.value) {
      stop()
    }

    try {
      recognition = initRecognition(options)
      if (recognition) {
        recognition.start()
        return true
      }
    } catch (err: any) {
      error.value = err?.message || 'start_failed'
      isListening.value = false
    }
    return false
  }

  function stop() {
    if (recognition) {
      try {
        recognition.stop()
      } catch {}
      isListening.value = false
    }
  }

  function toggle(options: SpeechRecognitionOptions = {}) {
    if (isListening.value) {
      stop()
      return false
    } else {
      return start(options)
    }
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stop()
    })
  }

  return {
    isListening,
    isSupported,
    transcript,
    error,
    start,
    stop,
    toggle,
  }
}
