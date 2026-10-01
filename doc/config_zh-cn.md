# Momo 配置指南

## 配置文件一览

| 文件 | 作用 |
| --- | --- |
| `src/config.ts` | **主要配置入口**：站点信息、主题开关、个人资料、License、友链、多语言与各页面的 Cover 文案 |
| `src/content.config.ts` | 文章 frontmatter 的 schema（只有在新增/修改字段时才需要改动） |
| `src/i18n/` | 界面文案翻译（除 Cover 之外的部分） |
| `src/types/` | 上述配置的 TypeScript 类型定义 |

## `src/config.ts`

### `siteConfig`

* `title`: 网站的标题
* `subTitle`: 网站的副标题；**留空时浏览器标签栏（以及 RSS 标题）只显示 `title`**，不会出现多余的 ` - ` 分隔符
* `rootSiteUrl`: 网站的根地址，用于生成 SEO 与社交分享的绝对链接；`astro.config.mjs` 的 `site` 默认取该值
* `favicon`: 网站的图标
* `pageSize`: 每页显示的文章数量
* `toc`
    * `enable`: 是否启用目录
    * `depth`: 目录的深度
* `blogNavi`
    * `enable`: 是否启用博客底部的页面导航
* `comments`
    * `enable`: 是否启用评论功能
    * `platform`: 评论平台，`default` 使用 Momo-backend，也支持 `twikoo`
    * `backendUrl`: 后端的地址
* `theme`
    * `AOS`: 是否启用 AOS 动画
    * `LQIP`: 是否启用 LQIP 低质量图片占位
    * `PhotoSwipe`: 是否启用图片灯箱模式
    * `imageCollage.enable`: 是否启用连续图片自动拼图（正文里连续放置的多张图片自动排成网格）
    * `imageCollage.maxColumns`: 拼图每行最多放几张图片（2 - 6，默认 4）；实际每行张数会按图片数量自动选择，最后一行的图片自动补满整行
    * `postCard.imageMode`: 首页文章卡片封面样式，`top` 为图片在内容上方，`background` 为图片作为卡片背景
    * `photoCover.enable`: 是否启用照片封面（首页第 1 页：整屏照片做背景，`Cover.title` 与 `Cover.subTitle` 居中并放大显示、叠一层黑色蒙版；向下滚动时标题平滑落回它自己的位置、字号缩回常规大小、颜色回到主题色。**其余所有页面**（分页第 2 页起、归档 / 关于 / 友链 / 文章）都会铺一层很淡的照片作为整页背景）
    * `photoCover.image`: 照片路径，以 `/` 开头相对 `public/` 目录，否则相对 `src/` 目录（如 `assets/cover.jpg`）；留空时按关闭处理。
    * `photoCover.mask`: 照片上黑色蒙版的浓度（0 - 1，默认 0.5），保证白色标题清晰，随滚动逐渐消退；照片很亮（日出、天空之类）时可以调高到 0.6 - 0.7
    * `overlayScrollbars.enable`: 是否用 [OverlayScrollbars](https://kingsora.github.io/OverlayScrollbars/) 替换浏览器默认的整页滚动条（悬浮样式，可自动隐藏）；关闭后回退到 `scrollbar.css` 里的原生滚动条样式
    * `overlayScrollbars.autoHide`: 滚动条什么时候隐藏，`never` 一直显示、`scroll` 滚动时才显示、`move` 指针移到页面上或滚动时显示、`leave`（默认）指针离开页面且不滚动时隐藏
    * `overlayScrollbars.size`: 滚动条粗细（像素，默认 8）；写在 `<html>` 的内联 CSS 变量上，改这里即时生效
    * > 接入范围是**整页滚动条 + 搜索结果列表**；代码块、目录面板、移动端导航横滑这些仍是浏览器原生滚动条（样式在 `src/styles/scrollbar.css`，已手工对齐成与悬浮滚动条一致的观感）
* `expressiveCode`
    * `enable`: 是否启用 [Expressive Code](https://expressive-code.com/)（
    * `theme`: 代码块的 Shiki 主题名，如 `one-dark-pro`（默认）、`github-dark`、`vitesse-dark`；深浅色模式共用同一套主题

> 后端项目参考 [Momo-backend](https://github.com/Motues/Momo-Backend) 进行部署，一定需要按照要求进行配置，尤其是跨域的域名认证

### `profileConfig`

* `avatar`: 头像，相对 `src/` 目录；以 `/` 开头时相对 `public/` 目录
* `name`: 名字，展示在页脚
* `description`: 描述，用于 SEO
* `indexPage`: 个人页面首页，展示在页脚
* `startYear`: 建站年份，用于页脚的版权年份区间

### `licenseConfig`

* `enable`: 是否启用 License，展示在文章的最后
* `name`: License 名称
* `url`: License 的 URL

### `friendLinkConfig`

* `name`: 友链名称
* `avatar`: 友链图标
* `url`: 友链 URL
* `description`: 友链描述，不需要时填空字符串

### `i18nConfig`

* `defaultLanguage`: 默认语言，同时决定 `astro.config.mjs` 的 `defaultLocale`（默认语言不会出现在 URL 前缀中）
* `supportedLanguages`: 支持的语言列表，同时决定 `astro.config.mjs` 的 `locales`
* `translations`: 各语言的 **Cover 文案**
    * `translations["zh-cn"].Cover` / `translations["en"].Cover`
    * `Cover.title`: 各页面的大标题，包含 `home`、`archive`、`about`、`friends`
    * `Cover.subTitle`: 各页面的副标题，同上；其中 `archive` 支持 `{count}` 占位符，会自动替换为文章总数

## 国际化（i18n）

国际化相关文件位于 `src/i18n/`：

* `key.ts`：`Translation` 接口，是翻译结构的唯一来源
* `language/zh-cn.ts`、`language/en.ts`：各语言的界面文案，字段必须与 `Translation` 一一对应
* `translation.ts`：`i18nit(lang)` 返回 `t(key, params)` 翻译函数，支持 `{name}` 形式的参数替换，缺失时回退默认语言

**各个页面的 Cover 文案（`cover.title` / `cover.subTitle`）已经移动到 `src/config.ts` 的 `i18nConfig.translations` 中**，`src/i18n/language/*.ts` 会直接引用它，因此修改首页、归档、关于、友链页的大标题和副标题时，请改 `src/config.ts`，不需要再改语言文件。
