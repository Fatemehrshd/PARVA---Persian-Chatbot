<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Terminal, RefreshCw, ExternalLink } from '@lucide/vue'
import { auditService } from '../../services/audit.service'

const props = defineProps<{
  signozUrl?: string
}>()

const logType = ref<'app' | 'error'>('app')
const lines = ref<string[]>([])
const totalLines = ref(0)
const filename = ref('')
const isLoading = ref(false)
const isAutoRefresh = ref(true)
const searchFilter = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const signozBaseUrl = computed(() => props.signozUrl || 'http://localhost:3301')

const filteredLines = computed(() => {
  if (!searchFilter.value.trim()) return lines.value
  const q = searchFilter.value.trim().toLowerCase()
  return lines.value.filter((l) => l.toLowerCase().includes(q))
})

async function fetchLogs() {
  isLoading.value = true
  try {
    const res = await auditService.getSystemLogs(logType.value, 150)
    lines.value = res.lines || []
    totalLines.value = res.totalLines || 0
    filename.value = res.filename || ''
  } catch (err) {
    console.error('Failed to load system logs', err)
  } finally {
    isLoading.value = false
  }
}

function startPolling() {
  stopPolling()
  if (isAutoRefresh.value) {
    timer = setInterval(fetchLogs, 3000)
  }
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function toggleAutoRefresh() {
  isAutoRefresh.value = !isAutoRefresh.value
  if (isAutoRefresh.value) {
    startPolling()
  } else {
    stopPolling()
  }
}

function switchType(type: 'app' | 'error') {
  logType.value = type
  fetchLogs()
}

function getLineColor(line: string) {
  if (line.includes('[ERROR]') || line.includes('"level":"ERROR"') || line.includes('ERR')) {
    return 'text-rose-400'
  }
  if (line.includes('[WARN]') || line.includes('"level":"WARN"')) {
    return 'text-amber-300'
  }
  if (line.includes('[INFO]') || line.includes('"level":"INFO"')) {
    return 'text-emerald-300'
  }
  if (line.includes('[DEBUG]') || line.includes('"level":"DEBUG"')) {
    return 'text-blue-300'
  }
  return 'text-gray-300'
}

onMounted(() => {
  fetchLogs()
  startPolling()
})

onUnmounted(stopPolling)
</script>

<template>
  <div class="border border-border rounded-xl bg-[#0d1117] text-[#c9d1d9] overflow-hidden shadow-md font-mono text-xs" dir="ltr">
    <!-- Terminal Header -->
    <div class="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full bg-[#ff5f56] inline-block"></span>
          <span class="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block"></span>
          <span class="w-3 h-3 rounded-full bg-[#27c93f] inline-block"></span>
        </div>
        <span class="text-xs text-muted-foreground font-sans font-medium ml-2 flex items-center gap-1.5">
          <Terminal :size="13" class="text-emerald-400" />
          <span class="text-emerald-400 font-mono">{{ filename || 'app.log' }}</span>
          <span class="text-[11px] text-gray-400">({{ totalLines.toLocaleString('fa-IR') }} خط لاگ سرور)</span>
        </span>
      </div>

      <div class="flex items-center gap-2" dir="rtl">
        <!-- Log type: app vs error -->
        <div class="flex items-center bg-[#21262d] rounded-md p-0.5 border border-[#30363d] text-[11px]">
          <button
            type="button"
            class="px-2 py-0.5 rounded transition-colors"
            :class="logType === 'app' ? 'bg-primary text-primary-foreground font-bold' : 'text-gray-400 hover:text-white'"
            @click="switchType('app')"
          >
            عمومی (app)
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition-colors"
            :class="logType === 'error' ? 'bg-rose-500 text-white font-bold' : 'text-gray-400 hover:text-white'"
            @click="switchType('error')"
          >
            خطاها (error)
          </button>
        </div>

        <!-- Auto-refresh Toggle -->
        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border transition-colors"
          :class="isAutoRefresh ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#21262d] border-[#30363d] text-gray-400'"
          @click="toggleAutoRefresh"
        >
          <span class="w-2 h-2 rounded-full" :class="isAutoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'"></span>
          <span>{{ isAutoRefresh ? 'استریم زنده فعال (۳s)' : 'استریم متوقف' }}</span>
        </button>

        <!-- Refresh Button -->
        <button
          type="button"
          class="p-1 rounded-md bg-[#21262d] border border-[#30363d] text-gray-300 hover:text-white transition-colors"
          :disabled="isLoading"
          title="بروزرسانی دستی"
          @click="fetchLogs"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Terminal Search Bar -->
    <div class="px-4 py-2 bg-[#161b22]/60 border-b border-[#30363d] flex items-center justify-between gap-3 text-xs">
      <div class="relative flex-1 max-w-md">
        <input
          v-model="searchFilter"
          type="text"
          placeholder="فیلتر متنی در لاگ‌های این فایل (grep)..."
          class="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-primary text-left font-mono"
          dir="ltr"
        />
      </div>
      <div class="text-[11px] text-gray-400 flex items-center gap-2">
        <span>نمایش {{ filteredLines.length }} از {{ lines.length }} سطر اخیر</span>
        <a
          :href="`${signozBaseUrl}/logs?liveTail=true`"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline flex items-center gap-1"
        >
          <span>مشاهده در SigNoz</span>
          <ExternalLink :size="11" />
        </a>
      </div>
    </div>

    <!-- Terminal Log Body -->
    <div class="p-4 overflow-y-auto max-h-[520px] space-y-1 select-text">
      <div v-if="filteredLines.length === 0" class="py-12 text-center text-gray-500 font-sans">
        {{ isLoading ? 'در حال دریافت لاگ‌های زنده سرور...' : 'هیچ لاگی در این فایل یافت نشد.' }}
      </div>
      <div
        v-for="(line, idx) in filteredLines"
        :key="idx"
        class="leading-relaxed hover:bg-[#161b22] px-1.5 py-0.5 rounded transition-colors whitespace-pre-wrap break-all text-[11.5px]"
      >
        <span :class="getLineColor(line)">{{ line }}</span>
      </div>
    </div>
  </div>
</template>
