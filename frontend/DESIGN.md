
Gemini
New chat
Search chats
Students
Library
New notebook
Realistic Cinematic Couples Nature Video
عصبانیت و شکستن مانیتور در بازی
بازطراحی راهنمای طراحی نئورال‌چت
Realistic Cinematic Couples Nature Video
Video Generation In Progress
Untitled
Motorcycle Portrait Prompt Refinement
خوشامدگویی و پیشنهاد کمک
سمت غلامرضا امین صومعه بزرگ
جستجوی اطلاعات درباره غلامرضا امین
ادغام اتحادیه‌های تریکو مشهد
سلام و احوالپرسی ساده
Netz-Seife Greeting
Brief Greeting, Then Assistance
توصیف فردی در حال استفاده از گوشی
ساخت تامبنیل بازی Short Life
ساخت آهنگ آرامش‌بخش سبک هانس زیمر
ساخت بازی اکشن تحت وب
خوش آمدگویی و پرسش کمک
پسر در حال استفاده از تلفن
رفتن به پمپ بنزین با ماشین یا پیاده
خوش آمد گویی و احوالپرسی
درک تصویر توسط هوش مصنوعی
خوش آمد گویی و پرسش کمک
GTA VI PS5 فریم ریت احتمالی
Untitled
انیمه ماینکرفت: انتقام از شکست
احوالپرسی و پرسش کمک
دلایل انتقال جود بلینگام به رئال مادرید
نگاهی به ابعاد صنعت هالیوود
Untitled
دلایل رایج مخالفت با ازدواج
درخواست ارائه تشخیص ناهنجاری پایگاه داده
Conversation with Gemini
# NeuralChat — Design Guidelines



A focused AI chat platform. Dark editorial stance: near-black ground, warm neutral text, single violet accent. Every decision reduces friction between the user and the conversation.



---



## Aesthetic Stance



**Direction:** Dark editorial — crisp, warm-neutral, minimal chrome  

**Reference points:** Linear, Raycast, Arc Browser  

**Principle:** The interface disappears; the conversation stays.



---



## Color Tokens



| Token                  | Value       | Usage                              |

|------------------------|-------------|------------------------------------|

| `--background`         | `#0e0f11`   | Page ground — near-black, warm     |

| `--foreground`         | `#e8e6e1`   | Default text — warm white          |

| `--card`               | `#161719`   | Message bubbles, panels, sidebar   |

| `--card-foreground`    | `#e8e6e1`   | Text on card surfaces              |

| `--primary`            | `#7c6af7`   | CTA, active states, user bubble    |

| `--primary-foreground` | `#ffffff`   | Text on primary                    |

| `--secondary`          | `#1e2025`   | Hover states, active sidebar items |

| `--secondary-foreground` | `#a8a49e` | Secondary text                     |

| `--muted`              | `#1a1b1e`   | Subtle fills                       |

| `--muted-foreground`   | `#6b6760`   | Placeholders, timestamps, labels   |

| `--accent`             | `#7c6af7`   | Focus rings, highlights            |

| `--border`             | `#232428`   | Hairlines, dividers                |

| `--ring`               | `#7c6af7`   | Focus ring                         |



**Ground rule:** Violet is the _only_ chromatic color. Everything else is warm gray on near-black. Do not introduce secondary accent colors.



---



## Typography



| Role         | Family            | Weight(s)       | Notes                              |

|--------------|-------------------|-----------------|------------------------------------|

| UI / Body    | Instrument Sans   | 400, 500, 600, 700 | All interface copy                |

| Mono / Data  | JetBrains Mono    | 400, 500        | Timestamps, model tags, code       |



**Scale:**



| Token         | Size     | Weight | Use                      |

|---------------|----------|--------|--------------------------|

| Page title    | 24px     | 700    | Empty state headline     |

| Section label | 10px     | 400    | Sidebar groupings (mono) |

| Body          | 14px     | 400    | Message text             |

| Small         | 11–12px  | 400    | Timestamps, captions (mono) |

| Button        | 14px     | 500    | Composer, CTAs           |



---



## Spacing Scale



Multiples of 4px. Use sparingly — generous whitespace reads as quality.



| Step  | Value  | Common use              |

|-------|--------|-------------------------|

| 1     | 4px    | Icon gap                |

| 2     | 8px    | Tight padding           |

| 3     | 12px   | Element padding         |

| 4     | 16px   | Section padding         |

| 5     | 20px   | Card padding            |

| 6     | 24px   | Section gap             |

| 8     | 32px   | Large spacing           |

| 12    | 48px   | Page-level vertical gap |



---



## Border Radius



| Token       | Value  | Component               |

|-------------|--------|-------------------------|

| `--radius`  | 10px   | Cards, sidebar items     |

| `sm`        | 8px    | Chips, tags             |

| `lg`        | 14px   | Composer, big cards     |

| Message bubble (user) | `18px 18px 4px 18px` | Asymmetric tail |

| Message bubble (AI)   | `18px 18px 18px 4px` | Asymmetric tail |



---



## Layout



```

┌─────────────────────────────────────────────────────────┐

│                     Header bar (48px)                   │

├────────────────┬────────────────────────────────────────┤

│                │                                        │

│  Sidebar       │   Message area (scrollable)            │

│  (260px fixed) │   max-width: 672px, centered           │

│                │                                        │

│  - Logo        │   ↑ messages                           │

│  - New chat    │   ↓ newest                             │

│  - Chat list   │                                        │

│  - User        │                                        │

├────────────────┴────────────────────────────────────────┤

│              Composer bar (auto-height)                 │

└─────────────────────────────────────────────────────────┘

```



**Message column:** `max-width: 672px`, `mx-auto`, `px-4`. Never full-bleed.



**Sidebar:** Collapsible. 260px open, 0 hidden. Toggle persists in local state.



---



## Components



### Sidebar



- Background: `var(--background)` with `border-r` hairline

- Logo: 28×28 rounded-lg, `var(--primary)` fill

- Chat item: full-width button, 8px vertical padding, truncated title + mono timestamp

- Active item: `var(--secondary)` background, `var(--foreground)` text

- User block: avatar gradient from `--primary` → violet-400



### Message Bubbles



**User bubble:**

- Background: `var(--primary)` solid

- Text: white

- Align: right, `flex-row-reverse`

- Border radius: `18px 18px 4px 18px` (tail at bottom-right)



**AI bubble:**

- Background: `var(--card)`, `border: 1px solid var(--border)`

- Text: `var(--card-foreground)`

- Border radius: `18px 18px 18px 4px` (tail at bottom-left)



**Avatar:**

- Size: 32×32px, circular

- User: gradient `--primary → violet-400`, initial letter

- AI: `var(--card)` bg, `var(--primary)` icon color



### Composer



- Container: `var(--card)` bg, `border-[var(--border)]`, `rounded-2xl`

- Focus: border transitions to `var(--ring)` (`transition-colors`)

- Textarea: auto-grows from 24px to 180px max

- Send button: 32×32 rounded-xl, `var(--primary)` when active, `var(--secondary)` when disabled



### Thinking indicator



Three dots, staggered pulse animation, `0.2s` delay between dots, 40% baseline opacity → 80% peak.



### Empty state



Centered column, bot icon in card, headline, one-line description, 2×2 suggestion grid with card-bordered buttons.



---



## Motion



- Sidebar open/close: `transition: width 300ms ease-in-out`

- Button hover/focus: `transition-colors 150ms`

- Message scroll: `scrollIntoView({ behavior: 'smooth' })`

- Thinking dots: CSS `@keyframes pulse`, 1.4s period

- No gratuitous animation — every motion has a functional purpose



---



## Scrollbars



Hidden at rest. Surface only on hover via `::-webkit-scrollbar-thumb` opacity toggle. Width: 4px. Color: `var(--border)`.



---



## Accessibility



- All interactive elements are `<button>` or `<textarea>` — native focus management

- Send button has `disabled` attribute when input is empty or AI is thinking

- Color is not the sole status indicator (thinking dots use both opacity + scale)

- AA contrast target: `var(--foreground)` on `var(--background)` — warm white (#e8e6e1) on near-black (#0e0f11) meets AAA

- Focus ring: 2px `var(--ring)` on all interactive elements



---



## Content Voice



- AI persona name: **NeuralChat**

- Tone: knowledgeable, direct, no filler

- Error / loading copy: functional, not playful

- Disclaimer: "NeuralChat can make mistakes. Verify important information." — small, centered, below composer



---



## Do / Don't



| Do | Don't |

|----|-------|

| Use violet sparingly — active states, primary actions only | Add a second accent color |

| Keep message column narrow (max 672px) | Let text span full width |

| Use mono for metadata (timestamps, model tags) | Use sans for timestamps |

| Commit to dark ground everywhere | Mix dark/light sections |

| Subtle hover transitions | Animated backgrounds or gradients on scroll |

| Warm neutral grays | Cool blue-gray neutrals |







فایل دیزاین md

منه

















میخوام به کلی تغییر کنه و به این صورت باشه

میخوام رنگ بندیش به کلی مثل عکس عوض شه

میتونی اصلاحش کنی بعد به من بدی؟ 

NeuralChat — Design Guidelines
A focused AI chat platform. Editorial stance: cool-tinted dark and warm-cream light palettes anchored by a single navy/blue accent. Every decision reduces friction between the user and the conversation.

Aesthetic Stance
Direction: Precision editorial — crisp, cool slate-tinted dark ground (or warm-cream light ground), minimal chrome

Reference points: Linear, Raycast, Arc Browser

Principle: The interface disappears; the conversation stays.

Color Tokens
Night Mode (Default)
Token	Hex / Value	Usage
--background	#0E0F18	Near-black with a blue cast
--card (Surface)	#171825	Message bubbles, elevated cards, panels
--surface-alt	#1E202E	Tab switcher tray, subtle structural fills
--primary	#6A8FFF	Lightened navy — CTA, active states, user bubble
--primary-hover	#839BFF	Button hover state
--foreground	#E8E8F0	Body text — cool white
--muted-foreground	#6B6B80	Placeholders, timestamps, captions
--border	rgba(106, 143, 255, 0.15)	Soft blue-tinted hairline dividers
--ring	rgba(106, 143, 255, 0.20)	Input focus glow
Light Mode
Token	Hex / Value	Usage
--background	#F5F3EE	Warm cream page ground
--card (Surface)	#FFFFFF	Form card, inputs, elevated panels
--surface-alt	#ECE9E2	Tab switcher tray, secondary fills
--primary	#1B2F6E	Deep navy — buttons, links, active accents
--primary-hover	#2A4199	Button hover state
--foreground	#1A1A2E	Body text, labels — deep midnight
--muted-foreground	#8A8898	Placeholders, captions, timestamps
--border	rgba(27, 47, 110, 0.14)	Input edges, card hairline
--ring	rgba(27, 47, 110, 0.10)	Input focus glow
Ground rule: Blue / Navy is the only chromatic accent family. Do not introduce secondary accent colors like amber, green, or violet.

Typography
Role	Family	Weight(s)	Notes
UI / Body	Instrument Sans	400, 500, 600, 700	All interface copy
Mono / Data	JetBrains Mono	400, 500	Timestamps, model tags, code
Scale:

Token	Size	Weight	Use
Page title	24px	700	Empty state headline
Section label	10px	400	Sidebar groupings (mono)
Body	14px	400	Message text
Small	11–12px	400	Timestamps, captions (mono)
Button	14px	500	Composer, CTAs
Spacing Scale
Multiples of 4px. Use sparingly — generous whitespace reads as quality.

Step	Value	Common use
1	4px	Icon gap
2	8px	Tight padding
3	12px	Element padding
4	16px	Section padding
5	20px	Card padding
6	24px	Section gap
8	32px	Large spacing
12	48px	Page-level vertical gap
Border Radius
Token	Value	Component
--radius	10px	Cards, sidebar items
sm	8px	Chips, tags
lg	14px	Composer, big cards
Message bubble (user)	18px 18px 4px 18px	Asymmetric tail
Message bubble (AI)	18px 18px 18px 4px	Asymmetric tail
Layout
┌─────────────────────────────────────────────────────────┐
│                     Header bar (48px)                   │
├────────────────┬────────────────────────────────────────┤
│                │                                        │
│  Sidebar       │   Message area (scrollable)            │
│  (260px fixed) │   max-width: 672px, centered           │
│                │                                        │
│  - Logo        │   ↑ messages                           │
│  - New chat    │   ↓ newest                             │
│  - Chat list   │                                        │
│  - User        │                                        │
├────────────────┴────────────────────────────────────────┤
│              Composer bar (auto-height)                 │
└─────────────────────────────────────────────────────────┘
Message column: max-width: 672px, mx-auto, px-4. Never full-bleed.

Sidebar: Collapsible. 260px open, 0 hidden. Toggle persists in local state.

Components
Sidebar
Background: var(--background) with border-r hairline using var(--border)

Logo: 28×28 rounded-lg, var(--primary) fill

Chat item: full-width button, 8px vertical padding, truncated title + mono timestamp

Active item: var(--surface-alt) background, var(--foreground) text

User block: avatar gradient from var(--primary) → var(--primary-hover)

Message Bubbles
User bubble:

Background: var(--primary)

Text: #FFFFFF (Night) / var(--background) (Light)

Align: right, flex-row-reverse

Border radius: 18px 18px 4px 18px (tail at bottom-right)

AI bubble:

Background: var(--card), border: 1px solid var(--border)

Text: var(--foreground)

Border radius: 18px 18px 18px 4px (tail at bottom-left)

Avatar:

Size: 32×32px, circular

User: gradient var(--primary) → var(--primary-hover), initial letter

AI: var(--card) background, var(--primary) icon color

Composer
Container: var(--card) background, border var(--border), rounded-2xl

Focus: border transitions to var(--ring) glow

Textarea: auto-grows from 24px to 180px max

Send button: 32×32 rounded-xl, var(--primary) when active, var(--surface-alt) when disabled

Thinking indicator
Three dots, staggered pulse animation, 0.2s delay between dots, 40% baseline opacity → 80% peak. Color: var(--primary).

Empty state
Centered column, bot icon in card container, headline, one-line description, 2×2 suggestion grid with card-bordered buttons.

Motion
Sidebar open/close: transition: width 300ms ease-in-out

Button hover/focus: transition-colors 150ms

Message scroll: scrollIntoView({ behavior: 'smooth' })

Thinking dots: CSS @keyframes pulse, 1.4s period

No gratuitous animation — every motion has a functional purpose

Scrollbars
Hidden at rest. Surface only on hover via ::-webkit-scrollbar-thumb opacity toggle. Width: 4px. Color: var(--border).

Accessibility
All interactive elements are <button> or <textarea> — native focus management

Send button has disabled attribute when input is empty or AI is thinking

Color is not the sole status indicator (thinking dots use both opacity + scale)

AA/AAA contrast target: var(--foreground) on var(--background) meets contrast thresholds in both modes

Focus ring: 2px glow using var(--ring) on all interactive inputs

Content Voice
AI persona name: NeuralChat

Tone: knowledgeable, direct, no filler

Error / loading copy: functional, not playful

Disclaimer: "NeuralChat can make mistakes. Verify important information." — small, centered, below composer

Do / Don't
Do	Don't
Use navy/blue sparingly — active states, primary actions only	Add a second chromatic accent color
Keep message column narrow (max 672px)	Let text span full width
Use mono for metadata (timestamps, model tags)	Use sans for timestamps
Maintain strict theme isolation (Dark or Light)	Mix dark cards inside light mode or vice versa
Use soft alpha-based borders (rgba(...))	Use hard opaque borders that clash with dark/light transitions
Cool blue-gray tones for night mode chrome	Warm brown/yellow tints in night mode
کل ریدمی روبه من بده قابل دانلدو

┌─────────────────────────────────────────────────────────┐
│                     Header bar (48px)                   │
├────────────────┬────────────────────────────────────────┤
│                │                                        │
│  Sidebar       │   Message area (scrollable)            │
│  (260px fixed) │   max-width: 672px, centered           │
│                │                                        │
│  - Logo        │   ↑ messages                           │
│  - New chat    │   ↓ newest                             │
│  - Chat list   │                                        │
│  - User        │                                        │
├────────────────┴────────────────────────────────────────┤
│              Composer bar (auto-height)                 │
└─────────────────────────────────────────────────────────┘


**Message column:** `max-width: 672px`, `mx-auto`, `px-4`. Never full-bleed.

**Sidebar:** Collapsible. 260px open, 0 hidden. Toggle persists in local state.

---

## Components

### Sidebar

- Background: `var(--background)` with `border-r` hairline using `var(--border)`
- Logo: 28×28 rounded-lg, `var(--primary)` fill
- Chat item: full-width button, 8px vertical padding, truncated title + mono timestamp
- Active item: `var(--surface-alt)` background, `var(--foreground)` text
- User block: avatar gradient from `var(--primary)` → `var(--primary-hover)`

### Message Bubbles

**User bubble:**
- Background: `var(--primary)`
- Text: `#FFFFFF` (Night) / `var(--background)` (Light)
- Align: right, `flex-row-reverse`
- Border radius: `18px 18px 4px 18px` (tail at bottom-right)

**AI bubble:**
- Background: `var(--card)`, `border: 1px solid var(--border)`
- Text: `var(--foreground)`
- Border radius: `18px 18px 18px 4px` (tail at bottom-left)

**Avatar:**
- Size: 32×32px, circular
- User: gradient `var(--primary) → var(--primary-hover)`, initial letter
- AI: `var(--card)` background, `var(--primary)` icon color

### Composer

- Container: `var(--card)` background, border `var(--border)`, `rounded-2xl`
- Focus: border transitions to `var(--ring)` glow
- Textarea: auto-grows from 24px to 180px max
- Send button: 32×32 rounded-xl, `var(--primary)` when active, `var(--surface-alt)` when disabled

### Thinking indicator

Three dots, staggered pulse animation, `0.2s` delay between dots, 40% baseline opacity → 80% peak. Color: `var(--primary)`.

### Empty state

Centered column, bot icon in card container, headline, one-line description, 2×2 suggestion grid with card-bordered buttons.

---

## Motion

- Sidebar open/close: `transition: width 300ms ease-in-out`
- Button hover/focus: `transition-colors 150ms`
- Message scroll: `scrollIntoView({ behavior: 'smooth' })`
- Thinking dots: CSS `@keyframes pulse`, 1.4s period
- No gratuitous animation — every motion has a functional purpose

---

## Scrollbars

Hidden at rest. Surface only on hover via `::-webkit-scrollbar-thumb` opacity toggle. Width: 4px. Color: `var(--border)`.

---

## Accessibility

- All interactive elements are `<button>` or `<textarea>` — native focus management
- Send button has `disabled` attribute when input is empty or AI is thinking
- Color is not the sole status indicator (thinking dots use both opacity + scale)
- AA/AAA contrast target: `var(--foreground)` on `var(--background)` meets contrast thresholds in both modes
- Focus ring: 2px glow using `var(--ring)` on all interactive inputs

---

## Content Voice

- AI persona name: **NeuralChat**
- Tone: knowledgeable, direct, no filler
- Error / loading copy: functional, not playful
- Disclaimer: "NeuralChat can make mistakes. Verify important information." — small, centered, below composer

---

## Do / Don't

| Do | Don't |
|---|---|
| Use navy/blue sparingly — active states, primary actions only | Add a second chromatic accent color |
| Keep message column narrow (max 672px) | Let text span full width |
| Use mono for metadata (timestamps, model tags) | Use sans for timestamps |
| Maintain strict theme isolation (Dark or Light) | Mix dark cards inside light mode or vice versa |
| Use soft alpha-based borders (`rgba(...)`) | Use hard opaque borders that clash with dark/light transitions |
| Cool blue-gray tones for night mode chrome | Warm brown/yellow tints in night mode |
"""

file_path = "README.md"
with open(file_path, "w", encoding="utf-8") as f:
    f.write(readme_content)

print(f"File created successfully: {file_path}")

Your Markdown file is ready

MD icon
README
 MD 
فایل کامل README.md شامل تمام دستورالعمل‌ها، ساختار کامپوننت‌ها، تایپوگرافی، فاصله‌گذاری و پالت‌های رنگی به‌روزشده (Dark Mode با ته‌رنگ آبی/سورمه‌ای و Light Mode بر پایه Warm Cream و Navy) آماده دانلود است.




Gemini isn't human. It can make mistakes, so double-check it.

Requesting Readme Download
# NeuralChat — Design Guidelines

A focused AI chat platform. Editorial stance: cool-tinted dark and warm-cream light palettes anchored by a single navy/blue accent. Every decision reduces friction between the user and the conversation.

---

## Aesthetic Stance

**Direction:** Precision editorial — crisp, cool slate-tinted dark ground (or warm-cream light ground), minimal chrome  
**Reference points:** Linear, Raycast, Arc Browser  
**Principle:** The interface disappears; the conversation stays.

---

## Color Tokens

### Night Mode (Default)

| Token | Hex / Value | Usage |
|---|---|---|
| `--background` | `#0E0F18` | Near-black with a blue cast |
| `--card` (Surface) | `#171825` | Message bubbles, elevated cards, panels |
| `--surface-alt` | `#1E202E` | Tab switcher tray, subtle structural fills |
| `--primary` | `#6A8FFF` | Lightened navy — legible on dark (CTA, active states, user bubble) |
| `--primary-hover` | `#839BFF` | Button hover state |
| `--foreground` | `#E8E8F0` | Body text — cool white |
| `--muted-foreground` | `#6B6B80` | Placeholders, timestamps, captions |
| `--border` | `rgba(106, 143, 255, 0.15)` | Soft blue-tinted hairline dividers |
| `--ring` | `rgba(106, 143, 255, 0.20)` | Input focus glow |

### Light Mode

| Token | Hex / Value | Usage |
|---|---|---|
| `--background` | `#F5F3EE` | Warm cream page ground |
| `--card` (Surface) | `#FFFFFF` | Form card, inputs, elevated panels |
| `--surface-alt` | `#ECE9E2` | Tab switcher tray, secondary fills |
| `--primary` | `#1B2F6E` | Deep navy — buttons, links, active accents |
| `--primary-hover` | `#2A4199` | Button hover state |
| `--foreground` | `#1A1A2E` | Body text, labels — deep midnight |
| `--muted-foreground` | `#8A8898` | Placeholders, captions, timestamps |
| `--border` | `rgba(27, 47, 110, 0.14)` | Input edges, card hairline |
| `--ring` | `rgba(27, 47, 110, 0.10)` | Input focus glow |

**Ground rule:** Blue / Navy is the *only* chromatic accent family. Do not introduce secondary accent colors like amber, green, or violet.

---

## Typography

| Role | Family | Weight(s) | Notes |
|---|---|---|---|
| UI / Body | Instrument Sans | 400, 500, 600, 700 | All interface copy |
| Mono / Data | JetBrains Mono | 400, 500 | Timestamps, model tags, code |

**Scale:**

| Token | Size | Weight | Use |
|---|---|---|---|
| Page title | 24px | 700 | Empty state headline |
| Section label | 10px | 400 | Sidebar groupings (mono) |
| Body | 14px | 400 | Message text |
| Small | 11–12px | 400 | Timestamps, captions (mono) |
| Button | 14px | 500 | Composer, CTAs |

---

## Spacing Scale

Multiples of 4px. Use sparingly — generous whitespace reads as quality.

| Step | Value | Common use |
|---|---|---|
| 1 | 4px | Icon gap |
| 2 | 8px | Tight padding |
| 3 | 12px | Element padding |
| 4 | 16px | Section padding |
| 5 | 20px | Card padding |
| 6 | 24px | Section gap |
| 8 | 32px | Large spacing |
| 12 | 48px | Page-level vertical gap |

---

## Border Radius

| Token | Value | Component |
|---|---|---|
| `--radius` | 10px | Cards, sidebar items |
| `sm` | 8px | Chips, tags |
| `lg` | 14px | Composer, big cards |
| Message bubble (user) | `18px 18px 4px 18px` | Asymmetric tail |
| Message bubble (AI) | `18px 18px 18px 4px` | Asymmetric tail |

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│                     Header bar (48px)                   │
├────────────────┬────────────────────────────────────────┤
│                │                                        │
│  Sidebar       │   Message area (scrollable)            │
│  (260px fixed) │   max-width: 672px, centered           │
│                │                                        │
│  - Logo        │   ↑ messages                           │
│  - New chat    │   ↓ newest                             │
│  - Chat list   │                                        │
│  - User        │                                        │
├────────────────┴────────────────────────────────────────┤
│              Composer bar (auto-height)                 │
└─────────────────────────────────────────────────────────┘
```

**Message column:** `max-width: 672px`, `mx-auto`, `px-4`. Never full-bleed.

**Sidebar:** Collapsible. 260px open, 0 hidden. Toggle persists in local state.

---

## Components

### Sidebar

- Background: `var(--background)` with `border-r` hairline using `var(--border)`
- Logo: 28×28 rounded-lg, `var(--primary)` fill
- Chat item: full-width button, 8px vertical padding, truncated title + mono timestamp
- Active item: `var(--surface-alt)` background, `var(--foreground)` text
- User block: avatar gradient from `var(--primary)` → `var(--primary-hover)`

### Message Bubbles

**User bubble:**
- Background: `var(--primary)`
- Text: `#FFFFFF` (Night) / `var(--background)` (Light)
- Align: right, `flex-row-reverse`
- Border radius: `18px 18px 4px 18px` (tail at bottom-right)

**AI bubble:**
- Background: `var(--card)`, `border: 1px solid var(--border)`
- Text: `var(--foreground)`
- Border radius: `18px 18px 18px 4px` (tail at bottom-left)

**Avatar:**
- Size: 32×32px, circular
- User: gradient `var(--primary) → var(--primary-hover)`, initial letter
- AI: `var(--card)` background, `var(--primary)` icon color

### Composer

- Container: `var(--card)` background, border `var(--border)`, `rounded-2xl`
- Focus: border transitions to `var(--ring)` glow
- Textarea: auto-grows from 24px to 180px max
- Send button: 32×32 rounded-xl, `var(--primary)` when active, `var(--surface-alt)` when disabled

### Thinking indicator

Three dots, staggered pulse animation, `0.2s` delay between dots, 40% baseline opacity → 80% peak. Color: `var(--primary)`.

### Empty state

Centered column, bot icon in card container, headline, one-line description, 2×2 suggestion grid with card-bordered buttons.

---

## Motion

- Sidebar open/close: `transition: width 300ms ease-in-out`
- Button hover/focus: `transition-colors 150ms`
- Message scroll: `scrollIntoView({ behavior: 'smooth' })`
- Thinking dots: CSS `@keyframes pulse`, 1.4s period
- No gratuitous animation — every motion has a functional purpose

---

## Scrollbars

Hidden at rest. Surface only on hover via `::-webkit-scrollbar-thumb` opacity toggle. Width: 4px. Color: `var(--border)`.

---

## Accessibility

- All interactive elements are `<button>` or `<textarea>` — native focus management
- Send button has `disabled` attribute when input is empty or AI is thinking
- Color is not the sole status indicator (thinking dots use both opacity + scale)
- AA/AAA contrast target: `var(--foreground)` on `var(--background)` meets contrast thresholds in both modes
- Focus ring: 2px glow using `var(--ring)` on all interactive inputs

---

## Content Voice

- AI persona name: **NeuralChat**
- Tone: knowledgeable, direct, no filler
- Error / loading copy: functional, not playful
- Disclaimer: "NeuralChat can make mistakes. Verify important information." — small, centered, below composer

---

## Do / Don't

| Do | Don't |
|---|---|
| Use navy/blue sparingly — active states, primary actions only | Add a second chromatic accent color |
| Keep message column narrow (max 672px) | Let text span full width |
| Use mono for metadata (timestamps, model tags) | Use sans for timestamps |
| Maintain strict theme isolation (Dark or Light) | Mix dark cards inside light mode or vice versa |
| Use soft alpha-based borders (`rgba(...)`) | Use hard opaque borders that clash with dark/light transitions |
| Cool blue-gray tones for night mode chrome | Warm brown/yellow tints in night mode |
README.md
Displaying README.md.