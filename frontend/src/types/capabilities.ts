export type CapabilityKey = 'thinking' | 'vision' | 'document'

export interface CapabilityConfig {
  key: CapabilityKey
  label: string
  description: string
  badgeColor: string
}

export const CAPABILITY_METADATA: Record<CapabilityKey, CapabilityConfig> = {
  thinking: {
    key: 'thinking',
    label: 'تفکر عمیق',
    description: 'پشتیبانی از تفکر و استدلال گام به گام',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
  },
  vision: {
    key: 'vision',
    label: 'پردازش تصویر',
    description: 'امکان ارسال و تحلیل تصاویر',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
  },
  document: {
    key: 'document',
    label: 'تحلیل اسناد',
    description: 'امکان ارسال و تحلیل فایل‌های متنی، PDF و اکسل',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
  },
}

export interface ModelCapabilities {
  supportsThinking?: boolean
  supportsVision?: boolean
  supportsDocument?: boolean
  thinkingBudgetTokens?: number | null
}

export function getModelCapabilities(model?: ModelCapabilities | null): CapabilityKey[] {
  if (!model) return []
  const list: CapabilityKey[] = []
  if (model.supportsThinking) list.push('thinking')
  if (model.supportsVision !== false) list.push('vision')
  if (model.supportsDocument !== false) list.push('document')
  return list
}
