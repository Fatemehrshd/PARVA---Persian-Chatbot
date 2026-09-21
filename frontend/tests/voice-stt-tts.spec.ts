import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { cleanMarkdownForSpeech, useTextToSpeech } from '../src/composables/useTextToSpeech'
import { useSpeechRecognition } from '../src/composables/useSpeechRecognition'
import MessageBubble from '../src/components/chat/MessageBubble.vue'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import type { Message } from '../src/types'

describe('Voice STT & TTS Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('cleanMarkdownForSpeech Helper', () => {
    it('removes code blocks, markdown tags, links, and bold formatting', () => {
      const markdown = `
# راهنمای جاوا اسکریپت
این یک **متن پررنگ** و *ایتالیک* است.
برای اطلاعات بیشتر به [این لینک](https://example.com) مراجعه کنید.
\`\`\`javascript
const x = 10;
console.log(x);
\`\`\`
کد درون‌خطی \`console.log\` نیز تمیز می‌شود.
> این یک نقل قول است.
`
      const cleaned = cleanMarkdownForSpeech(markdown)

      expect(cleaned).not.toContain('```')
      expect(cleaned).not.toContain('const x = 10')
      expect(cleaned).not.toContain('#')
      expect(cleaned).not.toContain('**')
      expect(cleaned).not.toContain('https://example.com')
      expect(cleaned).not.toContain('>')
      expect(cleaned).toContain('راهنمای جاوا اسکریپت')
      expect(cleaned).toContain('این یک متن پررنگ و ایتالیک است')
      expect(cleaned).toContain('برای اطلاعات بیشتر به این لینک مراجعه کنید')
      expect(cleaned).toContain('کد درون‌خطی console.log نیز تمیز می‌شود')
      expect(cleaned).toContain('این یک نقل قول است')
    })
  })

  describe('useSpeechRecognition Composable', () => {
    it('initializes and detects support correctly', () => {
      const mockRecognition = vi.fn().mockImplementation(() => ({
        lang: '',
        continuous: false,
        interimResults: false,
        start: vi.fn(),
        stop: vi.fn(),
        onstart: null,
        onresult: null,
        onerror: null,
        onend: null,
      }))

      ;(window as any).webkitSpeechRecognition = mockRecognition

      const { isSupported, isListening, start, stop } = useSpeechRecognition()
      expect(isSupported.value).toBe(true)
      expect(isListening.value).toBe(false)

      start()
      expect(mockRecognition).toHaveBeenCalled()

      stop()
      expect(isListening.value).toBe(false)
    })
  })

  describe('useTextToSpeech Composable', () => {
    it('synthesizes high-quality audio from backend endpoint and plays via Audio', async () => {
      const mockAudioPlay = vi.fn().mockResolvedValue(undefined)
      const mockAudioPause = vi.fn()

      ;(window as any).Audio = vi.fn().mockImplementation(() => ({
        play: mockAudioPlay,
        pause: mockAudioPause,
        src: '',
        onplay: null,
        onended: null,
        onerror: null,
      }))
      ;(window as any).URL.createObjectURL = vi.fn(() => 'blob:mock-audio')
      ;(window as any).URL.revokeObjectURL = vi.fn()

      // Mock successful backend TTS response
      const mockBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as any)

      const { speak, currentlyPlayingId } = useTextToSpeech()

      const success = await speak('msg-backend', 'سلام دنیا')
      expect(success).toBe(true)
      expect(currentlyPlayingId.value).toBe('msg-backend')
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tts/synthesize'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('سلام دنیا'),
        }),
      )
      expect(mockAudioPlay).toHaveBeenCalled()
    })

    it('falls back to browser SpeechSynthesis when backend fetch fails', async () => {
      const mockSpeak = vi.fn()
      const mockCancel = vi.fn()

      ;(window as any).speechSynthesis = {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: vi.fn(() => [{ name: 'Persian Voice', lang: 'fa-IR' }]),
      }

      ;(window as any).SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
        text,
        lang: '',
        voice: null,
        onstart: null,
        onend: null,
        onerror: null,
      }))

      // Mock backend TTS failure
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'))

      const { speak } = useTextToSpeech()
      const success = await speak('msg-fallback', 'سلام دنیا')

      expect(success).toBe(true)
      expect(mockSpeak).toHaveBeenCalled()
    })

    it('controls speech playback lifecycle and stop', async () => {
      const mockAudioPlay = vi.fn().mockResolvedValue(undefined)
      const mockAudioPause = vi.fn()

      ;(window as any).Audio = vi.fn().mockImplementation(() => ({
        play: mockAudioPlay,
        pause: mockAudioPause,
        src: '',
        onplay: null,
        onended: null,
        onerror: null,
      }))

      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as any)

      const { speak, stop, toggle, currentlyPlayingId, isPlaying } = useTextToSpeech()

      await speak('msg-1', 'سلام دنیا')
      expect(currentlyPlayingId.value).toBe('msg-1')

      // Stop
      stop()
      expect(currentlyPlayingId.value).toBeNull()
      expect(isPlaying.value).toBe(false)
      expect(mockAudioPause).toHaveBeenCalled()
    })
  })

  describe('MessageBubble.vue TTS Button', () => {
    it('does NOT render TTS button on assistant messages (TTS removed per user request)', () => {
      const assistantMsg: Message = {
        id: 'msg-assistant-1',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'پاسخ هوش مصنوعی به کاربر',
        createdAt: new Date().toISOString(),
      }

      const wrapper = mount(MessageBubble, {
        props: { message: assistantMsg },
      })

      const ttsBtn = wrapper.find('.tts-button')
      expect(ttsBtn.exists()).toBe(false)
    })

    it('does NOT render TTS button on user messages', () => {
      const userMsg: Message = {
        id: 'msg-user-1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'سوال کاربر',
        createdAt: new Date().toISOString(),
      }

      const wrapper = mount(MessageBubble, {
        props: { message: userMsg },
      })

      const ttsBtn = wrapper.find('.tts-button')
      expect(ttsBtn.exists()).toBe(false)
    })
  })

  describe('ChatComposer.vue Minimal Mic Button', () => {
    it('renders minimal mic icon without text label', () => {
      const wrapper = mount(ChatComposer, {
        props: {
          disabled: false,
          modelName: 'gpt-4o',
          providerName: 'OpenAI',
        },
      })

      const micBtn = wrapper.find('.btn-mic')
      expect(micBtn.exists()).toBe(true)
      expect(micBtn.attributes('title')).toContain('صوتی')

      // Strictly icon only, no text
      expect(micBtn.text().trim()).toBe('')
    })
  })
})
