# Momo CMS

一个极简的本地 CMS 管理后台，用于直接管理 Momo 博客的文章内容（`src/content/blog/**/*.md`）。

## 快速开始

```bash
# 1. 安装依赖（cms 是 pnpm workspace 成员，根目录安装即可）
pnpm install

# 2. 启动 CMS（根目录执行）
pnpm cms
```

启动后访问 **http://localhost:5188**（单端口，前端与 API 由 Hono + Vite 一体提供，支持 HMR）。

> 保存文章即直接写入博客内容目录，博客 dev server（`pnpm dev`）会实时热更新。

## 功能

- **概览页**（`#/`）：文章总数 / 已发布 / 草稿 / 置顶 / 分类数 / 正文总字数统计，分类分布条形图，语言版本覆盖（中英双语），最近文章列表
- **新建文章弹窗**（列表页 / 概览页右上角，`src/pages/new-article.ts`）：标题（必填）/ 路径（留空按 `yyyy/yyyy-mm-dd` 生成）/ 语言 / 分类一次填完即创建并直接进编辑器；分类用自研**可输入下拉**（`createComboSelect`），既能从已有分类里选，也能直接输入新分类；标题与分类随模板一起写进 frontmatter（`POST /api/articles` 接收 `{ path, lang, title?, category? }`），不再创建后再补一次保存。Enter 创建、Esc / 点遮罩关闭，关闭后焦点回到「新建文章」按钮。
- **网站配置页**（`#/config`）：`src/config.ts` 的可视化编辑器（站点信息、阅读与目录、评论、主题、个人信息、许可协议、国际化、各语言 Cover 文案、友链列表；支持增删与上下移动友链），可展开查看文件源码；右侧**悬浮目录栏**（贴住表单右边缘，只列分区，点击平滑滚动到位、滚动时自动高亮当前分区，可收起，窄窗口默认收起）；「主题与动效」按语义分组、组间用浅色横线分隔；保存时**只改写真正改动过的字段**，文件里的注释与排版保持不变
- **文章列表**（`#/list`）：搜索、分类筛选、草稿/已发布筛选、语言徽章；支持**卡片 / 表格**两种视图模式（localStorage 记忆选择）与**多种排序**（默认置顶+日期 / 发布日期升降序 / 标题 / 路径 / 分类，中文按拼音排序）；表格**列宽按内容自动分配**（宽裕时按内容比例铺满整行，狭窄时压缩标题/路径并保底最小宽度，窗口变化自动重算），表格右侧**行内操作**（置顶/取消置顶、草稿/发布切换、删除）
- **批量操作**（列表页）：默认**关闭**，列表里没有任何多选框；顶部「批量操作」按钮开启后才显示批量操作条与卡片/表格多选框（表格多选列也随开关出现/消失），再点「退出批量」清空选中并收起。批量操作条支持全选当前筛选结果、改分类（含「未分类」）、置顶 / 取消置顶、设为草稿 / 发布、批量删除（二次确认并显示数量）与**导出 Markdown**（ZIP，包含每篇文章的全部语言版本）；没有选中时动作按钮禁用。操作成功后局部刷新列表，失败项逐条列出并保持选中以便重试；切换筛选 / 视图后选中集合只保留当前可见项
- **媒体库**（`#/media`）：统一浏览 `src/content/blog/**` 与 `public/**` 下的图片，按文章目录（blog）或目录（public）分组，显示相对路径、宽高、大小与修改时间。上传采用**图床式弹窗**：选择目标文章（图片统一保存到 `<文章目录>/images/`，引用写作 `./images/xxx.png`）或 public 目录后，把图片拖进弹窗（也可点击选择、或在弹窗里粘贴外链直接生成引用），逐张显示上传状态与可复制的 Markdown；**压缩质量可在弹窗里拖动滑块调整（40-100，默认 82），并按同一套 sharp 参数实时预估压缩后大小（总大小 / 单张节省比例）**；上传仍会压缩长边 > 2400px 的图片并按内容 sha256 跨同 scope 去重。**卡片本身不再放操作按钮**：点缩略图 / 卡片打开大图详情，详情里统一提供复制 Markdown / alt / 路径、原路径替换、移动到其他博客或 public 目录（会提示受影响的引用文件，但不会自动改写引用）、重命名与删除。其它已有能力包括搜索、**批量选择删除**、**未引用图片扫描清理**（扫描 `src/**` 与根目录配置后列出可确认删除的图片）
- **编辑器从媒体库选图**：Markdown 工具栏的「媒体库」与封面图旁的「媒体库」都会打开选图弹窗；「本文图片 / public 图片」两个标签只列出当前文章目录与 `public` 下的图片（本文没有图片时提示先去媒体库上传/移动），点击即按 `./images/xxx.png` 或 `/xxx.png` 插入正文 / 回填封面（选中文字会作为 alt）
- **Markdown 编辑器**：frontmatter 表单 + 正文源码，左侧编辑右侧**实时预览**（防抖 500ms，重绘后保持原滚动位置）；编辑区上方**快速插入工具栏**（加粗/斜体/行内代码/链接/图片/引用（`> `）/自定义引用（`:::quote`）、代码块/Typst、行内/块公式、提示块（note/tip/important/caution/warning）、GitHub/音乐卡片、注音/折叠/彩虹/下划线），支持选中文本包裹与光标定位
- **自动保存**：编辑页每 60 秒自动写盘一次（`EditorPage.ts` 的 `AUTOSAVE_INTERVAL`），只在「有改动且没有保存在进行」时保存；提示做在顶栏（`已自动保存 HH:MM`），不弹 toast，也**不重建界面**（`navigate` 会重建编辑器、丢掉光标与撤销栈），只有 slugId 改名真的移动了文件夹时才静默对齐地址栏
- **完整自定义语法预览**：与博客渲染管线一致（见下方语法表）
- **多语言版本**：同路径 `zh-cn.md` / `en.md` 标签页切换，可新建缺失的语言版本
- **在文件夹中打开**：文章编辑页右上角按钮，用系统默认的文件管理器打开当前文章所在文件夹（Windows `explorer.exe` / macOS `open` / Linux `xdg-open`）
- **slugId**：文章/评论标识元数据（如 `momo/xxx`），与文件夹位置解耦，保存时**不会**改变文件夹；仅当 slugId 与当前文件夹路径一致（CMS 新建的文章）且被修改时才整体移动文件夹
- **封面图上传**：图片直接保存到文章文件夹，自动填写 `image: ./xxx.png`
- **删除保护**：删除前二次确认，未保存内容离开页面时提醒
- **深色模式**：跟随系统

## 技术架构

```
cms/
├── package.json          # 独立 workspace 包（依赖：hono、@hono/vite-dev-server、sharp、unified 插件链…）
├── vite.config.ts        # devServer 插件：Hono 应用作为 SSR 入口，单端口一体运行
├── index.html            # SPA 外壳
├── server/               # Hono 服务端（Node ESM，由 Vite SSR 加载）
│   ├── index.mjs         # 应用入口：/api/* 路由 + SPA 回退 + 静态资源
│   ├── store.mjs         # 博客文章文件统一读写层（CRUD / slugId 元数据 / 分类统计 / 解析缓存）
│   ├── articles.mjs      # GET/POST/PUT/DELETE /api/articles/*
│   ├── config-file.mjs   # src/config.ts 的解析与「只改写改动字段」的写回（保留注释）
│   ├── config.mjs        # GET/PUT /api/config：站点配置可视化编辑
│   ├── reveal.mjs        # POST /api/reveal：用系统文件管理器打开文章文件夹
│   ├── preview.mjs       # POST /api/preview：复用博客全部 remark/rehype 插件
│   ├── upload.mjs        # POST /api/upload：封面图上传（multipart）
│   ├── meta.mjs          # GET /api/meta：分类统计
│   ├── stats.mjs         # GET /api/stats：概览页统计（字数 / 语言覆盖 / 最近文章）
│   ├── media.mjs         # /api/media：图片列表（sharp 读宽高）/ 上传压缩去重 / 压缩预估 / 删除 / 重命名 / 替换 / 移动 / 引用查询 / 未引用扫描
│   ├── batch.mjs         # /api/batch：批量改 frontmatter + 零依赖 ZIP 导出 Markdown
│   ├── blog-content.mjs  # GET /blog-content/*：文章文件夹静态资源（预览图片）
│   └── prose.css         # 预览正文样式（与博客 markdown.css 一致的精简版）
└── src/                  # 前端（纯 TypeScript SPA，hash 路由，无框架）
    ├── main.ts / router.ts / api.ts / types.ts / styles.css
    ├── dom.ts / ui.ts（toast）/ select.ts（自研下拉组件：createSelect / 可输入的 createComboSelect）/ media-shared.ts（引用路径 + 弹窗工具）
    └── pages/ OverviewPage.ts（概览）、ListPage.ts（列表：卡片/表格 + 批量模式）、
              MediaPage.ts（媒体库：网格 / 图床上传弹窗 / 批量选择 / 详情 / 替换 / 移动 / 未引用清理）、
              media-picker.ts（编辑器选图弹窗）、EditorPage.ts、
              ConfigPage.ts（网站配置）、config-toc.ts（配置页悬浮目录栏）、header.ts（顶栏导航）、
              new-article.ts（新建文章弹窗）
```

- **API 端口**：5188（唯一端口，Vite dev server 内嵌 Hono）
- **预览管线**：直接复用 `../src/plugins/*.ts`（remark-typst、remark-directive-rehype、remark-combined、admonition、github/music/quote 卡片、figure 插件）+ KaTeX，与博客 astro.config.mjs 的插件顺序一致，跳过仅构建期需要的 reading-time 与 LQIP 插件。`server/` 在 `cms/vite.config.ts` 里整体外部化，由 **Node 原生加载**，因此插件是 `.ts` 就要靠 Node 的类型擦除（**Node ≥ 22.18**）与 import 里的显式 `.ts` 扩展名。
- **代码块**：使用官方 **Expressive Code**（`rehype-expressive-code`）渲染，配置与博客共用根目录 `ec.config.mjs`（折叠 / 行号插件、`defaultProps` 与中文文案），通过 `customCreateRenderer` 复用同一个渲染器（shiki 主题只加载一次）；主题与开关取自 `src/config.ts` 的 `siteConfig.expressiveCode`（用 `config-file.mjs` 的 `readConfig()` 解析，按文件 mtime 缓存，改完配置无需重启 CMS），`enable: false` 时预览退化为纯文本代码块（与博客关闭语法高亮一致）；`/api/preview` 的 `lang` 字段用于让代码块内的界面文案跟随文章语言。样式与复制 / 折叠脚本由 EC 随代码块内联注入，无需在 `prose.css` 中重复实现。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/articles?q=&category=&draft=` | 文章列表（分组、筛选、搜索） |
| GET | `/api/articles/:path` | 读取文章全部语言版本 |
| POST | `/api/articles` | 新建文章 `{ path, lang?, title?, category? }`（标题缺省取路径最后一段） |
| PUT | `/api/articles/:path/:lang` | 保存 `{ data, body }`；仅当 slugId 与路径一致且被修改时移动文件夹 |
| DELETE | `/api/articles/:path` | 删除整篇文章（文件夹） |
| POST | `/api/preview` | 实时预览 `{ data, body, base, lang }` → 完整 HTML 文档 |
| POST | `/api/upload` | 上传封面图（multipart: file + path） |
| POST | `/api/reveal` | 用系统默认的文件管理器打开文章文件夹 `{ path }` |
| GET | `/api/meta` | 分类统计 |
| GET | `/api/stats` | 概览统计（总数/发布/草稿/置顶/分类/字数/语言/最近文章） |
| GET | `/api/config` | 读取 `src/config.ts`：`{ path, source, values }` |
| PUT | `/api/config` | 保存配置 `{ values }` -> `{ path, source, values, changed }`；只写回改动过的字段 |
| GET | `/api/media?scope=blog\|public&q=` | 媒体库列表，按目录分组，含相对路径 / 宽高 / 大小 / 修改时间 / alt 建议、上传目录候选与 `articles`（文章目录 + 标题，供上传弹窗选目标）；最多 2000 个文件 |
| GET | `/api/media/file?scope=&path=` | 读取媒体库图片（缩略图 / 原图，只允许两个根目录内的图片） |
| POST | `/api/media/upload` | 上传图片（multipart: file + scope + dir + quality）：压缩后按 sha256 去重，重复时返回 `{ duplicate }`；博客图片由前端传 `<文章目录>/images` |
| POST | `/api/media/estimate` | 只预估压缩后大小（multipart: file + quality），返回 `{ size, originalSize, width, height, compressed, compressible }`，不写盘 |
| DELETE | `/api/media?scope=&path=` | 删除单张图片（路径经 safeRel 校验，禁止 `..`） |
| PATCH | `/api/media` | 重命名图片 `{ scope, path, name }`（同目录内，不会自动改文章引用） |
| POST | `/api/media/replace` | 原路径替换图片（multipart: file + scope + path）；格式不同时用 sharp 重编码，GIF / SVG / ICO 只能同格式 |
| POST | `/api/media/move` | 移动图片 `{ scope, path, targetScope, targetDir }`（跨 blog / public；不会自动改引用） |
| GET | `/api/media/refs?scope=&path=` | 该图片被哪些 Markdown 引用（`{ path, refs }`，refs 相对 `src/content`） |
| GET | `/api/media/unused?scope=` | 扫描 `src/**` 与根目录配置，返回未被引用的图片 `{ scope, total, unused }` |
| POST | `/api/batch/update` | 批量改 frontmatter `{ paths, action, value? }`；action 为 category / pin / unpin / draft / publish，返回 `{ ok, failed }` |
| GET | `/api/batch/export?paths=a,b,c` | 导出所选文章的 Markdown（含全部语言版本）为 `momo-export-YYYYMMDD-HHmm.zip` |

## 站点配置写回（`server/config-file.mjs`）

`src/config.ts` 是用户需要手工维护的文件（`pnpm momo update` 会提示手工合并），因此 CMS **不整文件重写**：

1. 内置一套极小的扫描器，直接解析源码里的对象字面量（零依赖，`cms/server` 由 Node 原生加载）；
2. 保存时把提交的配置与当前值做 diff，先逐字段、逐数组元素比较，再只替换/插入真正变化的片段——注释、引号风格（单/双引号）、缩进与字段顺序全部保留；
3. 数组只在末尾追加元素、或删除元素（不会整体重写），因此友链里的注释不会被冲掉；
4. 写回前重新解析一遍做校验，任何一个改动字段对不上就整体放弃并报错，绝不写坏文件。

改动字段增删时，只需同步 `cms/src/pages/ConfigPage.ts` 的 `buildSections()`（表单分区描述），服务端无需改动。

## 自定义语法速查（预览与博客一致）

| 语法 | 说明 |
|---|---|
| `:::note{name="提示"}`…`:::`（note/tip/important/caution/warning） | Alert 提示块（块级容器，`{name="..."}` 可选） |
| `::github{repo="owner/repo"}` | GitHub 仓库卡片 |
| `::music{id="歌曲ID"}` | 网易云音乐卡片 |
| `::quote[内容]` / `:::quote`…`:::` | 居中引用组件（两种写法等价；工具栏「自定义引用」用容器写法） |
| `$...$` / `$$...$$` | KaTeX 数学公式 |
| ```` ```typst ```` | Typst 代码块 → SVG 渲染 |
| `{中文}(zhong wen)` | 注音（Ruby） |
| `!!内容!!` | 折叠内容（hover 显示） |
| `==内容==` | 彩虹文字 |
| `++内容++` | 下划线 |
| `![标题图片](./cover.jpg)` | 图片 + figure 标题（`title` 属性作为 figcaption） |
| ` ```js title="a.js" {3} ins={4} collapse={6-9} showLineNumbers ` | Expressive Code 代码块（标题栏 / 行高亮 / diff / 行号 / 折叠 / 换行 / 终端窗口） |

## 注意事项

- 内容为本地可信数据；预览 iframe 使用 `sandbox="allow-scripts"` 沙箱。
- 文章信息读取（列表 / 分类 / 概览统计）由 `server/store.mjs` 统一处理：目录并发遍历、文件并发读取，并按文件 `mtime + size` 缓存解析结果。文件被 CMS 保存或外部修改后缓存会自动失效，无需重启。
- Typst 首次编译需加载原生编译器，约 1-3 秒；失败时预览区显示错误信息。
- 修改 `server/` 目录下的代码后需要重启 `pnpm cms`（服务端模块不参与 HMR）。
- **整页滚动条**：`styles.css` 的 `html { scrollbar-gutter: stable }` 常驻预留纵向滚动条槽位。CMS 用原生滚动条，内容高度跨过一屏时滚动条会吃掉约 15px 宽度，居中的 `.cms-main` 与顶栏会整体左右跳一下；删掉这一行就会复现。
- **下拉选择一律用 `src/select.ts` 的 `createSelect()`**（界面里的原生 `<select>` 已全部替换）：返回值就是触发器本身，`.value` / `setOptions(options)` 照旧可用，值变化走 `onChange` 回调。选项面板挂在 `body` 上并用 `position: fixed` 定位（编辑器工具栏 / 弹窗 / 配置网格各有层叠上下文与 overflow，留在原地会被裁掉或压住），靠近视口底部自动向上翻转、超出可用高度时面板内部滚动；键盘支持 ↑↓ / Home / End / Enter / Esc / 首字母跳转，焦点始终留在触发器上。样式在 `styles.css` 的 `.cms-select-*`（箭头用两条边框画，颜色跟 `currentColor`，深浅色共用一套变量）。⚠️ 不要用触发器的 `blur` 来收起面板：触屏上点选项会先让按钮失焦，选项就永远选不上。
- **「选已有或自己输入」的字段用 `createComboSelect()`**（同文件，目前是新建弹窗的分类）：外层是 `.input.cms-combo`，里面是真正的 `<input>` + 箭头按钮，`.value` 读写输入框文本、`.input` 拿输入框、`.closePanel()` 在关弹窗时收起面板；面板与 `createSelect` 共用 `.cms-select-*` 类名和同一个定位函数（`placePanel`），输入时按内容过滤，没有完全匹配时在顶部给一行「使用「xxx」」供直接采用。它监听的是输入框 `blur` / 面板项 `mousedown` 的 `preventDefault`——所以点选项不会先失焦。
- **配置页悬浮目录栏**在 `src/pages/config-toc.ts`：目录项必须是 `<button>`，**不能**用 `#anchor` 链接——CMS 是 hash 路由，改 hash 会直接把页面切走；分区列表由 `renderBody` 每次重建表单后调 `setSections()` 刷新；「主题与动效」的分组靠 `FieldDef.group`（同名连续字段为一组，组间一条 `--border-soft` 横线）。
- **编辑页自动保存**在 `src/pages/EditorPage.ts`：定时器跟界面一起建、在 `__cleanup` 里 `clearInterval`（换路由不残留）。`doSave` 三处要点：① 请求前先固化 `payload` 并按它算快照，请求期间的新输入才不会被误标成已保存（手动保存同样受益）；② 成功后同步 `state.detail.files[lang]`，否则切到另一种语言再切回来会读到打开页面时的旧内容，并被自动保存写回磁盘；③ 自动保存不调 `navigate`——那会重建编辑器 DOM、丢掉光标与撤销栈，slugId 改名真的移动文件夹时才用 `history.replaceState` 静默对齐地址栏。
- **编辑页滚动同步**在 `src/pages/EditorPage.ts` 的 `setupScrollSync()` 与 `server/preview.mjs` 的 `PREVIEW_SYNC_SCRIPT`：跨源 iframe 只能 postMessage，发送走 rAF 节流、每帧最多一条；用两侧「最近一次主动滚动」的时间戳识别回声，**不把预览回传的位置再写回 textarea**（以前用 80ms 抑制回环，预览每回传一次就重置一次抑制窗口，左侧滚动被压成一段一段的，右侧预览看起来一顿一顿）。实时预览每次输入都会重建 iframe 文档，所以预览脚本就绪后先发 `cms-preview-ready`，父窗口再按重建前的滚动比例发 `cms-scroll-to` 恢复位置——否则每次输入预览都会跳回顶部。
- 博客根目录相对路径图片（`/images/xxx.png`）在预览中不会加载（仅本地文件相对路径可用）。
- **`hidden` 属性统一由 `styles.css` 顶部的 `[hidden] { display: none !important }` 兜底**：组件类里一旦写了 `display: flex/grid`，浏览器对 `hidden` 的默认样式会被作者样式盖掉（批量操作条、拖拽提示都踩过这个坑），所以不要再给需要隐藏的元素单独写 `display` 而指望 `hidden` 生效。
- **编辑器选图**（`pages/media-picker.ts` + `EditorPage.ts`）：工具栏「媒体库」与封面「媒体库」共用 `openMediaPicker()`；弹窗只列「本文图片」（`item.articleDir === state.path`）与 `public 图片`，分别生成 `./images/xxx.png` 与 `/xxx.png`。选中文字优先作为 alt；封面只回填 `f-image` 并 markDirty。弹窗关闭/Esc/换路由统一走 `media-shared.ts` 的 `createOverlay()` / `closeActiveOverlays()`（编辑器 `__cleanup` 会强制关闭），避免残留 Esc 监听。
- **媒体库**（`server/media.mjs` + `pages/MediaPage.ts`）：blog 图片按「最近的含 `.md` 的目录」归到所属文章，复制 Markdown 时用相对文章目录的 `./...`（上传到 `images/` 后自然是 `./images/xxx.png`），public 图片用 `/...`。上传统一走**图床式弹窗**：`state.list.articles` 提供目标文章（图片写入 `<文章目录>/images`，目录不存在会自动创建），拖拽 / 选择文件后逐张上传并在弹窗里给出可复制的 Markdown；弹窗还支持粘贴外链，只生成 `![alt](url)`，不落盘。**压缩质量滑块（40-100，默认 82）**通过 `/estimate` 逐个预估（缓存键含 `name:size:lastModified:quality`），队列行与底部汇总显示「预计大小 / 原始大小 / 节省比例」，上传时把同一个 `quality` 传给 `/upload`，因此预估与最终文件大小一致。JPEG / WebP 直接按 quality，AVIF 按 `quality × 0.73` 折算（sharp 的 AVIF 刻度更「高」），PNG 在 `<100` 时用调色板压缩、100 为无损，GIF / SVG / ICO 原样保存；重编码反而变大时保留原图（替换时除外）。上传先压缩再按内容 sha256 与同 scope 已有图片比对，命中重复不写盘并返回 `duplicate`（前端给一键复用）；重名自动加 `-1` / `-2`。宽高优先用 `sharp`，加载失败时退化为内置文件头解析并在响应里标注 `compressed: false`。目录扫描最多 2000 个文件，忽略 `node_modules` / `dist` / `.astro` 等目录。**卡片上不放操作按钮**：点卡片/缩略图打开详情，详情内提供复制 Markdown / alt / 路径、**替换**（保持原路径，格式不同时用 sharp 按目标扩展名重编码，GIF / SVG / ICO 只能同格式）、**移动**（按目录判定同名冲突并自动加后缀，前端会先用 `/refs` 提示受影响的 Markdown，但不会自动改写引用）、重命名与删除；**未引用扫描**把 `src/**` 文本与根目录配置拼成 haystack，按文件名做保守匹配（宁可多报也不误删），结果列成缩略图由用户勾选后删除。
- **批量操作**（`server/batch.mjs` + `pages/ListPage.ts`）：列表页默认**不是**批量模式，`state.batchMode` 为 false 时不渲染任何多选框、批量操作条隐藏；顶部「批量操作」按钮切换 `is-batch` 并重绘列表（表格多选列随开关增删，`fitTableColumns` 要传同一份列定义，窗口 resize 时也一样），退出批量会清空选中。动作按钮在没有选中 / 执行中时禁用。`/api/batch/update` 复用 `store.mjs` 的 `readArticle` / `saveArticle` 逐语言写 frontmatter，分类 / 置顶变化不会移动文件夹；批量删除由前端逐篇调 `DELETE /api/articles/:path` 并收集失败项。导出 ZIP 用 STORE（不压缩）+ 手写 CRC32 表，文件名 UTF-8 并置通用标志位 `0x0800`，因此体积等于所有 Markdown 原文之和（未做 deflate）。列表页的选中集合在每次刷新 / 切换筛选 / 切换视图后都与当前可见列表求交集。

## 测试

`smoke.mjs` 是基于 jsdom 的端到端冒烟测试（真实点击「新建文章」→ 填标题 / 路径 / 自定义分类创建 → 编辑 → 实时预览 → 保存 → 删除），并覆盖空路径自动生成日期路径、列表批量模式的开关、媒体库渲染 / 图床弹窗（含压缩质量控件）/ 外链 Markdown / 大图详情与操作、编辑器从媒体库选图（上传与删除不放进冒烟，避免改动真实图片）。需先启动服务再运行：

```bash
pnpm cms                  # 终端 1：启动服务
pnpm --filter cms smoke   # 终端 2：运行冒烟测试
```

自动保存要等满 60 秒才有动作，没有进冒烟测试（会拖慢整个套件），需要验证时可临时把 `EditorPage.ts` 的 `AUTOSAVE_INTERVAL` 改小。
