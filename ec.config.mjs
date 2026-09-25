// ec.config.mjs — Expressive Code（官方实现）配置
//
// 这个文件会被 astro-expressive-code 自动加载（博客），同时也由
// cms/server/preview.mjs 直接 import（CMS 实时预览），保证两边渲染完全一致。
//
// 注意：主题与开关不在这里，而在 src/config.ts 的 siteConfig.expressiveCode 中配置，
// 博客与 CMS 预览都会调用下面导出的 ecThemeOptions() 把它转换成 Expressive Code 的选项
//（不调用的话，Expressive Code 会使用内置的 github-dark + github-light 双主题）。
//
// 支持的写法（写在代码围栏的信息串里）：
//   ```js title="src/app.js" {3-5} showLineNumbers startLineNumber=10
//   ```js ins={2} del={1}          // diff 标记
//   ```bash frame="terminal"        // 终端窗口（三个圆点）
//   ```js collapse={6-20} wrap      // 折叠 + 自动换行
//   ```js frame="none"              // 不显示标题栏
import { pluginCollapsibleSections, pluginCollapsibleSectionsTexts } from '@expressive-code/plugin-collapsible-sections'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'

// EC 内置文案只有英文与德文，这里补一份中文（折叠提示）
// 具体用哪个语言由 getBlockLocale 决定，见 astro.config.mjs 与 cms/server/preview.mjs
pluginCollapsibleSectionsTexts.addLocale('zh-CN', {
  collapsedLines: '已折叠 {lineCount} 行',
})

// src/config.ts 里没有配置主题时的兜底（旧版配置文件）
export const DEFAULT_EC_THEME = 'one-dark-pro'

// 把 src/config.ts 的 siteConfig.expressiveCode 转成 Expressive Code 的选项。
// 博客（astro.config.mjs）与 CMS 预览（cms/server/preview.mjs）都必须调用它，
// 这样代码主题只在 src/config.ts 里配置一处。
export function ecThemeOptions(settings) {
  return { themes: [settings?.theme || DEFAULT_EC_THEME] }
}

/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
export default {
  // Expressive Code 的可选插件：折叠代码段、行号
  plugins: [pluginCollapsibleSections(), pluginLineNumbers()],

  // 默认关闭自动换行与行号，需要时在代码块信息串里单独开启
  // （改完本文件后若效果没变化，先清缓存：pnpm momo clean）
  defaultProps: {
    wrap: false,
    showLineNumbers: false,
  },

  frames: {
    // 代码里带文件路径注释时（如 // src/app.js）自动作为标题
    extractFileNameFromCode: true,
  },

  styleOverrides: {
    // 与站点正文的代码字体保持一致（@fontsource-variable/jetbrains-mono）
    codeFontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
    codeFontSize: '0.9rem',
    borderRadius: '8px',
  },
}
