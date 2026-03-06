# Pixel Agent Desk — UI/UX Design Improvement Plan

> **Date:** 2026-03-06
> **Target Files:** `dashboard.html`, `index.html`, `styles.css`, `src/office/*`, `src/renderer/*`
> **Aesthetic Direction:** **Retro-Futuristic Terminal** — A premium dark UI that preserves the identity of pixel art characters while infusing the sensibility of CRT monitors + cyberpunk terminals

---

## 0. Current Diagnosis Summary

### What Works Well
- Status color system is consistent across 3 views (avatar/dashboard/office)
- Pulse, shake, and fade animation quality is high
- Accessibility foundations are well established (keyboard navigation, ARIA labels, etc.)
- CSS variable-based token system is in place

### Areas for Improvement

| Area | Current State | Issue |
|------|----------|--------|
| **Typography** | System fonts (`-apple-system, Segoe UI…`) | No personality. A pixel art app with zero retro feel in typography |
| **Color Depth** | Flat dark (`#0f172a` → `#1e293b`) | Monotonous 2-tone composition. No gradients, textures, or light effects |
| **Dashboard Layout** | Fixed 280px sidebar + 1fr grid | Generic admin panel feel. No app identity |
| **Card Components** | Basic border + hover effects only | Visual distinction per state is just a single 3px top line. Low information density |
| **Header** | Title + connection status dot | No branding. No logo. No functional buttons |
| **Sidebar Navigation** | Text + emoji icons | Emojis break visual consistency. No icon system |
| **Empty State** | Large emoji + text | Generic design unrelated to app identity |
| **Motion** | Individual animations are good but no orchestration | No choreography for page entry, tab switching, or data loading |
| **Avatar Renderer** | Transparent background + speech bubble | Lack of visual context (ground plane, depth) |

---

## 1. Typography Overhaul

### Current
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```
→ Completely generic. Cannot convey the identity of a pixel art app.

### Improvement Plan

**Display (titles/numbers):** `"Press Start 2P"` or `"Silkscreen"` (Google Fonts)
- Bitmap-style display font with 8bit/pixel art sensibility
- Applied to dashboard header title, stat-value numbers, and empty state titles

**Body (body text):** `"JetBrains Mono"` (Google Fonts)
- Monospace yet highly readable. Fits the terminal aesthetic + coding tool context
- Applied to sidebar, card body text, labels, and feed text

**UI (buttons/badges):** Keep `"Pretendard Variable"`
- Retain existing choice for areas where Korean readability is top priority
- Navigation labels, button text, Korean UI strings

**Implementation priority:** Add `@import` + define CSS variables `--font-display`, `--font-body`, `--font-ui`

```css
:root {
  --font-display: 'Press Start 2P', 'Silkscreen', monospace;
  --font-body: 'JetBrains Mono', 'Fira Code', monospace;
  --font-ui: 'Pretendard Variable', -apple-system, sans-serif;
}
```

### Application Points
| Location | Current | Change |
|------|------|------|
| Dashboard `header-title` | `1.25rem, 600` | `--font-display`, `0.9rem`, 800 (bitmap fonts render crisply at smaller sizes) |
| `stat-value` | `2rem, 700` | `--font-display`, `1.5rem` |
| `.agent-name` (dashboard) | System font | `--font-body` |
| `.live-feed-item` | System font | `--font-body`, `0.75rem` |
| All `monospace` declarations | `Consolas, Courier New` | `--font-body` |

---

## 2. Color & Theme Deep Dive

### Current Issues
- Composed of only 3 slate levels: `#0f172a` → `#1e293b` → `#334155`
- Weak contrast between cards and background results in poor hierarchy
- Status colors are good but lack "light" (no glow or gradient usage)

### Improvement Plan: CRT Terminal Theme

```css
:root {
  /* ── Background Layers ── */
  --color-bg-deep: #080c16;        /* Deepest background (newly added) */
  --color-bg: #0d1117;             /* Base background (adjusted to GitHub Dark tone) */
  --color-surface: #161b22;        /* Card/panel (replaces existing --color-card) */
  --color-surface-raised: #1c2333; /* Hover/active card */
  --color-border: #30363d;         /* Border (similar to existing) */
  --color-border-active: #58a6ff;  /* Active border (newly added) */

  /* ── Text ── */
  --color-text: #e6edf3;           /* Light text (slightly bluish) */
  --color-text-muted: #7d8590;     /* Secondary text */
  --color-text-accent: #58a6ff;    /* Accent text (links, etc.) */

  /* ── Glow System (newly added) ── */
  --glow-working: 0 0 20px rgba(249, 115, 22, 0.3);
  --glow-thinking: 0 0 20px rgba(139, 92, 246, 0.3);
  --glow-done: 0 0 20px rgba(34, 197, 94, 0.3);
  --glow-error: 0 0 20px rgba(239, 68, 68, 0.3);
}
```

### Background Texture Addition
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    /* Scanline effect (CRT monitor aesthetic) */
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 2px,
      rgba(0, 0, 0, 0.03) 4px
    ),
    /* Subtle noise grain */
    url("data:image/svg+xml,...");  /* SVG noise pattern */
  pointer-events: none;
  z-index: 9999;
  opacity: 0.4;
}
```

### Card Glow Effects
```css
.agent-card.state-working {
  box-shadow: var(--glow-working);
  border-color: rgba(249, 115, 22, 0.4);
}

.agent-card.state-thinking {
  box-shadow: var(--glow-thinking);
  border-color: rgba(139, 92, 246, 0.4);
}
```

---

## 3. Dashboard Layout Redesign

### 3.1 Header Overhaul

**Current:** Text title + emoji + connection dot
**Improvement:**

```
┌──────────────────────────────────────────────────────────────┐
│  ▓▓  PIXEL AGENT DESK          [🔴 3 Active] [⚡ SSE ●]  ⚙  │
│  ▓▓  v1.0 — AI Agent Monitor    Connected · Port 47821        │
└──────────────────────────────────────────────────────────────┘
```

- Left: Pixel art logo (16x16 or 32x32 favicon style) + bitmap font title
- Center: Quick status summary chips (Active count, total tokens, etc.)
- Right: Connection status (SSE icon + text) + settings gear
- Height: `56px` → `52px` for a more compact look

### 3.2 Sidebar Redesign

**Current Issues:**
- Emoji icons have inconsistent size and alignment
- Weak visual separation between navigation items
- Live Feed is placed monotonously at the bottom of the sidebar

**Improvement Plan:**

```
┌─────────────────────┐
│  NAVIGATION         │
│  ─────────────────  │
│  ◆ Office        ← │ ← Left accent bar when active (4px, blue)
│  ◇ Overview         │
│  ◇ Agents           │
│  ◇ Tokens           │
│  ◇ Activity         │
│                     │
│  ─────────────────  │
│  LIVE FEED          │
│  ┌─────────────┐   │
│  │ ● 14:32:01  │   │ ← Status color left dot + monospace time
│  │   Agent-0    │   │
│  │   Working    │   │
│  └─────────────┘   │
│  ┌─────────────┐   │
│  │ ● 14:31:58  │   │
│  │   Agent-1    │   │
│  │   Thinking   │   │
│  └─────────────┘   │
└─────────────────────┘
```

- Replace emojis with inline SVG icons or monochrome pixel icons
- Active nav: Left `4px` vertical bar (changed from right to left)
- Subtle gradient sweep on background when hovering over nav items
- Live Feed items: Card-style + status color left dot + timestamp emphasis

### 3.3 Main Content Area

**Tab switching transition addition:**
```css
/* Current: instant display:none ↔ display:block */
/* Improvement: crossfade + slide */
.main-content, .office-view {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.view-entering {
  animation: viewEnter 0.3s ease-out;
}

@keyframes viewEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 4. Dashboard Component Improvements

### 4.1 Stat Cards (Overview Tab)

**Current:** Flat card + icon/label/number
**Improvement:**

```
┌─────────────────────────┐
│  Active Agents          │
│                         │
│  ██████ 3              │ ← Bitmap font large number + mini bar graph
│  ▲ 2 from yesterday    │ ← Change indicator (green up / red down)
│  ·························│ ← Mini sparkline at bottom (last 24 hours)
└─────────────────────────┘
```

- Apply `--font-display` to numbers (bitmap aesthetic)
- On card hover: `box-shadow: var(--glow-*)` + `border-color` transition
- Subtle diagonal hatch pattern or dot matrix pattern in background
- Icons: emoji → monochrome pixel icons (8x8 or 16x16 scale)

### 4.2 Agent Cards (Agents Tab)

**Current:** 3px top color bar + text info
**Improvement:**

```
┌──────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │ ← Top color bar (3px → 2px, sharper)
│                                      │
│  [avatar_sprite]  Agent-0            │ ← 48x64 pixel avatar preview added!
│                   Main               │
│                   ● Working          │ ← Status dot + text (badge → inline)
│                                      │
│  ─── Current Activity ─────────────  │
│  🔧 Bash: npm test                   │ ← Current tool + command (monospace)
│                                      │
│  Project   my-project                │
│  Model     claude-opus-4-6              │
│  Duration  00:12:34                  │
│                                      │
│  ─────────────────────────────────── │
│  ↗ 12.4K tokens    $0.42            │ ← Footer: tokens + cost
└──────────────────────────────────────┘
```

Key Changes:
- **Avatar Preview** — Render 48x64 character extracted from sprite sheet on the left side of the card
- **Status Glow** — Working cards get orange glow, Thinking gets violet glow
- **Current Activity Section** — Separate tool name + input into its own section, monospace emphasis
- **Card Spacing** — `16px` → `12px` (increased information density)

### 4.3 Heatmap (Activity History Tab)

**Current:** GitHub contribution graph style (blue tones)
**Improvement:**

- Change colors to **cyan-blue tones** to match the app theme:
  ```css
  .heatmap-cell.level-0 { background: #0d1117; }          /* Same as background */
  .heatmap-cell.level-1 { background: #0e4429; }          /* Dark green */
  .heatmap-cell.level-2 { background: #006d32; }          /* Medium green */
  .heatmap-cell.level-3 { background: #26a641; }          /* Bright green */
  .heatmap-cell.level-4 { background: #39d353; }          /* Maximum brightness */
  ```
  → Adopt the same green tones as GitHub, adjusting only the background color to fit the app
  → Or adopt an app-unique **orange→cyan gradient** (starting from the Working color)

- On cell hover: `scale(1.3)` + glow effect
- Add sparkline mini-chart to summary card (last 7 days trend)

### 4.4 Token Chart (Tokens Tab)

**Current:** Horizontal bar chart (gradient blue)
**Improvement:**
- Show detail tooltip on bar hover
- Subtle grid lines in bar background (10%, 25%, 50%, 75%, 100%)
- Count-up animation for numbers (on initial load)
- Display cost total prominently at the top (`--font-display`)

---

## 5. Avatar Renderer (index.html) Improvements

### 5.1 Visual Context Addition

**Current:** Only the character + speech bubble floating on a transparent background
**Improvement:**

```
          ┌─ Thinking... ─┐
          │   . . .        │
          └───────┬────────┘
                  │
              ┌───┴───┐
              │ avatar │
              │ sprite │
              └───┬───┘
          ░░░░░░░░░░░░░░░░  ← Shadow/reflection (CSS filter)
```

- Add **ground shadow** below the character (`filter: drop-shadow` or separate div)
- Shadow is a transparent→opaque gradient ellipse (simple shape to match pixel art style)

### 5.2 Speech Bubble Improvements

**Current:** White background + thin border
**Improvement:**

- Background: `rgba(255, 255, 255, 0.97)` → `rgba(255, 255, 255, 0.93)` + `backdrop-filter: blur(4px)`
- Working state speech bubble: subtle orange gradient background
  ```css
  .agent-bubble.is-working {
    background: linear-gradient(135deg,
      rgba(255, 255, 255, 0.95),
      rgba(249, 115, 22, 0.08)
    );
  }
  ```
- `fadeIn` transition for speech bubble text on state change (current: instant change)
- **Typing effect** — Type the "..." dots in Thinking state one character at a time like a typewriter

### 5.3 Agent Card (Multi Mode) Improvements

**Current:** 90px card, minimal information
**Improvement:**

- Card width: `90px` → `96px` (multiple of 8, pixel grid aligned)
- Subtle background glow on card hover (based on status color)
- Name badge: rounded pill → angular tag (to match pixel art tone)
- Timer font: Apply `--font-body` (JetBrains Mono) for number alignment
- Offline card: grayscale + no bounce (already implemented, OK)

### 5.4 Context Menu Improvements

**Current:** Dark glass + basic hover
**Improvement:**
- Replace left icons on menu items with **monochrome pixel style**
- Shortcut badge: current `rgba(255,255,255,0.08)` → `rgba(88,166,255,0.15)` with slight blue tint
- Red glow on hover for dangerous items (Close Agent)

---

## 6. Office View Improvements

### 6.1 Laptop Animation

**Current:** Instant open/close transition on state change
**Improvement:**
- 2-frame transition animation on open/close (open→half→close)
- Subtle screen glow effect on active laptop display (canvas glow)

### 6.2 Character Effects

**Current:** Walk, sit, and dance animations only
**Improvement:**
- Working state: Gear/code particle effects above the head (1-2px pixel particles)
- Thinking state: Blinking cursor inside "..." speech bubble
- Done state: Brief sparkle effect (3-4 star particles, 0.5 seconds)
- Help state: Exclamation mark (!) bouncing up and down

### 6.3 Environment Effects

- Subtle **ambient light** gradient at the top of the canvas (ceiling light simulation)
- Time-based lighting changes (real-time sync is optional, default is bright office lighting)

---

## 7. Motion Design System

### 7.1 Page Entry Orchestration

**Current:** Only individual `fadeIn 0.3s`
**Improvement:** Staggered reveal on dashboard tab entry

```
t=0ms    Header fade-in
t=50ms   Sidebar slide-in (from left)
t=100ms  Stat Card 1 pop-in
t=150ms  Stat Card 2 pop-in
t=200ms  Stat Card 3 pop-in
t=300ms  Agent Cards stagger (50ms interval each)
```

Implementation:
```css
.stat-card:nth-child(1) { animation-delay: 100ms; }
.stat-card:nth-child(2) { animation-delay: 150ms; }
.stat-card:nth-child(3) { animation-delay: 200ms; }
/* ... */

@keyframes popIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

### 7.2 Number Count-Up

Count-up from `0 → target` when stat card numbers are first displayed:
```javascript
function countUp(el, target, duration = 600) {
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    el.textContent = Math.floor(target * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
```

### 7.3 Live Feed Animation

**Current:** `slideIn` (fade from left)
**Improvement:**
- Existing items push down when a new item enters (`translateY` transition)
- 0.5 second highlight background on new item (`rgba(88,166,255,0.1)`)

### 7.4 Tab Switching

**Current:** `display: none` ↔ `display: block` (instant switch)
**Improvement:**
- Exit: `opacity 1→0` + `translateY(0→-4px)` (150ms)
- Enter: `opacity 0→1` + `translateY(4px→0)` (200ms)

---

## 8. Empty State & Error State Redesign

### 8.1 Empty State (No Agents)

**Current:**
```
🤖
No agents
Agents will appear here when you start Claude CLI
```

**Improvement:**
```
   ┌─────────────────────────┐
   │                         │
   │     (pixel art idle     │   ← Idle character animation (sitting and clicking laptop)
   │      character anim)    │
   │                         │
   │   NO AGENTS ONLINE      │   ← --font-display (bitmap)
   │                         │
   │   Start Claude CLI and  │   ← --font-ui (Pretendard)
   │   agents will appear    │
   │                         │
   │   [ View Start Guide ]  │   ← Optional action button
   └─────────────────────────┘
```

- Idle animation using character sprites
- Strengthen app identity with bitmap font titles

### 8.2 Error Toast Dark Mode Integration

**Current:** Light background (white) — clashes with dark UI
**Improvement:**
- Change base background to dark: `rgba(22, 27, 34, 0.98)`
- Severity colors: keep left bar but also apply same color circle to icon background
- Close button: `×` → pixel style `X`

---

## 9. Micro-Interaction Additions

| Interaction | Current | Improvement |
|----------|------|------|
| Card hover | `translateY(-2px)` + shadow | + status color glow + border brightness increase |
| Nav click | Instant activation | Ink ripple effect (material ripple) |
| Connection status change | Only dot color changes | Pop animation on dot (grow and shrink) + text fade |
| Agent state transition | Only speech bubble border color changes | 0.1s scale pop (1→1.05→1) + color transition |
| Terminal focus button click | Color inversion | + circular ripple effect |
| Poke (character click) | Border flash | + character jump (`translateY(-6px)` bounce) |

---

## 10. Implementation Priority & Difficulty

### Phase A: Foundation Tokens (Difficulty: Low, Impact: High) ⭐ Top Priority

| # | Task | Files | Estimated Scope |
|---|------|------|----------|
| A1 | Introduce font system (CSS variables + @import) | `dashboard.html`, `styles.css` | ~30 lines |
| A2 | Refactor color tokens (add glow, layers) | `dashboard.html`, `styles.css` | ~50 lines |
| A3 | Card glow effects (per-state box-shadow) | `dashboard.html` | ~20 lines |

### Phase B: Component Quality (Difficulty: Medium, Impact: High)

| # | Task | Files | Estimated Scope |
|---|------|------|----------|
| B1 | Replace sidebar icons (emoji → SVG/CSS) | `dashboard.html` | ~60 lines |
| B2 | Add avatar preview to agent cards | `dashboard.html` + JS | ~80 lines |
| B3 | Stat card number count-up animation | `dashboard.html` JS | ~30 lines |
| B4 | Tab switching crossfade transition | `dashboard.html` CSS+JS | ~40 lines |
| B5 | Speech bubble per-state background gradient | `styles.css` | ~20 lines |

### Phase C: Motion & Atmosphere (Difficulty: Medium, Impact: Medium)

| # | Task | Files | Estimated Scope |
|---|------|------|----------|
| C1 | Page entry staggered animation | `dashboard.html` CSS | ~40 lines |
| C2 | Empty state redesign (character idle anim) | `dashboard.html` | ~60 lines |
| C3 | CRT scanline background texture | `dashboard.html` CSS | ~15 lines |
| C4 | Error toast dark mode integration | `styles.css` | ~20 lines |
| C5 | Avatar renderer ground shadow | `styles.css` | ~10 lines |

### Phase D: Office & Polish (Difficulty: High, Impact: Medium)

| # | Task | Files | Estimated Scope |
|---|------|------|----------|
| D1 | Office character state particle effects | `office-renderer.js` | ~100 lines |
| D2 | Laptop open/close transition animation | `office-character.js` | ~40 lines |
| D3 | Heatmap cell hover glow + sparkline | `dashboard.html` | ~60 lines |
| D4 | Card width 96px alignment + timer monospace | `styles.css`, `agentCard.js` | ~15 lines |

---

## 11. Reference Moodboard

**Core Keywords:** `Pixel Art` + `Terminal` + `CRT Monitor` + `Cyberpunk Dashboard`

Inspirational references:
- **Hyper Terminal** — Visual quality of a terminal app
- **Warp.dev** — Information density of a modern terminal UI
- **GitHub Contribution Graph** — Heatmap visual language
- **Aseprite** — UI tone of a pixel art tool (dark background, bright accents)
- **Cool Retro Term** — CRT effects, scanlines, phosphor glow

---

## 12. Constraints & Caveats

1. **Performance** — CRT scanline overlay requires `pointer-events: none` + `will-change: opacity`. Must ensure GPU compositing.
2. **Font Loading** — Google Fonts `@import` can cause FOUC (Flash of Unstyled Content). Using `<link rel="preload">` is recommended.
3. **Avatar Sync** — Adding avatar previews to dashboard cards depends on the `AVATAR_FILES` array. Must stay in sync with `office-config.js` (CLAUDE.md rule).
4. **Electron CSP** — Need to add Google Fonts CDN to `Content-Security-Policy` in `index.html` (`font-src https://fonts.gstatic.com`).
5. **Prevent Conflicts with Existing Animations** — When adding new animations, follow naming conventions to avoid keyframe name collisions with existing `bubble-pulse-*`, `agent-enter`, `agent-exit`, etc. (e.g., use `ds-` prefix).
6. **Office Canvas Rendering** — Office effects must only be drawn within the `requestAnimationFrame` loop. No DOM access allowed.
