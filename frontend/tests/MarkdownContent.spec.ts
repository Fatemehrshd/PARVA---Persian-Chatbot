import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownContent from '../src/components/chat/MarkdownContent.vue'

describe('MarkdownContent.vue', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('renders fenced code blocks with language badge, copy button, and ltr pre/code', async () => {
    const markdown = `
\`\`\`typescript
interface UserConfig {
  theme: 'dark' | 'light';
  notifications: boolean;
}
\`\`\`
`
    const wrapper = mount(MarkdownContent, {
      props: { content: markdown }
    })

    expect(wrapper.find('.code-block-wrapper').exists()).toBe(true)
    expect(wrapper.find('.code-lang').text()).toBe('TYPESCRIPT')
    expect(wrapper.find('.copy-code-btn').exists()).toBe(true)
    expect(wrapper.find('pre code').text()).toContain('interface UserConfig')
  })

  it('renders GFM markdown tables with responsive wrapper and styled table headers', () => {
    const tableMarkdown = `
| ویژگی | وضعیت | نسخه |
| :--- | :---: | ---: |
| استریمینگ | فعال | 1.0.0 |
| قالب‌بندی کد | پیاده‌سازی شده | 1.1.0 |
`
    const wrapper = mount(MarkdownContent, {
      props: { content: tableMarkdown }
    })

    expect(wrapper.find('.table-responsive').exists()).toBe(true)
    expect(wrapper.find('table.markdown-table').exists()).toBe(true)
    expect(wrapper.findAll('th').length).toBe(3)
    expect(wrapper.findAll('tr').length).toBe(3) // 1 header + 2 rows
    expect(wrapper.text()).toContain('استریمینگ')
    expect(wrapper.text()).toContain('قالب‌بندی کد')
  })

  it('renders README elements including headings, blockquotes, lists, and inline code', () => {
    const readmeMarkdown = `
# عنوان سطح یک
## عنوان سطح دو

این یک پاراگراف به همراه \`کد درون‌خطی\` است.

> این یک نقل قول مهم است.

- مورد لیست ۱
- مورد لیست ۲
`
    const wrapper = mount(MarkdownContent, {
      props: { content: readmeMarkdown }
    })

    expect(wrapper.find('h1').exists()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(true)
    expect(wrapper.find('blockquote').exists()).toBe(true)
    expect(wrapper.find('ul').exists()).toBe(true)
    expect(wrapper.findAll('li').length).toBe(2)
    expect(wrapper.find('code.inline-code').exists()).toBe(true)
    expect(wrapper.text()).toContain('عنوان سطح یک')
    expect(wrapper.text()).toContain('کد درون‌خطی')
    expect(wrapper.text()).toContain('این یک نقل قول مهم است.')
  })

  it('handles code copying on copy button click', async () => {
    const codeMarkdown = `
\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\`
`
    const wrapper = mount(MarkdownContent, {
      props: { content: codeMarkdown },
      attachTo: document.body
    })

    const copyBtn = wrapper.find('.copy-code-btn')
    expect(copyBtn.exists()).toBe(true)

    await copyBtn.trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('def greet(name):\n    return f"Hello, {name}!"')

    expect(copyBtn.text()).toContain('کپی شد ✓')
    wrapper.unmount()
  })

  it('gracefully handles streaming mode with unclosed code fences', () => {
    const partialMarkdown = `
در زیر یک مثال پایتون مشاهده می‌کنید:
\`\`\`python
for i in range(5):
    print(i)
`
    const wrapper = mount(MarkdownContent, {
      props: {
        content: partialMarkdown,
        streaming: true
      }
    })

    // In streaming mode, unclosed ``` is closed temporarily and renders a code block
    expect(wrapper.find('.code-block-wrapper').exists()).toBe(true)
    expect(wrapper.find('.code-lang').text()).toBe('PYTHON')
    expect(wrapper.text()).toContain('for i in range(5):')
  })
})
