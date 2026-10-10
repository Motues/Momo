---
title: 更新指南和版本记录
pubDate: '2026-01-01'
description: 网站配置
category: 指南
image: ./images/banner.png
draft: false
slugId: momo/intro/release
pinTop: 1
---

该项目目前仍处于维护中，如果需要更新，请按照以下步骤进行：

首先在 `package.json` 中确认版本号，或者在这里或 [Release](https://github.com/Motues/Momo/releases) 中查看改动记录。

当只有项目的配置文件的结构修改后，才会对项目的版本号进行修改。项目配置文件即和网站布局内容相关的文件，包括`astro.config.mjs`、`src/config.ts`、`src/content.config.ts`、`src/i18n/`文件夹下的文件。

`src/content/`、`src/assets` 、`public` 文件夹下存放博客文字、图片等内容。

## 使用脚本更新

可以直接克隆本项目，然后将自己原本的配置文件覆盖到新项目，然后运行 `pnpm install` 安装依赖，然后运行 `pnpm build` 本地编译，然后运行 `pnpm preview` 预览编译后的项目。

在本仓库内更新时，可以直接执行 `pnpm momo update`：它会读取 [Release](https://github.com/Motues/Momo/releases) 里的最新版本，与 `package.json` 的版本号对比后下载该版本源码，**保留你自己的文章与图片**（`src/content`、`src/assets`、`public`）和 `src/config.ts`，覆盖其余代码，**删除新版本已经移除的旧文件**并安装依赖，最后列出本次更新中**需要手工合并的配置文件**。

## 版本号改变

每次版本号改变时，都会在这里更新的改动记录。更新需要参考具体的记录修改对应的配置文件。

下面是一般修改建议。

* **`astro.config.mjs` 修改**：一般直接覆盖即可，其中的 `site` 与 `i18n` 会自动读取 `src/config.ts` 的 `siteConfig.rootSiteUrl`、`i18nConfig.defaultLanguage`、`i18nConfig.supportedLanguages`
* **`config.ts` 修改**：需要按照要求更新填写 `config.ts` 中新添加或修改的配置信息
* **`content.config.ts` 修改**：一般为文章添加了新的 frontmatter 配置，需要按照要求对文章添加新的配置项
* **`src/i18n/` 修改**：一般为添加了新的国际化翻译，直接覆盖即可。注意各页面的 Cover 文案（`cover.title` / `cover.subTitle`）已迁移到 `src/config.ts` 的 `i18nConfig.translations` 中，请在那里修改为自己的信息

## 版本信息

> 版本号采用 `YY.MM.DD` 的格式

### 26.10.10

* **评论无感验证升级**：静默校验改用 HashWX（WebAssembly）工作量证明、多线程并行求解，并新增一层随机小程序的「环境质询」，验证更快、脚本伪造更难；访客照旧不用点选图片、不用输验证码。**本次需同步升级评论后端**（[Momo-Backend](https://github.com/Motues/Momo-Backend)），后端协议过旧时评论区会直接提示升级
* **验证失败的提示更明确**：区分「浏览器版本过低，不支持验证」与「验证服务版本过旧，请联系博主升级」，不再一律显示「验证失败」让访客白点重试
* **本地 CMS 配置页新增悬浮目录栏**：右侧贴边列出各配置分区，点击平滑滚动到位、滚动时自动高亮当前分区，可随时收起，窄窗口默认收起；「主题与动效」按语义分组，找配置不用一路滚
* **CMS 的下拉框换成自研组件**：外观与站内风格统一，不再被工具栏 / 弹窗裁切或压住，贴近屏幕底部时自动向上展开；键盘（↑↓ / Home / End / 回车 / Esc / 首字母跳转）与触屏都能用
* **CMS 编辑页支持自动保存**：每 60 秒把有改动的文章自动保存一次，顶栏显示「已自动保存 HH:MM」，不弹窗、不重建编辑器，光标位置与撤销记录都不受影响
* **修复**：图片灯箱关闭时不再直接闪退——缩略图已滚出视口时改为朝它所在的方向飞回；打开灯箱时聚焦关闭按钮不再把页面顶上几像素；搜索弹窗打开时锁住整页滚动，滚轮不再穿透到后面的页面
* 本次更新改动了配置文件 `src/i18n/`（评论新增 `comments.verifyUnsupported` / `comments.verifyBackendOutdated` 文案），覆盖后请按提示合并；所用 HashWX 组件以 LGPL-3.0 分发，来源与许可证见新增的 `THIRD_PARTY_NOTICES.md`

### 26.10.8

* **评论支持无感验证**：开启后访客在后台静默完成人机校验，不用点选图片、不用输验证码，通过后正常提交评论；校验在后台分批执行，输入框与页面滚动不受影响。由评论后端下发开关决定是否启用，前端无需配置，后端未开启时评论区与之前完全一样
* **评论区更稳更安全**：作者主页链接只放行 `http` / `https` / `mailto` 协议，历史数据里的 `javascript:` 链接不再被渲染成可点击地址；预览与正文统一经 DOMPurify 消毒；浏览器禁用站点存储（无痕 / 隐私模式）时不再报错中断，草稿与输入框照常；提交评论后列表改为静默刷新，不再整块被「正在加载评论...」顶掉
* **`pnpm momo update` 自动挑选最快的下载源**：并行探测 GitHub 直连与公共镜像并按实测速度选择，超时或镜像返回错误内容时自动换源，国内直连 GitHub 超时无需额外配置；可用新增的 `--mirror <镜像前缀>` 或环境变量 `MOMO_MIRROR` 指定镜像，`--mirror direct` 强制只用直连，下载过程显示单行进度
* **蓝色重新调过**：浅色链接色由近乎发黑的深蓝改为明亮的主题蓝，标题悬停变色终于看得出来；蓝色「当底色压字」与「当链接文字」拆成两套颜色，深色模式下蓝底白字由 2.48:1 提到 7.22:1（404 主按钮、归档页与移动端抽屉里选中的分类胶囊），脚注跳转高亮也改成淡蓝底，不再让文字压在同色上
* **顶栏毛玻璃更透**：桌面端导航胶囊的底色由 65% 实心降到 15%，接近无色玻璃（描边、阴影与模糊不变）
* **首页滚动箭头重做**：去掉圆形描边与底色只留箭头并放大，改为缓慢的呼吸式跳动，悬停时放大并带一层白色柔光
* **修复**：关闭图片灯箱时改为飞回当前正在看的那张缩略图（此前切过图会飞向打开时点的那张）；代码块复制按钮在手机与触摸设备上不再放大常显，收回桌面端尺寸；右下角悬浮菜单的毛玻璃不再等弹出动画结束才出现
* 本次更新改动了配置文件 `src/i18n/`（评论新增 `comments.verifying` / `verifySuccess` / `verifyFailed` / `verifyRetry` / `adminKey` / `adminKeyPlaceholder` 文案），另外两份 README 同步说明，覆盖后请按提示合并

### 26.10.1

> 国庆快乐！

* **新增照片封面**：首页第 1 页用一整屏照片做背景，`Cover` 标题与副标题居中放大、叠一层可调的黑色蒙版；向下滚动时标题平滑落回原位、字号与颜色复原，照片淡成底色。分页第 2 页起与归档 / 关于 / 友链 / 文章页都会铺一层很淡的照片作为整页背景，照片的模糊底图由构建期自动生成，不用自己准备小图
* **站内跳转不再整页刷新**：改用 [swup](https://swup.js.org/) 接管客户端路由，保留原来的淡入淡出观感，新增悬停预取与「前进 / 后退回到原位置」；换页时顶栏 / 页脚 / 搜索弹窗不再重建，语言菜单、导航选中态自动跟随地址更新
* **主页面滚动条换成 [OverlayScrollbars](https://kingsora.github.io/OverlayScrollbars/)**：悬浮在内容之上、可自动隐藏，支持拖动手柄与点击轨道跳转，深浅色跟随主题；搜索结果列表也一并用上
* **桌面端导航胶囊改版**：顶部只留文字与当前页色块，吸顶后淡入描边与毛玻璃；照片封面下不再「滚一像素就硬切」，而是跟着滚动进度平滑过渡
* **移动端侧边栏支持当前页高亮与分类筛选**：当前页有底色与主题色；分类标签可点选筛选归档页，再点一次取消筛选
* **正文链接样式优化**：下划线更细并略微上提，悬停时连同下划线一起变为主题蓝；新标签页链接的右上箭头图标换小一圈、跟随链接变色
* **新增配置项** `siteConfig.theme.photoCover`（开关 / 照片路径 / 蒙版浓度）与 `siteConfig.theme.overlayScrollbars`（开关 / 隐藏时机 / 粗细），在 `src/config.ts` 或 CMS 的「主题与动效」里都能改；新增文案 `button.scrollDown`
* **CLI**：`pnpm momo update` 会顺带清掉新版本里已移除的旧文件（加 `--no-delete` 可只覆盖不删除），`pnpm momo clean` 补上 `node_modules/.astro`，`pnpm momo doctor` 会提示残留的 `<ClientRouter />`
* 修掉了一批只有客户端换页才会暴露的问题：浏览器后退失效、换页后顶栏字体闪一下、目录与顶栏高亮不同步、控制台告警等
* 本次更新改动了配置文件 `astro.config.mjs`（客户端换页改用 swup）、`src/config.ts`（两个新主题开关）与 `src/i18n/`（新文案 `button.scrollDown`），覆盖后请按提示合并

### 26.9.29

* 新增**新标签页链接语法**：在链接后面紧跟 `{target="_blank"}` 即在新标签页打开，并在链接后面追加一个右上箭头图标；只识别 `target` / `rel` / `class` 三个属性，`rel` 始终保留 `noopener` / `noreferrer`，链接里只有图片时不加图标
* **正文链接样式重做**：链接日常显示细实线下划线，悬停时连同下划线变为主题蓝并略微透明，链接颜色跟随所在容器（引用块、彩虹文字等自带颜色的语法优先）
* **图片灯箱缩放优化**：桌面端打开时默认 86%，移动端保持 100%，双击 / 切图 /「默认比例」按钮都回到这个基准；飞入飞回改用未缩放、未平移的原始框计算，起点与缩略图完全重合；放大状态下切图不再先跳回默认比例
* `src/plugins/` 下的 remark / rehype 插件**全部由 `.mjs` 改为 `.ts`**（补齐类型、精简注释），插件之间的相对导入要写显式 `.ts` 扩展名；CMS 预览由 Node 原生加载 `.ts`，因此需要 **Node ≥ 22.18**
* 移除已废弃的 `script/newpost.js` 与 `pnpm newpost` 脚本（它写出的 frontmatter 使用早已过期的 `date` / `slug` 字段，新建文章请改用 `pnpm momo new` 或 CMS）
* 本次更新对配置文件 `astro.config.mjs`（插件 import 改为 `.ts`）与 `package.json`（新增 `@types/hast`、`@types/mdast`、`@types/unist`、`@types/node`、`vfile` 开发依赖，移除 `newpost` 脚本）进行了修改，覆盖后运行 `pnpm install`，并删除 `src/plugins/` 里残留的 `.mjs` / `.js` 文件

### 26.9.27

* 图片拼图的行高改为**按行计算**：由该行最宽（宽高比最大）的图片决定并让它完整显示，同行的其它图片按这个高度裁切
* 拼图**不再显示图片下方的图注**，灯箱改为读取图片的 `title` 作为说明文字
* 拼图在构建时读取图片宽高比：相对路径与 `/public` 路径直接读文件，网络图片只抓头部字节（最多 512 KB、超时 5 秒、并发 6），失败时用同行其它图片定行高
* **图片灯箱支持缩小到 50%**，到达 50% 或 800% 时对应按钮置灰
* `pnpm momo update` 不再更新 `.github`、`.vscode`、`.idea`
* 修复封面图片使用大写后缀（如 `.JPG`）时找不到图片的问题
* 本次更新仅 `astro.config.mjs` 有改动（拼图新增 `public` 目录定位），直接覆盖即可

### 26.9.26

* 新增**连续图片自动拼图**：正文里连续放置的多张图片会自动排成网格，点击仍由灯箱打开大图
* `pnpm momo update` 改为**基于 GitHub Release 更新**，不再依赖本地 git，并保留你自己的文章、图片与 `src/config.ts`
* 前端流畅度优化：优化首页阻塞样式表，修复事件监听器成倍累积与客户端跳转后入场动画失效等问题
* 新增 `pnpm momo audit` 命令，用于复测构建产物的首屏开销
* CMS 的「网站配置」页新增拼图开关与每行上限
* 本次更新对配置文件 `src/config.ts` 进行了修改，添加了 `theme.imageCollage` 字段，更新时需要添加新的字段；其余文件直接覆盖即可

### 26.9.25

* 代码块改用官方的 **Expressive Code** 集成，支持标题栏、行高亮、diff 标记、行号、折叠代码段与复制按钮，开关与代码主题在 `src/config.ts` 的 `siteConfig.expressiveCode` 中配置
* 图片灯箱改为自研实现（不再依赖 `photoswipe`）：滚轮 / 按钮 / 双击 / 双指缩放、拖拽平移、方向键或左右滑动切换，Esc 关闭，打开与关闭带飞入飞出动画
* CMS 新增「网站配置」页面（`#/config`），可视化修改 `src/config.ts`；归档页改为服务端渲染
* SEO 增强：canonical、hreflang 多语言对照、Open Graph / Twitter Card、结构化数据、`sitemap.xml`、`robots.txt`
* 本次更新对配置文件 `astro.config.mjs` 进行了修改，新增配置文件 `ec.config.mjs`，并对 `src/config.ts` 添加了 `siteConfig.expressiveCode` 字段；同时调整了依赖（新增 `astro-expressive-code`，移除 `photoswipe`），更新时需要添加对应字段并运行 `pnpm install`

### 26.9.10

> 本次更新包含**破坏性配置变更**，请仔细阅读下面的更新说明！

* 统一配置文件 `config.ts`，统一管理默认语言、支持语言与各页面的 Cover 文案等
* 新增命令行工具 `pnpm momo`，支持备份配置，恢复，更新等功能
* 404 页面重新设计；页脚图标间距微调
* 统一工具函数的命名方式
* 更新 CMS 管理后台，修复读取文章信息慢的问题，文章列表支持列宽按内容自适应
* 本次更新对配置文件 `src/config.ts`、`src/i18n/language/*.ts`、`astro.config.mjs` 进行了修改：
    * `src/config.ts`：新增 `i18nConfig`，并为 `siteConfig` 添加 `rootSiteUrl`
    * `src/i18n/language/*.ts`：删除原 `cover` 字段，从 `config.ts` 中引用
    * `astro.config.mjs`：`site`、`i18n` 改为引用 `src/config.ts` 的配置
* 升级后需要清除本地缓存（`node_modules`、`.astro`、`dist`）再重新 `pnpm install`，可执行 `pnpm momo clean --all` 快速完成

### 26.8.15

> 本次更新具有破坏性更新，请仔细阅读下面的更新说明！

* 本次更新将项目从 Astro5 升级至 Astro7，旧版本已经归档至 `v5` 分支，且后续不再维护
* Astro7 要求 Node.js 版本 >= 22，建议使用 24 LTS 版本。升级后需要清除本地缓存（`/node_modules` 等文件夹），才可以进行本地编译和预览
* 本次修改对配置文件 `content.config.ts`，`astro.config.mjs` 进行修改
* 在升级后遇到任何问题欢迎提交 issue 进行反馈

### 26.8.12

* 首页文章卡片支持两种图片展示样式，并适配移动端
* 修复单语言情况下隐藏语言选择按钮问题
* 本次更新对配置文件 `config.ts` 进行了修改，添加了 `theme.postCard` 字段，更新时需要添加新的字段

### 26.6.2

* 评论组件支持博主徽章标识和管理员评论，支持分页加载更多评论，多条回复折叠等功能
* 添加脚注样式支持
* 修复页面切换时的颜色闪烁问题，优化部分UI
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`comments.verificationRequired` 等字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.5.6

* 添加 `LQIP` 低质量图像占位符功能
* 增加新的 Markdown 样式支持：++下划线语法++
* 添加样式配置选项
* 本次更新对配置文件 `astro.config.mjs` 进行了修改，引入 `remarkLqip` 插件；对配置文件 `config.ts` 进行了修改，添加了 `theme.LQIP` 等字段，更新时需要添加新的字段

### 26.5.3

* 添加评论回复预览功能
* 增强评论内容安全性
* 修复 `astro.config.mjs` 类型错误
* 本次更新对配置文件 `astro.config.mjs` 进行了修改，修改 `AdmonitionComponent` 导入方式，需要修改对应改动

### 26.4.27

* 评论系统支持 Markdown 语法
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`comments.write` 等字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.4.21

* 添加 AOS 动效开关配置
* 评论系统支持 Twikoo
* 本次更新对配置文件 `config.ts` 进行了修改，添加了 `theme.AOS` 和 `comments.platform` 字段，更新时需要添加新的字段

### 26.4.15

* 添加文章置顶功能
* 更新音乐卡片 API 地址
* 修复部分样式问题
* 本次更新对配置文件 `astro.config.mjs` 进行了修改，添加了新的依赖 `@iconify-json/fluent`，需要添加对应字段，并运行 `pnpm install`

### 26.4.7

* 修改翻译错误
* 修改选中文本的颜色
* 修改 Mucis Card 的 API 地址
* 本次更新对配置文件 `src/i18n/language/en.ts` 进行了修改，修改了`themeInfo.system` 字段，其余字段保持不变；更新时只需要修改变化的字段即可

### 26.3.29

* 更新评论数据结构，适配新版本的评论后台
* 优化评论在移动端的样式
* 修复归档页面分类菜单样式错位的问题
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`comments.replyTo` 字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.3.17

* 修改评论头像的样式为圆形
* 调整部分组件的边距
* 本次更新对配置文件 `src/i18n/` 进行了修改，增加了`themeInfo` 字段，其余字段保持不变；修改时只需要添加新的字段即可

### 26.3.11

* 首次发布版本号 `26.3.11`
* 对项目多处进行修改，包括：优化移动端体验、对网站色彩进行统一
* 本次更新对配置文件 `src/i18n/` 进行了修改，建议使用最新的版本，然后修改 `cover.title` 和 `cover.subtitle` 字段为自己的信息
