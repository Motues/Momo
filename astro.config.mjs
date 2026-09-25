// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from "@tailwindcss/vite";
import icon from 'astro-icon';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkDirective from 'remark-directive';
import rehypeComponents from "rehype-components";

import { admonition } from "./src/plugins/rehype-component-admonition.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { MusicCardComponent } from "./src/plugins/rehype-component-music-card.mjs";
import { GithubCardComponent } from './src/plugins/rehype-component-github-card.mjs';
import { QuoteComponent } from "./src/plugins/rehype-component-quote.mjs"
import { customFigurePlugin } from "./src/plugins/rehype-figure-plugin.mjs";
import { remarkCombined } from './src/plugins/remark-combined.mjs';
import { remarkTypst } from './src/plugins/remark-typst.mjs';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';
import { remarkLqip } from './src/plugins/remark-lqip.js';

import svelte from "@astrojs/svelte";

import { siteConfig, i18nConfig } from './src/config';

// 代码块由 Expressive Code 官方集成渲染（标题栏 / 行高亮 / diff / 行号 / 折叠…）
// 开关与主题在 src/config.ts 的 siteConfig.expressiveCode 里配置，
// 其余选项见根目录 ec.config.mjs（CMS 预览复用同一份配置）
import expressiveCode from "astro-expressive-code";
import { ecThemeOptions } from "./ec.config.mjs";

// 兜底：旧版 src/config.ts 里可能还没有 expressiveCode 字段
const ecSettings = siteConfig.expressiveCode ?? {};
const ecEnabled = ecSettings.enable !== false;

// https://astro.build/config
export default defineConfig({
  site: siteConfig.rootSiteUrl || 'https://momo.motues.top', // Root URL of site
  i18n: {
    locales: i18nConfig.supportedLanguages,
    defaultLocale: i18nConfig.defaultLanguage,
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  },
  integrations: [icon({
    include: {
      "fa6-brands": ["*"],
      "fa6-solid": ["*"],
      "simple-icons": ["*"],
      "vscode-icons": ["*"],
      "material-symbols": ["*"],
      "fluent": ["*"],
    }
  }), svelte(),
  // Expressive Code 开关：siteConfig.expressiveCode.enable
  ...(ecEnabled ? [expressiveCode({
    ...ecThemeOptions(ecSettings),
    getBlockLocale: ({ file }) => {
      const match = /(?:^|[\\/])([a-z]{2}(?:-[a-z]{2})?)\.md$/i.exec(file?.path || '');
      if (!match) return undefined;
      const code = match[1].toLowerCase();
      return code === 'zh-cn' ? 'zh-CN' : code;
    }
  })] : [])],
  markdown: {
    // 关闭 Expressive Code 时不做语法高亮，代码块回退为纯文本
    ...(ecEnabled ? {} : { syntaxHighlight: false }),
    processor: unified({
      remarkPlugins: [
        remarkMath,
        remarkReadingTime,
        remarkDirective,
        remarkTypst,
        parseDirectiveNode,
        remarkCombined,
        [remarkLqip, { enable: siteConfig.theme.LQIP }],
      ],
      rehypePlugins: [
        rehypeKatex,
        customFigurePlugin,
        [
          rehypeComponents,
          {
            components: {
              github: GithubCardComponent,
              music: MusicCardComponent,
              quote: QuoteComponent,
              note: admonition("note"),
              tip: admonition("tip"),
              important: admonition("important"),
              caution: admonition("caution"),
              warning: admonition("warning"),
            },
          },
        ],
      ]
    })
  },
  vite: {
    plugins: [tailwindcss()]
  }
});