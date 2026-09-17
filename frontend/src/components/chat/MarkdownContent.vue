<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Marked } from 'marked'
import { getTextDirection } from '../../utils/textDirection'

const props = defineProps<{
  content: string
  streaming?: boolean
}>()

const rootRef = ref<HTMLElement | null>(null)

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Create dedicated marked instance with custom renderers and Tailwind-powered markup
const markedInstance = new Marked({
  gfm: true,
  breaks: true
})

markedInstance.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = (lang || 'code').trim().toLowerCase()
      const encodedCode = encodeURIComponent(text)
      return `
<div class="code-block-wrapper" dir="ltr">
  <div class="code-block-header">
    <span class="code-lang">${escapeHtml(language.toUpperCase())}</span>
    <button type="button" class="copy-code-btn" data-code="${encodedCode}">
      <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span class="copy-label">کپی</span>
    </button>
  </div>
  <pre class="code-pre"><code class="language-${escapeHtml(language)}">${escapeHtml(text)}</code></pre>
</div>
`
    },
    table(token: any) {
      const tableText = [...token.header, ...token.rows.flat()].map((cell: any) => cell.text || '').join(' ')
      const direction = getTextDirection(tableText)
      const headerHtml = token.header
        .map((cell: any) => `<th dir="${getTextDirection(cell.text)}" class="px-4 py-2.5 text-right md:text-start font-semibold text-foreground border-b border-border/50">${this.parser.parseInline(cell.tokens)}</th>`)
        .join('')

      const rowsHtml = token.rows
        .map((row: any, idx: number) => {
          const cellsHtml = row
            .map((cell: any) => `<td dir="${getTextDirection(cell.text)}" class="px-4 py-2.5 text-foreground/90 border-b border-border/30">${this.parser.parseInline(cell.tokens)}</td>`)
            .join('')
          const rowBg = idx % 2 === 0 ? 'bg-card/40' : 'bg-muted/20'
          return `<tr class="${rowBg} hover:bg-muted/40 transition-colors">${cellsHtml}</tr>`
        })
        .join('')

      return `
<div class="table-responsive my-4 overflow-x-auto rounded-xl border border-border/50 shadow-sm ${direction}" dir="${direction}">
  <table class="markdown-table min-w-full border-collapse text-xs md:text-sm text-start" dir="${direction}">
    <thead class="bg-muted/60 border-b border-border/60">
      <tr>${headerHtml}</tr>
    </thead>
    <tbody class="divide-y divide-border/20">
      ${rowsHtml}
    </tbody>
  </table>
</div>
`
    },
    heading({ tokens, depth }: { tokens: any[]; depth: number }) {
      const content = this.parser.parseInline(tokens)
      const dir = getTextDirection(tokens.map((token: any) => token.text ?? token.raw ?? '').join(' '))
      const classesByDepth: Record<number, string> = {
        1: 'text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border/50 text-foreground',
        2: 'text-xl font-bold mt-5 mb-2.5 pb-1.5 border-b border-border/40 text-foreground',
        3: 'text-lg font-semibold mt-4 mb-2 text-foreground',
        4: 'text-base font-semibold mt-3 mb-1.5 text-foreground',
        5: 'text-sm font-semibold mt-2.5 mb-1 text-foreground',
        6: 'text-xs font-semibold uppercase tracking-wider mt-2 mb-1 text-muted-foreground'
      }
      const classes = classesByDepth[depth] || classesByDepth[3]
      return `<h${depth} class="${classes} ${dir}" dir="${dir}">${content}</h${depth}>`
    },
    blockquote({ tokens }: { tokens: any[] }) {
      const content = this.parser.parse(tokens)
      const quoteText = tokens.map((t: any) => t.text ?? t.raw ?? '').join(' ')
      const dir = getTextDirection(quoteText)
      const borderClass = dir === 'rtl' ? 'border-r-4 rounded-l-lg' : 'border-l-4 rounded-r-lg'
      return `<blockquote class="my-3 py-1.5 px-4 ${borderClass} border-primary bg-muted/30 text-muted-foreground italic ${dir}" dir="${dir}">${content}</blockquote>`
    },
    codespan({ text }: { text: string }) {
      return `<code class="inline-code font-mono text-[12.5px] px-1.5 py-0.5 rounded-md bg-secondary/80 text-primary-foreground/90 border border-border/40 font-medium" dir="ltr">${escapeHtml(text)}</code>`
    },
    hr() {
      return `<hr class="my-6 border-t border-border/50" />`
    },
    link({ href, title, tokens }: { href: string; title?: string | null; tokens: any[] }) {
      const text = this.parser.parseInline(tokens)
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr} class="text-primary font-medium hover:underline inline-flex items-center gap-0.5">${text}</a>`
    },
    paragraph({ tokens }: { tokens: any[] }) {
      const text = this.parser.parseInline(tokens)
      const fullText = tokens.map((token: any) => token.text ?? token.raw ?? '').join(' ')
      const dir = getTextDirection(fullText)

      // If paragraph contains hard linebreaks (<br>), break into directional lines
      if (text.includes('<br')) {
        const lines = text.split(/<br\s*\/?>/i)
        const linesHtml = lines.map(line => {
          const raw = line.replace(/<[^>]+>/g, '')
          const lineDir = getTextDirection(raw, dir)
          return `<span class="block ${lineDir}" dir="${lineDir}">${line}</span>`
        }).join('')
        return `<p class="leading-relaxed mb-3 last:mb-0">${linesHtml}</p>`
      }

      return `<p class="leading-relaxed mb-3 last:mb-0 ${dir}" dir="${dir}">${text}</p>`
    },
    list(token: any) {
      const tag = token.ordered ? 'ol' : 'ul'
      const listClass = token.ordered 
        ? 'list-decimal ps-6 my-3 space-y-1.5 leading-relaxed' 
        : 'list-disc ps-6 my-3 space-y-1.5 leading-relaxed'
      const body = token.items.map((item: any) => this.listitem(item)).join('')
      return `<${tag} class="${listClass}">${body}</${tag}>`
    },
    listitem(item: any) {
      let itemBody = ''
      if (item.task) {
        const checkbox = item.checked 
          ? '<input type="checkbox" checked disabled class="me-2 rounded text-primary focus:ring-0" />'
          : '<input type="checkbox" disabled class="me-2 rounded text-primary focus:ring-0" />'
        itemBody = `${checkbox}${this.parser.parse(item.tokens)}`
      } else {
        itemBody = this.parser.parse(item.tokens)
      }
      const itemRawText = item.tokens ? item.tokens.map((token: any) => token.text ?? token.raw ?? '').join(' ') : ''
      const dir = getTextDirection(itemRawText)
      return `<li class="my-1 ${dir}" dir="${dir}">${itemBody}</li>`
    }
  }
})

// Sanitize raw text or normalize incomplete code blocks during streaming
const parsedHtml = computed(() => {
  if (!props.content) return ''
  let textToParse = props.content

  // If currently streaming and there's an odd number of ``` fences, close it temporarily for clean preview
  if (props.streaming) {
    const fenceMatches = textToParse.match(/```/g)
    if (fenceMatches && fenceMatches.length % 2 !== 0) {
      textToParse += '\n```'
    }
  }

  try {
    return markedInstance.parse(textToParse) as string
  } catch (err) {
    console.error('Markdown parse error:', err)
    return escapeHtml(props.content)
  }
})

// Event delegation for code block copy buttons
function handleContainerClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return

  const copyBtn = target.closest('.copy-code-btn') as HTMLElement | null
  if (!copyBtn) return

  const rawCode = copyBtn.getAttribute('data-code')
  if (!rawCode) return

  const codeToCopy = decodeURIComponent(rawCode)
  navigator.clipboard.writeText(codeToCopy).then(() => {
    const label = copyBtn.querySelector('.copy-label')
    const originalText = label ? label.textContent : 'کپی'
    if (label) {
      label.textContent = 'کپی شد ✓'
    }
    copyBtn.classList.add('text-emerald-400', 'font-semibold')

    setTimeout(() => {
      if (label) {
        label.textContent = originalText
      }
      copyBtn.classList.remove('text-emerald-400', 'font-semibold')
    }, 1800)
  }).catch(err => {
    console.warn('Clipboard write failed', err)
  })
}

onMounted(() => {
  if (rootRef.value) {
    rootRef.value.addEventListener('click', handleContainerClick)
  }
})

onBeforeUnmount(() => {
  if (rootRef.value) {
    rootRef.value.removeEventListener('click', handleContainerClick)
  }
})
</script>

<template>
  <div 
    ref="rootRef" 
    class="markdown-content text-[14px] md:text-[15px] leading-7 font-sans transition-colors"
    v-html="parsedHtml"
  ></div>
</template>

<style>
/* Scoped & nested adjustments for rich markdown presentation */
.markdown-content pre {
  margin: 0;
  border-radius: 0;
  background: transparent !important;
}

/* ── Code block ── */
.markdown-content .code-block-wrapper {
  margin: 1rem 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--code-bg, #11121d);
  color: var(--code-fg, #e2e4f0);
  font-size: 13px;
}

.markdown-content .code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--code-header-bg, #181926);
  border-bottom: 1px solid var(--code-divider, rgba(255,255,255,0.07));
  font-family: var(--font-mono);
  font-size: 11px;
}

.markdown-content .code-lang {
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--code-label, rgba(255,255,255,0.5));
}

.markdown-content .copy-code-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--code-label, rgba(255,255,255,0.5));
  font-family: var(--font-sans);
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.markdown-content .copy-code-btn:hover {
  color: #fff;
  background: rgba(255,255,255,0.08);
}

.markdown-content .copy-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.markdown-content .code-pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.65;
  background: transparent !important;
  border-radius: 0;
}

/* Light mode overrides */
html:not(.dark) .markdown-content .code-block-wrapper {
  --code-bg: #1e2030;
  --code-header-bg: #161824;
  --code-divider: rgba(255,255,255,0.07);
  --code-label: rgba(255,255,255,0.45);
}

.markdown-content .inline-code {
  font-family: var(--font-mono);
  background-color: var(--secondary);
  color: var(--foreground);
  border: 1px solid var(--border);
}

.markdown-content .table-responsive {
  border-color: var(--border);
  background-color: var(--card);
}

.markdown-content table {
  border-collapse: collapse;
}

.markdown-content th,
.markdown-content td {
  border-color: var(--border);
}

/* BiDi directional rules for markdown elements */
.markdown-content .rtl,
.markdown-content [dir="rtl"] {
  text-align: right;
  direction: rtl;
}

.markdown-content .ltr,
.markdown-content [dir="ltr"] {
  text-align: left;
  direction: ltr;
}

.markdown-content li.rtl,
.markdown-content li[dir="rtl"] {
  text-align: right;
  direction: rtl;
}

.markdown-content li.ltr,
.markdown-content li[dir="ltr"] {
  text-align: left;
  direction: ltr;
}

.markdown-content blockquote.rtl,
.markdown-content blockquote[dir="rtl"] {
  text-align: right;
  direction: rtl;
}

.markdown-content blockquote.ltr,
.markdown-content blockquote[dir="ltr"] {
  text-align: left;
  direction: ltr;
}

.markdown-content th[dir="rtl"],
.markdown-content td[dir="rtl"] {
  text-align: right;
  direction: rtl;
}

.markdown-content th[dir="ltr"],
.markdown-content td[dir="ltr"] {
  text-align: left;
  direction: ltr;
}
</style>
