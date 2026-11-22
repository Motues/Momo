# 设计规范

Momo 的视觉说明书。站内版本在 [`/design`](https://momo.motues.top/design)；本文是同一份规范的文字版，供改样式、加组件和写文档时查阅。

> 规范的职责不是换一张脸，而是把已经做出的选择固定下来：同一个蓝、同一档圆角、同一条缓动。新页面先从 token 取值，再写样式；确实需要例外时，在组件旁边写清楚原因。

## 1. 设计原则

1. **极简优先**：黑白灰承担结构，蓝色只负责「可点 / 选中 / 强调」，全站不引入第二种品牌色。
2. **正文用思源宋体**：`Noto Serif SC`（思源宋体）是正文与标题的主字体，界面短文案用霞鹜文楷（`LXGW Bright`）；站名与页脚用 `EB Garamond`，代码与数字用 `JetBrains Mono`。
3. **层级靠表面与描边**：卡片用「表面色 + 1px 描边 + 一档阴影」，不靠重投影和大面积色块。
4. **动效克制**：三档时长、三条曲线；位移不过冲或只轻微过冲，文字只变颜色。
5. **深浅一致**：所有颜色 token 都有深色对应值；组件不写死只适合浅色的颜色。
6. **可维护**：token → 基础规则 → 公共组件 → 页面私有，四层各司其职。

## 2. 色彩

颜色分四组：表面、文字、描边与品牌色、语义色。完整色板与实时色块见 `/design#color`。

### 2.1 表面

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--bg-color` | `#fbfbfb` | `#0a0a0a` | 页面底色（`body`） |
| `--surface-color` | `#ffffff` | `#141414` | 卡片、面板、输入框 |
| `--surface-color-hover` | `#eeeeee` | `#262626` | 表格行 / 卡片悬停底色、分类 chip |
| `--code-bg-color` | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.14)` | 行内代码底色（比悬停色深一档，两者不会糊在一起） |
| `--button-hover-color` | 同 `--surface-color-hover` | 同左 | 历史别名，新代码优先用 `--surface-color-hover` |

### 2.2 文字

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--text-color` | `#000000` | `#ffffff` | 标题、正文 |
| `--text-color-70` | `#4c4c4c` | `#b5b5b5` | 次要文字、元信息、说明 |
| `--text-color-30` | `#6e6e6e` | `#8a8a8a` | 占位符、禁用、图标弱化 |

### 2.3 描边与品牌色

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--border-color` | `#d6d6d6` | `#3d3d3d` | 分隔线、卡片描边 |
| `--border-color-strong` | `#b5b5b5` | `#5a5a5a` | 悬停 / 强调描边 |
| `--quote-left-color` | `#dadde1` | `#606770` | 正文引用块左侧 4px 描边 |
| `--link-color` | `#10558c` | `#57ace7` | **文字 / 描边**：链接、图标、悬停 |
| `--accent-bg` | `#10558c` | `#0d5a94` | **底色**：主按钮、选中的分类 chip |
| `--accent-fg` | `#ffffff` | `#ffffff` | 压在 `--accent-bg` 上的文字 |
| `--accent-soft` | `rgba(16,85,140,.08)` | `rgba(87,172,231,.12)` | 选中底、光晕、图标底 |
| `--accent-ring` | `rgba(16,85,140,.3)` | `rgba(87,172,231,.35)` | 键盘焦点环 |

> ⚠️ `--link-color` 只管文字和描边。拿蓝色当底色时必须用 `--accent-bg` + `--accent-fg`。深色模式下「亮蓝文字」和「深蓝底」是两个值，混用会导致白字对比度只有 2.48:1。

### 2.4 语义色

语义色保留四组，每组 = 主色 + 底色（另配标题文字色），正文提示块直接引用同一批 token，改色只改一处。

| 语义 | 主色 | 底色 | 对应提示块 |
| --- | --- | --- | --- |
| 成功 | `--success-color` | `--success-bg-color` | `tip` |
| 错误 | `--error-color` | `--error-bg-color` | `caution` |
| 警告 | `--warning-color` | `--warning-bg-color` | `warning` |
| 提示 | `--info-color` | `--info-bg-color` | `important` |

- `note` 提示块保持中性灰，不占用语义色。
- 标题文字色用同组的 `--*-text-color`。
- 人机校验另有 `--verify-success-*` / `--verify-error-*`，与语义色互不复用。

选中文字与滚动条：`--selection-bg-color` / `--selection-text-color`、`--scrollbar-thumb` / `--scrollbar-thumb-hover` / `--scrollbar-track`。

## 3. 排版

### 3.1 字体栈

| Token | 值 | 用途 |
| --- | --- | --- |
| `--momo-font-serif` | `"Noto Serif SC", "Source Han Serif SC", … , serif` | 正文、标题（默认） |
| `--momo-font-display` | `"EB Garamond", "Noto Serif SC", serif` | 站名、页脚 |
| `--momo-font-sans` | `"LXGW Bright Medium", … , sans-serif`（霞鹜文楷） | 少量界面短文案（可选） |
| `--momo-font-mono` | `"JetBrains Mono Variable", ...` | 代码、数字、token 名 |

Noto Serif SC 由 `@fontsource/noto-serif-sc` 自托管（400 / 700 两份，非阻塞加载）。**不要换成可变字重版本**：那会让正文里所有 `font-weight: 600` 的标题 / 卡片标题从「浏览器回退到 700」变成真正的 semibold，与 h2(700) 的粗细不再一致。引用块与界面短文案用 `LXGW Bright Medium`（霞鹜文楷 Bright），只在渲染正文的页面加载；KaTeX 样式表也只在真的含公式的页面挂载。

### 3.2 字号标尺

| Token | 值 | 典型用途 |
| --- | --- | --- |
| `--momo-font-size-2xs` | 11px | 角标、token 名 |
| `--momo-font-size-xs` | 12px | 极小说明、元信息 |
| `--momo-font-size-sm` | 13px | 说明文字 |
| `--momo-font-size-md` | 14px | 界面正文、正文次要段落 |
| `--momo-font-size-base` | 16px | 文章正文 |
| `--momo-font-size-lg` | 18px | 卡片标题、小节标题、正文 h5 |
| `--momo-font-size-xl` | 20px | 大卡片标题 |
| `--momo-font-size-2xl` | 24px | 分区标题、正文 h3 |
| `--momo-font-size-3xl` | 28px | 正文 h2 |
| `--momo-font-size-4xl` | 32px | 文章一级标题、正文 h1 |
| `--momo-font-size-display` | `clamp(2.25rem, 5vw, 3.5rem)` | 规范页 hero（36–56px） |

> Tailwind 的 `text-sm` / `text-lg` 等工具类仍然是 14 / 18px，与本标尺对齐；写自定义 CSS 时优先用 token，避免出现 15px、17px 这类孤值。

> 正文标题（`.markdown-content h1`–`h6`）里，h1 / h3 / h4 / h6 复用上表的 4xl / 2xl / xl / base；h2 直接取 3xl（28px）、h5 直接取 lg（18px），**没有专属标题 token**。`--momo-font-size-display` 的值本身就是 clamp，只服务规范页 hero。

### 3.3 字重与行高

- 字重：`--momo-font-weight-regular` 400 / `medium` 500 / `semibold` 600 / `bold` 700。
- 行高：`--momo-leading-tight` 1.25（标题）/ `normal` 1.5（界面）/ `relaxed` 1.75（长文）。

正文 `.markdown-content` 固定 `line-height: 1.75`；卡片标题 600；页面标题 700。

## 4. 间距

4px 基数，共 10 档：

| Token | 值 | | Token | 值 |
| --- | --- | --- | --- | --- |
| `--momo-space-1` | 4px | | `--momo-space-6` | 24px |
| `--momo-space-2` | 8px | | `--momo-space-7` | 32px |
| `--momo-space-3` | 12px | | `--momo-space-8` | 40px |
| `--momo-space-4` | 16px | | `--momo-space-9` | 52px |
| `--momo-space-5` | 20px | | `--momo-space-10` | 64px |

Tailwind 的 `p-4` / `gap-6` 与这把尺子同源（1 单位 = 4px），可以直接混用；不要写 `padding: 13px`。

## 5. 圆角

| Token | 值 | 用途 |
| --- | --- | --- |
| `--momo-radius-xs` | 4px | 行内代码、角标（`.momo-tag`） |
| `--momo-radius-sm` | 6px | 分类 chip（`.momo-chip`）、提示块、tooltip、脚注高亮 |
| `--momo-radius-md` | 8px | 按钮（含小号 `--sm`）、输入框、代码块、页码、列表行（`.momo-row`） |
| `--momo-radius-lg` | 12px | 卡片、目录面板、下拉菜单 |
| `--momo-radius-xl` | 16px | 弹窗、抽屉、大容器 |
| `--momo-radius-pill` | 999px | 胶囊、头像、GitHub 卡片的语言 / 协议标记 |

规则：同一类元素只允许一种圆角。卡片不再混用 `rounded` / `rounded-xl` / `rounded-2xl`；按钮不再出现 `rounded-md` 与 `rounded-full` 并存。评论区的输入框 / 文本域 / 按钮（含预览框、回复表单与表情面板）统一用 `--momo-radius-sm`（6px），不再沿用原博客的 4px 圆角。

## 6. 阴影

| Token | 用途 |
| --- | --- |
| `--momo-shadow-xs` | 静态卡片、目录框 |
| `--momo-shadow-sm` | 文章卡片默认 |
| `--momo-shadow-md` | 悬停抬升、下拉菜单 |
| `--momo-shadow-lg` | 抽屉、大弹层、音乐 / GitHub 卡片悬停 |
| `--momo-shadow-xl` | 图片灯箱、全屏浮层 |

阴影颜色统一走 `--shadow-color`（浅色黑 15%，深色黑 55%）。**深色模式不要用白色阴影**——那是发光，不是抬升。

## 7. 动效

### 7.1 时长

| Token | 值 | 用途 |
| --- | --- | --- |
| `--momo-t-fast` | 140ms | 颜色、hover、focus |
| `--momo-t-base` | 220ms | 位移、卡片、下拉、入场 |
| `--momo-t-slow` | 360ms | 长过渡、列表错峰 |
| `--momo-t-press` | 90ms | 按下反馈（只在 `:active`） |
| `--momo-t-reveal` | 800ms | 入场：卡片 pop / 正文 rise |
| `--momo-t-reveal-row` | 480ms | 入场：列表 / 拼图逐行 |

### 7.2 曲线

| Token | 曲线 | 用途 |
| --- | --- | --- |
| `--momo-ease-out` | `cubic-bezier(.22,1,.36,1)` | 默认收尾，不过冲 |
| `--momo-ease-pop` | `cubic-bezier(.34,1.56,.64,1)` | 有体积的元素：胶囊、按钮、弹窗 |
| `--momo-ease-sheet` | `cubic-bezier(.32,.72,0,1)` | 抽屉 / 面板：快起慢收 |

抬升行程（hover）：`--momo-lift` -1px、`--momo-lift-card` -2px、`--momo-lift-emoji` -4px。

入场行程（首次出现）：卡片 `--momo-rise-card` 32px（配 0.96 缩放，曲线 `--momo-ease-pop`）、正文块 `--momo-rise-prose` 120px（曲线 `--momo-ease-out`，不回弹），时长走 `--momo-t-reveal`（800ms）；列表与拼图按行入场，时长换更短的 `--momo-t-reveal-row`（480ms），同一批点亮的多行再按 80ms 递进错峰（整批总跨度不超过 600ms，行多时压缩步长而不是给后段封顶），看起来才是一行一行往下铺，而不是整块淡入。

规则：

- 入场动画是自研的（`src/utils/reveal.ts` + `src/styles/global.css`），不依赖第三方库：元素在 HTML 里声明 `data-reveal="pop" | "rise"`，脚本只在合适时机加 `.is-revealed`；正文块的直接子元素由 CSS 结构性隐藏后逐个显现，**不要再往正文里手写 `data-reveal`**（会先闪一下再藏起来）。列表与图片拼图按行入场（逐行等自己进入视口），评论区只让顶层评论整串入场、回复跟随根评论一起出现。
- 换页（swup）后的显现必须等 `html.is-changing` / `is-animating` 消失：在那之前 `scrollTo(0)` 还没执行、整页也还在淡入，动画会播在看不见的地方。
- 文字颜色只换色，不加回弹。
- 关心 `backdrop-filter` 的元素，显隐动画不能靠祖先 `opacity`（会让毛玻璃整帧失效），要做在元素自己身上。
- `prefers-reduced-motion: reduce` 时位移与循环动画停止，颜色变化保留。

## 8. 布局与断点

| Token | 值 | 用途 |
| --- | --- | --- |
| `--header-width` | `min(1024px, 90vw)` | 顶栏、页脚 |
| `--page-width` | `min(776px, 90vw)` | 正文列、卡片 |
| `--toc-offset-left` / `--toc-width` | 由页面宽度推导 | 桌面端目录 |
| `--category-width` | `min((100vw - 页面宽) / 3, 200px)` | 归档页分类栏 |

断点：

| 断点 | 含义 |
| --- | --- |
| 640px | Tailwind `sm`：小屏手机，栅格收单列 |
| 776px | 站点移动端分界：顶栏毛玻璃、目录、悬浮按钮、图片拼图、规范页单栏切换 |
| 1024px | Tailwind `lg`：桌面双栏（规范页侧栏在 ≤1024px 收成单栏） |

> 媒体查询统一写成 `max-width: <该档值>`（含等号），全站只出现 640 / 776 / 1024 三个数字，不再出现 767 / 775 / 900 这类分叉。

> 页面主列写 `min(var(--page-width), 90vw)`，不要写 `min(70vw, …)`——平板段两侧会白留一大片。

## 9. 层级

| Token | 值 | 使用方 |
| --- | --- | --- |
| `--momo-z-header` | 50 | 顶栏 |
| `--momo-z-sticky` | 100 | 吸顶导航 |
| `--momo-z-fab` | 1000 | FabMenu、移动端目录 |
| `--momo-z-drawer` | 1100 | 移动端抽屉 |
| `--momo-z-modal` | 1200 | 搜索弹窗 |
| `--momo-z-lightbox` | 2000 | 图片灯箱 |
| `--momo-z-loading` | 9999 | 换页加载遮罩 |

OverlayScrollbars 的滚动条是 `z-index: 99999`，会盖在所有浮层之上；这是第三方行为，已在「页面滚动条」一节记录。

## 10. 组件规范

公共类在 [`src/styles/components.css`](../src/styles/components.css)，只负责形状与交互，颜色全部取自 token。

### 10.1 按钮

| 类 | 说明 |
| --- | --- |
| `.momo-btn` | 默认描边按钮（次操作） |
| `.momo-btn--primary` | 主操作：蓝底白字，整页只出现一次 |
| `.momo-btn--ghost` | 幽灵按钮：无描边，悬停出浅底 |
| `.momo-btn--sm` / `--lg` | 28px / 44px 高 |
| `.momo-btn--icon` | 40×40 纯图标按钮，必须带 `aria-label` |
| `[disabled]` | 45% 透明，禁止点击 |

高度：sm 28 / 默认 36 / lg 44。触屏主操作与输入框建议 44px。小号按钮只是变矮变窄，圆角与其它按钮一致（`--momo-radius-md`），左右内边距 `--momo-space-2`。

### 10.2 卡片

- `.momo-card`：表面色 + 1px 描边 + `--momo-radius-lg` + `--momo-shadow-sm`。
- `.momo-card--plain`：不上底色，只留描边与阴影（文章卡片）。
- `.momo-card--interactive`：悬停上浮 `--momo-lift-card`，阴影升到 `--momo-shadow-md`，描边变 `--border-color-strong`。
- `.momo-row`：不是卡片的列表行（归档、搜索结果），8px 圆角 + 悬停浅底。

### 10.3 标签

- `.momo-chip`：可点的分类 / 筛选标签（6px 圆角，**不是**胶囊），选中态 `aria-current="true"` 或 `.is-active` 时蓝底白字。
- `.momo-tag`：只读角标（分类名、语言标记），浅底 + 描边 + 12px 字、4px 圆角。

### 10.4 表单

- `.momo-field`：输入框 / 文本域共用，默认表面色、1px 描边、8px 圆角。
- 悬停加深描边；聚焦只把描边换成主题蓝，**不加光晕**。
- 禁用态用 `--surface-color-hover` 底 + `--text-color-30` 字。

### 10.5 面板 / 菜单

- `.momo-panel`：弹窗、抽屉，16px 圆角 + `--momo-shadow-lg`。
- `.momo-menu`：下拉菜单，12px 圆角 + `--momo-shadow-md`。

### 10.6 提示块

正文提示块由 Markdown 插件的 `:::note` / `:::tip` / `:::important` / `:::warning` / `:::caution` 生成：

- 结构：`<div class="note"><span class="admonition-title">NOTE</span><p>…</p></div>`。
- 语义色只作用在左侧描边、标题颜色与图标；背景用对应的浅色语义底。
- 色值来自四组语义 token：tip→`--success-*`、important→`--info-*`、warning→`--warning-*`、caution→`--error-*`；note 是中性灰。
- 标题字号 `--momo-font-size-lg`，图标是 18×18 的 data URI SVG。
- ⚠️ **图标颜色写死在 data URI 里，不随 token 变化**（四色提示图标、GitHub 卡片的 logo / 星 / 叉、音乐卡图标同理）。改语义色后图标需要手工同步 data URI 里的十六进制值，或者改造成 `mask-image` + `background-color: currentColor`。
- 文章页的草稿 / 语言回退横幅是**页面级状态条**，不是正文提示块：它用 `--momo-radius-md`（8px），比提示块的 6px 大一档，属有意例外。

### 10.7 Tooltip

- `.momo-tooltip` + `data-tooltip="文案"`：悬停 / 键盘聚焦显示，`pointer-events: none`，不挡鼠标。
- 页脚图标仍用 `title` 属性 + 自定义 `::after`（历史实现），颜色与圆角已改为 token。

### 10.8 自定义语法

Markdown 插件生成的卡片与行内语法，样式都在 `markdown.css`：

| 语法 | 产物 | 说明 |
| --- | --- | --- |
| `::github{repo="owner/repo"}` | `.card-github` | 仓库卡片，仓库信息由卡片内脚本异步获取 |
| `::music{id="歌曲 ID"}` | `.card-music` | 网易云音乐卡片 |
| `::quote[内容]` | `.quote` | 居中引用 |
| `{中文}(拼音)` | `<ruby>` | 注音 |
| `!!内容!!` | `.spoiler` | 折叠（悬停或点击展开） |
| `==内容==` | `.rainbow-text` | 彩虹文字 |
| `++内容++` | `.underline-text` | 下划线 |

规范页 `/design#custom` 直接渲染真实的 `::github` / `::music` 指令（`src/content/spec/design/{github,music}/`），卡片数据同样由脚本实时请求，和文章页一致。

> GitHub / 音乐卡片的图形（logo、星、叉、网易云图标）同样是内嵌颜色的 data URI，不随 token 变色；悬停只过渡描边与阴影（`--momo-t-fast` / `--momo-t-base`），不用 `all`。

### 10.9 焦点

全局 `:where(a, button, input, textarea, select, summary):focus-visible` 统一 2px 蓝色描边、2px offset。组件可以把它改成描边换色（`.momo-field:focus` 就只换 `border-color`、不叠光晕），但**不能完全去掉焦点反馈**。

## 11. 页面结构

- 顶栏：logo（EB Garamond）+ 桌面导航胶囊 + 搜索 / 主题 / 语言按钮。换页不重建，状态由 `Header.astro` 的 `syncPersistedHeader()` 重算。
- 正文：`#swup-container` 内、`.transition-swup-fade` 中；固定浮层（TOC / FabMenu）走 `overlay` 插槽，避免成为 fixed 包含块。
- 页脚：与顶栏同宽、EB Garamond、次要文字色；含 RSS 与「设计规范」入口。
- 文章页：Cover 标题 30px、正文 16px / 1.75、卡片列 776px。

## 12. 深色模式

- 开关在 `<html data-theme="light|dark">`，由 `Layout.astro` 的初始化脚本在首屏前写入。
- 所有颜色 token 在 `[data-theme="dark"]` 里覆盖；标尺类 token 不变。
- 深色下链接文字用亮蓝、蓝底压暗成 `#0d5a94`；阴影改黑色叠加。
- 组件不要写 `@media (prefers-color-scheme: dark)` 单独兜底（CMS 预览除外），否则用户手动切主题会失效。

## 13. 无障碍

- 键盘焦点始终可见；图标按钮必须有 `aria-label` / `title`。
- 正文链接颜色为 `inherit`（引用块、彩虹文字、提示块标题不会被覆盖），下划线常显。
- 对比度：浅色链接 `#10558c` 在 `#fbfbfb` 上 7.52:1；深色 `#57ace7` 在 `#0a0a0a` 上 7.98:1；蓝底白字 7.22:1（深色）与 7.78:1（浅色）。
- 尊重 `prefers-reduced-motion` 与 `prefers-reduced-transparency`。
- 禁用 JS 时：顶栏保持完整胶囊、正文可见、照片层退化为淡背景。

## 14. 样式归属与维护

新增样式先判断层级：

| 层级 | 位置 | 典型内容 |
| --- | --- | --- |
| Token | `src/styles/variables.css` | 颜色、字号、间距、圆角、阴影、动效、层级 |
| Base | `src/styles/global.css` | `body`、选中、按压反馈、减少动效 |
| Component | `src/styles/components.css` | 卡片、按钮、chip、field、panel |
| Feature | 页面 / 组件私有 `<style>` | `.ds-*`、照片封面、灯箱 |

维护流程：

1. 改 token → `/design` 自动同步（页面直接 `?raw` 读取 `variables.css`）。
2. 改正文样式 → 同步 [`cms/server/prose.css`](../cms/server/prose.css)：结构值（行内代码 4、代码块 / 图片 / 拼图 8、提示块 6、卡片 12）与调色板都跟站点对齐（预览的 `--text` / `--link` / `--bg` 等直接取 `variables.css` 的值）。
3. 改顶栏 / 滚动条 / 照片封面前，先读 `AGENTS.md` 里对应的「踩坑」段落。
4. 新增组件 → 先判断能否组合现有 `.momo-*` 类；不能才加新类，并在组件旁写明原因。
5. 构建验证：`pnpm build`，浅色 / 深色 / 390px / 1440px 各看一遍。

## 15. 文件地图

| 文件 | 职责 |
| --- | --- |
| `src/styles/variables.css` | 全部 token（含深色覆盖） |
| `src/styles/components.css` | 公共组件类 |
| `src/styles/global.css` | 基础规则、按压、入场动画、减少动效 |
| `src/styles/markdown.css` | 正文排版（与 CMS 预览对应） |
| `src/styles/design.css` | `/design` 规范页专用 |
| `src/components/design/DesignSpec.astro` | 规范页结构与中英文文案 |
| `src/pages/[...locale]/design.astro` | 规范页唯一入口（`/design` / `/en/design` 由 locale 路由生成） |
| `src/content/spec/design/*.md` | 规范页里的真实 Markdown 示例（`github/` / `music/` 是卡片示例） |
| `doc/design_zh-cn.md` / `doc/design_en.md` | 本文档 |

## 16. 检查清单

- [ ] 颜色来自 token，没有新增十六进制色值（语义色 / 代码高亮除外）
- [ ] 圆角只从 4 / 6 / 8 / 12 / 16 / 999 中取
- [ ] 字号来自标尺；正文 h2 取 3xl（28px）、h5 取 lg（18px），不写字面量
- [ ] 动效使用 `--momo-t-*` 与 `--momo-ease-*`（脚注高亮的 2s 是唯一保留的字面量，已在代码里注明）
- [ ] 媒体查询只用 640 / 776 / 1024 三档，且写成 `max-width`
- [ ] 深色模式下实际看过，而不是只改浅色
- [ ] 390px 宽度下没有横向滚动
- [ ] 键盘 Tab 能看清焦点
- [ ] `prefers-reduced-motion` 下不抖
- [ ] 正文改动同步了 CMS `prose.css`
