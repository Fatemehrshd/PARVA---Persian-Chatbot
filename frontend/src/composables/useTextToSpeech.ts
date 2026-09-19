import { ref, computed } from 'vue'
import { buildUrl } from '../services/api'

export function cleanMarkdownForSpeech(text: string): string {
  if (!text) return ''

  return text
    // Strip fenced code blocks entirely
    .replace(/```[\s\S]*?```/g, ' ')
    // Strip inline code `code`
    .replace(/`([^`]+)`/g, '$1')
    // Strip markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip image links ![alt](url) -> ''
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Strip headers #, ##, ###
    .replace(/^#{1,6}\s+/gm, '')
    // Strip bold/italic formatting ***text***, **text**, *text*, __text__, _text_
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Strip blockquotes >
    .replace(/^>\s+/gm, '')
    // Strip horizontal rules --- or ***
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Strip HTML tags
    .replace(/<[^>]+>/g, '')
    // Normalize excess whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

// Global reactive playback state so only one message speaks at a time
const currentlyPlayingId = ref<string | null>(null)
const isPlaying = ref(false)
const isLoading = ref(false)

const isSupported = computed(
  () =>
    typeof window !== 'undefined' &&
    (typeof Audio !== 'undefined' || 'speechSynthesis' in window),
)

let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null
let pendingVoicesListener: (() => void) | null = null
let abortController: AbortController | null = null

function cleanupAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.src = ''
      currentAudio.onplay = null
      currentAudio.onended = null
      currentAudio.onerror = null
    } catch {}
    currentAudio = null
  }
  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl)
    } catch {}
    currentAudioUrl = null
  }
  if (abortController) {
    try {
      abortController.abort()
    } catch {}
    abortController = null
  }
}

function cleanupSpeechSynthesis() {
  if (currentUtterance && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
      if (pendingVoicesListener && window.speechSynthesis.removeEventListener) {
        window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListener)
      }
    } catch {}
  }
  pendingVoicesListener = null
  currentUtterance = null
}

function findPersianVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find(
    (voice) =>
      voice.lang.toLowerCase().startsWith('fa') ||
      voice.name.toLowerCase().includes('persian') ||
      voice.name.toLowerCase().includes('farsi'),
  )
}

function fallbackBrowserSpeak(
  messageId: string,
  cleanText: string,
  preferredLang: string = 'fa-IR',
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    currentlyPlayingId.value = null
    isPlaying.value = false
    isLoading.value = false
    return false
  }

  try {
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = preferredLang
    utterance.rate = 1.0
    utterance.pitch = 1.0

    const speakWithAvailableVoice = () => {
      if (currentUtterance !== utterance) return
      const voices = window.speechSynthesis.getVoices?.() ?? []
      const matchedVoice = findPersianVoice(voices)
      if (matchedVoice) utterance.voice = matchedVoice
      pendingVoicesListener = null
      window.speechSynthesis.speak(utterance)
    }

    utterance.onstart = () => {
      currentlyPlayingId.value = messageId
      isPlaying.value = true
      isLoading.value = false
    }

    utterance.onend = () => {
      if (currentlyPlayingId.value === messageId) {
        currentlyPlayingId.value = null
        isPlaying.value = false
        isLoading.value = false
        currentUtterance = null
      }
    }

    utterance.onerror = () => {
      if (currentlyPlayingId.value === messageId) {
        currentlyPlayingId.value = null
        isPlaying.value = false
        isLoading.value = false
        currentUtterance = null
      }
    }

    currentUtterance = utterance
    const voices = window.speechSynthesis.getVoices?.() ?? []
    if (voices.length === 0 && window.speechSynthesis.addEventListener) {
      pendingVoicesListener = speakWithAvailableVoice
      window.speechSynthesis.addEventListener('voiceschanged', pendingVoicesListener, {
        once: true,
      })
    } else {
      speakWithAvailableVoice()
    }
    return true
  } catch {
    cleanupSpeechSynthesis()
    currentlyPlayingId.value = null
    isPlaying.value = false
    isLoading.value = false
    return false
  }
}

export function useTextToSpeech() {
  function stop() {
    cleanupAudio()
    cleanupSpeechSynthesis()
    currentlyPlayingId.value = null
    isPlaying.value = false
    isLoading.value = false
  }

  async function speak(
    messageId: string,
    rawText: string,
    preferredLang: string = 'fa-IR',
  ) {
    if (!isSupported.value) return false

    // If clicking on currently active message, toggle off
    if (
      currentlyPlayingId.value === messageId &&
      (isPlaying.value || isLoading.value)
    ) {
      stop()
      return false
    }

    stop()

    const cleanText = cleanMarkdownForSpeech(rawText)
    if (!cleanText) return false

    currentlyPlayingId.value = messageId
    isLoading.value = true

    // Attempt high-quality Neural Persian TTS via backend first
    try {
      abortController = new AbortController()
      const url = buildUrl('/api/v1/tts/synthesize')
      const token =
        typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: cleanText,
          voice: 'fa-IR-DilaraNeural',
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`TTS server responded with ${response.status}`)
      }

      const blob = await response.blob()
      if (currentlyPlayingId.value !== messageId) return false // cancelled

      if (blob.size === 0) {
        throw new Error('Empty audio stream received')
      }

      const audioUrl = URL.createObjectURL(blob)
      currentAudioUrl = audioUrl
      const audio = new Audio(audioUrl)
      currentAudio = audio

      audio.onplay = () => {
        if (currentlyPlayingId.value === messageId) {
          isPlaying.value = true
          isLoading.value = false
        }
      }

      audio.onended = () => {
        if (currentlyPlayingId.value === messageId) {
          stop()
        }
      }

      audio.onerror = () => {
        if (currentlyPlayingId.value === messageId) {
          stop()
        }
      }

      await audio.play()
      return true
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return false
      }
      // If backend TTS fails (e.g. offline/network), gracefully fallback to browser voice
      return fallbackBrowserSpeak(messageId, cleanText, preferredLang)
    }
  }

  function toggle(messageId: string, rawText: string) {
    if (
      currentlyPlayingId.value === messageId &&
      (isPlaying.value || isLoading.value)
    ) {
      stop()
      return false
    } else {
      return speak(messageId, rawText)
    }
  }

  return {
    isSupported,
    isPlaying,
    isLoading,
    currentlyPlayingId,
    speak,
    stop,
    toggle,
  }
}
