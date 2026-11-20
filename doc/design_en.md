# Design System

Momo's visual reference. The live version is at [`/en/design`](https://momo.motues.top/en/design); this document is the written form of the same rules, for changing styles, adding components, and writing docs.

> The job is not a facelift. It fixes the choices already made: one blue, one radius scale, one easing curve. Start new work from these tokens, then write the styles; when a real exception is needed, explain it next to the component.

## 1. Principles

1. **Minimal first**: black, white, and grey carry structure. Blue only marks "clickable / selected / emphasized". No second brand color.
2. **Source Serif body**: `Noto Serif SC` (Source Serif) is the default for body and headings; short UI labels use WenKai (`LXGW Bright`); `EB Garamond` for the wordmark and footer; `JetBrains Mono` for code and numerals.
3. **Hierarchy through surfaces and borders**: cards use surface + 1px border + one shadow step, not heavy shadows or large color fills.
4. **Restrained motion**: three durations, three curves. Movement settles without overshoot or with a slight overshoot; text only changes color.
5. **Light and dark parity**: every color token has a dark value; no component hardcodes a light-only color.
6. **Maintainable**: token → base rule → shared component → page-private, four layers with one job each.

## 2. Color

Four groups: surfaces, text, borders & brand, semantic. The live palette is at `/en/design#color`.

### 2.1 Surfaces

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--bg-color` | `#fbfbfb` | `#0a0a0a` | Page background (`body`) |
| `--surface-color` | `#ffffff` | `#141414` | Cards, panels, fields |
| `--surface-color-hover` | `#eeeeee` | `#262626` | Table-row / card hover fill, category chips |
| `--code-bg-color` | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.14)` | Inline-code fill (one step darker than hover, so the two never blend) |
| `--button-hover-color` | alias of `--surface-color-hover` | same | Legacy name; prefer `--surface-color-hover` in new code |

### 2.2 Text

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--text-color` | `#000000` | `#ffffff` | Headings, body |
| `--text-color-70` | `#4c4c4c` | `#b5b5b5` | Secondary text, meta, captions |
| `--text-color-30` | `#7a7a7a` | `#8a8a8a` | Placeholder, disabled, faint icons |

### 2.3 Borders & brand

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--border-color` | `#d6d6d6` | `#3d3d3d` | Dividers, card borders |
| `--border-color-strong` | `#b5b5b5` | `#5a5a5a` | Hover / emphasis borders |
| `--quote-left-color` | `#dadde1` | `#606770` | 4px left rule on prose blockquotes |
| `--link-color` | `#10558c` | `#57ace7` | **Text / stroke**: links, icons, hover |
| `--accent-bg` | `#10558c` | `#0d5a94` | **Fill**: primary buttons, selected chips |
| `--accent-fg` | `#ffffff` | `#ffffff` | Text on `--accent-bg` |
| `--accent-soft` | `rgba(16,85,140,.08)` | `rgba(87,172,231,.12)` | Selected fill, glow, icon background |
| `--accent-ring` | `rgba(16,85,140,.3)` | `rgba(87,172,231,.35)` | Keyboard focus ring |

> ⚠️ `--link-color` is for text and strokes only. To use blue as a fill, use `--accent-bg` + `--accent-fg`. In dark mode "bright blue text" and "deep blue fill" are two different values; mixing them leaves white text at 2.48:1.

### 2.4 Semantic

Four semantic families, each with a main color + soft surface (plus a title color). Callouts reference the same tokens, so a color change happens in one place.

| Meaning | Main | Surface | Callout |
| --- | --- | --- | --- |
| Success | `--success-color` | `--success-bg-color` | `tip` |
| Error | `--error-color` | `--error-bg-color` | `caution` |
| Warning | `--warning-color` | `--warning-bg-color` | `warning` |
| Info | `--info-color` | `--info-bg-color` | `important` |

- The `note` callout stays neutral grey and does not use a semantic family.
- Title color comes from the matching `--*-text-color`.
- Human verification has its own `--verify-success-*` / `--verify-error-*`; do not reuse the semantic tokens there.

Selection and scrollbars: `--selection-bg-color` / `--selection-text-color`, `--scrollbar-thumb` / `--scrollbar-thumb-hover` / `--scrollbar-track`.

## 3. Typography

### 3.1 Stacks

| Token | Value | Usage |
| --- | --- | --- |
| `--momo-font-serif` | `"Noto Serif SC", "Source Han Serif SC", … , serif` | Body and headings (default) |
| `--momo-font-display` | `"EB Garamond", "Noto Serif SC", serif` | Wordmark, footer |
| `--momo-font-sans` | `"LXGW Bright Medium", … , sans-serif` (WenKai) | A few short UI labels (optional) |
| `--momo-font-mono` | `"JetBrains Mono Variable", ...` | Code, numerals, token names |

Noto Serif SC is self-hosted via `@fontsource/noto-serif-sc` (400 / 700, non-blocking). Blockquotes and short UI labels use `LXGW Bright Medium` (WenKai Bright), loaded only on pages that render prose.

### 3.2 Type scale

| Token | Value | Typical usage |
| --- | --- | --- |
| `--momo-font-size-2xs` | 11px | Badges, token names |
| `--momo-font-size-xs` | 12px | Fine print, meta |
| `--momo-font-size-sm` | 13px | Captions |
| `--momo-font-size-md` | 14px | UI body, secondary paragraphs |
| `--momo-font-size-base` | 16px | Article body |
| `--momo-font-size-lg` | 18px | Card title, subsection, prose h5 |
| `--momo-font-size-xl` | 20px | Large card title |
| `--momo-font-size-2xl` | 24px | Section heading, prose h3 |
| `--momo-font-size-3xl` | 28px | Prose h2 |
| `--momo-font-size-4xl` | 32px | Article h1, prose h1 |
| `--momo-font-size-display` | `clamp(2.25rem, 5vw, 3.5rem)` | Design page hero (36–56px) |

> Tailwind `text-sm` / `text-lg` remain 14 / 18px and line up with this scale. Prefer tokens in custom CSS so 15px / 17px one-offs do not creep in.

> Inside prose headings (`.markdown-content h1`–`h6`), h1 / h3 / h4 / h6 reuse 4xl / 2xl / xl / base from the scale above; h2 takes 3xl (28px) and h5 takes lg (18px) directly — there are **no dedicated heading tokens**. `--momo-font-size-display` is itself a clamp and serves the design page hero only.

### 3.3 Weights and line heights

- Weights: `--momo-font-weight-regular` 400 / `medium` 500 / `semibold` 600 / `bold` 700.
- Line heights: `--momo-leading-tight` 1.25 (headings) / `normal` 1.5 (UI) / `relaxed` 1.75 (long copy).

`.markdown-content` is fixed at `line-height: 1.75`; card titles use 600; page titles use 700.

## 4. Spacing

A 4px base with ten steps:

| Token | Value | | Token | Value |
| --- | --- | --- | --- | --- |
| `--momo-space-1` | 4px | | `--momo-space-6` | 24px |
| `--momo-space-2` | 8px | | `--momo-space-7` | 32px |
| `--momo-space-3` | 12px | | `--momo-space-8` | 40px |
| `--momo-space-4` | 16px | | `--momo-space-9` | 52px |
| `--momo-space-5` | 20px | | `--momo-space-10` | 64px |

Tailwind `p-4` / `gap-6` share the same base (1 unit = 4px) and can be mixed in. Do not write `padding: 13px`.

## 5. Radius

| Token | Value | Usage |
| --- | --- | --- |
| `--momo-radius-xs` | 4px | Inline code, badges (`.momo-tag`) |
| `--momo-radius-sm` | 6px | Category chips (`.momo-chip`), callouts, tooltips, footnote highlight |
| `--momo-radius-md` | 8px | Buttons (including `--sm`), fields, code blocks, pagination, list rows (`.momo-row`) |
| `--momo-radius-lg` | 12px | Cards, TOC panel, dropdown menus |
| `--momo-radius-xl` | 16px | Modals, drawers, large containers |
| `--momo-radius-pill` | 999px | Pills, avatars, GitHub card language / license marks |

One radius per class of element. Cards no longer mix `rounded` / `rounded-xl` / `rounded-2xl`; buttons no longer mix `rounded-md` and `rounded-full`. The one exception is the comment area: `CommentItem` / `Comments` keep the original 4px radius (`.rounded`) instead of `md`, so the comment UI stays identical to the previous release.

## 6. Shadow

| Token | Usage |
| --- | --- |
| `--momo-shadow-xs` | Static cards, TOC box |
| `--momo-shadow-sm` | Article card default |
| `--momo-shadow-md` | Hover lift, dropdown |
| `--momo-shadow-lg` | Drawer, large layer, music / GitHub card hover |
| `--momo-shadow-xl` | Lightbox, full-screen layer |

Shadow color always comes from `--shadow-color` (black 15% in light, black 55% in dark). **Never use a white shadow in dark mode** — that is a glow, not elevation.

## 7. Motion

### 7.1 Durations

| Token | Value | Usage |
| --- | --- | --- |
| `--momo-t-fast` | 140ms | Color, hover, focus |
| `--momo-t-base` | 220ms | Movement, cards, dropdown, enter |
| `--momo-t-slow` | 360ms | Long transitions, list stagger |
| `--momo-t-press` | 90ms | Press feedback (`:active` only) |
| `--momo-t-reveal` | 800ms | Entrance: card pop / prose rise |

### 7.2 Curves

| Token | Curve | Usage |
| --- | --- | --- |
| `--momo-ease-out` | `cubic-bezier(.22,1,.36,1)` | Default settle, no overshoot |
| `--momo-ease-pop` | `cubic-bezier(.34,1.56,.64,1)` | Objects with volume: pills, buttons, dialogs |
| `--momo-ease-sheet` | `cubic-bezier(.32,.72,0,1)` | Drawers / panels: fast in, slow out |

Lift distances (hover): `--momo-lift` -1px, `--momo-lift-card` -2px, `--momo-lift-emoji` -4px.

Entry travel (first appearance): cards `--momo-rise-card` 32px (with a 0.96 scale, curve `--momo-ease-pop`), prose blocks `--momo-rise-prose` 120px (curve `--momo-ease-out`, no bounce), duration always `--momo-t-reveal` (800ms).

Rules:

- Entrance animation is built in (`src/utils/reveal.ts` + `src/styles/global.css`), with no third-party dependency: HTML declares `data-reveal="pop" | "rise"` and the script only adds `.is-revealed` at the right time; prose children are hidden structurally by CSS and revealed one by one — **do not hand-write `data-reveal` inside prose** (it would flash visible before hiding).
- After a swup page change, reveal must wait until `html.is-changing` / `is-animating` is gone: before that `scrollTo(0)` has not run and the page is still fading in, so the animation would play where nobody sees it.
- Text changes color only, never bounces.
- Elements with `backdrop-filter` must not animate via an ancestor's `opacity` (the blur drops for the whole frame); animate the element itself.
- Under `prefers-reduced-motion: reduce`, movement and looping animations stop; color changes remain.

## 8. Layout and breakpoints

| Token | Value | Usage |
| --- | --- | --- |
| `--header-width` | `min(1024px, 90vw)` | Header, footer |
| `--page-width` | `min(776px, 90vw)` | Prose column, cards |
| `--toc-offset-left` / `--toc-width` | derived from page width | Desktop TOC |
| `--category-width` | `min((100vw - page) / 3, 200px)` | Archive category rail |

Breakpoints:

| Width | Meaning |
| --- | --- |
| 640px | Tailwind `sm`: small phone, grids collapse to one column |
| 776px | Site mobile boundary: header glass, TOC, FAB, image collage, design page single-column switch |
| 1024px | Tailwind `lg`: desktop two-column (design page rail collapses to one column at ≤1024px) |

> Media queries are always written as `max-width: <breakpoint>` (with the equals sign). The whole site only ever uses 640 / 776 / 1024 — no 767 / 775 / 900 forks.

> The main column is `min(var(--page-width), 90vw)`. Do not write `min(70vw, …)` — the tablet range ends up with large empty gutters.

## 9. Layers

| Token | Value | Used by |
| --- | --- | --- |
| `--momo-z-header` | 50 | Header |
| `--momo-z-sticky` | 100 | Sticky nav |
| `--momo-z-fab` | 1000 | FabMenu, mobile TOC |
| `--momo-z-drawer` | 1100 | Mobile drawer |
| `--momo-z-modal` | 1200 | Search modal |
| `--momo-z-lightbox` | 2000 | Image lightbox |
| `--momo-z-loading` | 9999 | Page transition overlay |

OverlayScrollbars uses `z-index: 99999` and sits above every overlay. That is third-party behavior, documented under "page scrollbar".

## 10. Components

Shared classes live in [`src/styles/components.css`](../src/styles/components.css). They define shape and interaction only; colors come from tokens.

### 10.1 Buttons

| Class | Meaning |
| --- | --- |
| `.momo-btn` | Default outlined button (secondary) |
| `.momo-btn--primary` | Primary action: blue fill, white text, once per page |
| `.momo-btn--ghost` | Ghost: no border, soft fill on hover |
| `.momo-btn--sm` / `--lg` | 28px / 44px tall |
| `.momo-btn--icon` | 40×40 icon-only; requires `aria-label` |
| `[disabled]` | 45% opacity, not clickable |

Heights: sm 28 / default 36 / lg 44. Touch primary actions and fields should reach 44px. Small buttons are only shorter and narrower; their radius matches every other button (`--momo-radius-md`), with `--momo-space-2` left / right padding.

### 10.2 Cards

- `.momo-card`: surface + 1px border + `--momo-radius-lg` + `--momo-shadow-sm`.
- `.momo-card--plain`: no surface; border and shadow only (article cards).
- `.momo-card--interactive`: lifts `--momo-lift-card` on hover, shadow to `--momo-shadow-md`, border to `--border-color-strong`.
- `.momo-row`: a list row, not a card (archive, search results): 8px radius + hover fill.

### 10.3 Tags

- `.momo-chip`: clickable category / filter label (6px radius, **not** a pill); when selected via `aria-current="true"` or `.is-active`, it becomes blue with white text.
- `.momo-tag`: read-only badge (category name, locale mark), soft fill + border + 12px text, 4px radius.

### 10.4 Forms

- `.momo-field`: input / textarea, surface fill, 1px border, 8px radius.
- Hover deepens the border; focus only turns the border blue, **no glow**.
- Disabled uses `--surface-color-hover` fill and `--text-color-30` text.

### 10.5 Panels and menus

- `.momo-panel`: dialogs and drawers, 16px radius + `--momo-shadow-lg`.
- `.momo-menu`: dropdown, 12px radius + `--momo-shadow-md`.

### 10.6 Callouts

Markdown `:::note` / `:::tip` / `:::important` / `:::warning` / `:::caution` produce:

- Structure: `<div class="note"><span class="admonition-title">NOTE</span><p>…</p></div>`.
- Semantic color applies to the left rule, title color, and icon; the background is the soft semantic surface.
- Colors come from the four semantic token families: tip→`--success-*`, important→`--info-*`, warning→`--warning-*`, caution→`--error-*`; note stays neutral grey.
- Title size is `--momo-font-size-lg`; the icon is an 18×18 data-URI SVG.
- ⚠️ **Icon colors are hard-coded in the data URI and do not follow tokens** (the four-color callout icons, the GitHub card's logo / star / fork, and the music card icon alike). After changing a semantic color, sync the hex values inside the data URI by hand, or convert it to `mask-image` + `background-color: currentColor`.
- The draft / language fallback banner on article pages is a **page-level status bar**, not a prose callout: it uses `--momo-radius-md` (8px), one step above the callout's 6px, as a deliberate exception.

### 10.7 Tooltip

- `.momo-tooltip` + `data-tooltip="text"`: shows on hover / keyboard focus, `pointer-events: none`, never blocks the pointer.
- Footer icons still use the `title` attribute plus a custom `::after` (legacy); colors and radius are tokenized.

### 10.8 Custom syntax

Cards and inline syntax produced by the Markdown plugins; all styles live in `markdown.css`:

| Syntax | Output | Notes |
| --- | --- | --- |
| `::github{repo="owner/repo"}` | `.card-github` | Repo card; repo info is fetched by the card script |
| `::music{id="songId"}` | `.card-music` | NetEase music card |
| `::quote[content]` | `.quote` | Centered quote |
| `{base}(reading)` | `<ruby>` | Ruby annotation |
| `!!content!!` | `.spoiler` | Collapsed (hover or click to reveal) |
| `==content==` | `.rainbow-text` | Rainbow text |
| `++content++` | `.underline-text` | Underline |

The `/design#custom` page renders the real `::github` / `::music` directives (`src/content/spec/design/{github,music}/`); card data is fetched live by script, exactly as in articles.

> The GitHub / music card graphics (logo, star, fork, NetEase icon) are likewise embedded-color data URIs that do not follow tokens; hover only transitions the border and shadow (`--momo-t-fast` / `--momo-t-base`), never `all`.

### 10.9 Focus

The global `:where(a, button, input, textarea, select, summary):focus-visible` rule draws a 2px blue outline with 2px offset. Components may turn this into a border-color change (`.momo-field:focus` only swaps `border-color`, no glow), but **must never remove the focus feedback**.

## 11. Page structure

- Header: logo (EB Garamond) + desktop nav pill + search / theme / language. It survives client-side navigation; state is recomputed by `syncPersistedHeader()` in `Header.astro`.
- Body: inside `#swup-container` and `.transition-swup-fade`; fixed overlays (TOC / FabMenu) use the `overlay` slot so they never become fixed-containing blocks.
- Footer: same width as header, EB Garamond, muted text; contains RSS and the design system link.
- Article: Cover title 30px, body 16px / 1.75, 776px column.

## 12. Dark mode

- The switch is `<html data-theme="light|dark">`, written before first paint by the init script in `Layout.astro`.
- Every color token is overridden in `[data-theme="dark"]`; scale tokens stay unchanged.
- In dark mode link text is bright blue, blue fills darken to `#0d5a94`, and shadows switch to black.
- Components must not add their own `@media (prefers-color-scheme: dark)` fallback (CMS preview excepted), or manual theme switching breaks.

## 13. Accessibility

- Keyboard focus is always visible; icon-only buttons need `aria-label` / `title`.
- Prose links use `color: inherit` (so quotes, rainbow text, and callout titles are not overridden) with a persistent underline.
- Contrast: light link `#10558c` on `#fbfbfb` is 7.52:1; dark `#57ace7` on `#0a0a0a` is 7.98:1; white on blue is 7.78:1 (light) and 7.22:1 (dark).
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`.
- With JavaScript disabled: the header keeps its full pill, prose stays visible, and the photo layer falls back to a faint background.

## 14. Where styles live

Decide the layer first when adding styles:

| Layer | Location | Typical content |
| --- | --- | --- |
| Token | `src/styles/variables.css` | Color, type, space, radius, shadow, motion, layers |
| Base | `src/styles/global.css` | `body`, selection, press feedback, reduced motion |
| Component | `src/styles/components.css` | Card, button, chip, field, panel |
| Feature | page / component `<style>` | `.ds-*`, photo cover, lightbox |

Maintenance flow:

1. Change a token → `/design` syncs automatically (it reads `variables.css` with `?raw`).
2. Change prose styles → mirror [`cms/server/prose.css`](../cms/server/prose.css): structural values (inline code 4, code blocks / images / collage 8, callouts 6, cards 12) and the palette both follow the site (the preview reads `--text` / `--link` / `--bg` etc. straight from `variables.css`).
3. Before touching the header / scrollbar / photo cover, read the matching "pitfalls" section in `AGENTS.md`.
4. New component → first try composing existing `.momo-*` classes; add a new class only when necessary, and explain why next to it.
5. Verify: `pnpm build`, then check light / dark / 390px / 1440px.

## 15. File map

| File | Responsibility |
| --- | --- |
| `src/styles/variables.css` | All tokens (including dark overrides) |
| `src/styles/components.css` | Shared component classes |
| `src/styles/global.css` | Base rules, press, entrance animation, reduced motion |
| `src/styles/markdown.css` | Prose typography (mirrored in CMS preview) |
| `src/styles/design.css` | Styles for the `/design` page only |
| `src/components/design/DesignSpec.astro` | Design page structure and zh / en copy |
| `src/pages/[...locale]/design.astro` | Single entry point (`/design` and `/en/design` come from the locale route) |
| `src/content/spec/design/*.md` | Real Markdown samples rendered on the page (`github/` / `music/` hold the card demos) |
| `doc/design_zh-cn.md` / `doc/design_en.md` | This document |

## 16. Checklist

- [ ] Colors come from tokens; no new hex values (semantic colors / syntax highlighting excepted)
- [ ] Radius only from 4 / 6 / 8 / 12 / 16 / 999
- [ ] Type sizes come from the scale; prose h2 takes 3xl (28px) and h5 takes lg (18px), no literals
- [ ] Motion uses `--momo-t-*` and `--momo-ease-*` (the 2s footnote highlight is the only remaining literal, noted in the code)
- [ ] Media queries only use the 640 / 776 / 1024 steps, written as `max-width`
- [ ] Dark mode was actually checked, not just the light version
- [ ] No horizontal scroll at 390px
- [ ] Keyboard Tab shows a visible focus ring
- [ ] Nothing jitters under `prefers-reduced-motion`
- [ ] Prose changes are mirrored in CMS `prose.css`
