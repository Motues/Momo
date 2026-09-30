// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from "@tailwindcss/vite";
import icon from 'astro-icon';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkDirective from 'remark-directive';
import rehypeComponents from "rehype-components";

import { admonition } from "./src/plugins/rehype-component-admonition.ts";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.ts";
import { MusicCardComponent } from "./src/plugins/rehype-component-music-card.ts";
import { GithubCardComponent } from './src/plugins/rehype-component-github-card.ts';
import { QuoteComponent } from "./src/plugins/rehype-component-quote.ts"
import { customFigurePlugin } from "./src/plugins/rehype-figure-plugin.ts";
import { rehypeLinkTarget } from "./src/plugins/rehype-link-target.ts";
import { rehypeImageCollage } from "./src/plugins/rehype-image-collage.ts";
import { remarkCombined } from './src/plugins/remark-combined.ts';
import { remarkTypst } from './src/plugins/remark-typst.ts';
import { remarkReadingTime } from './src/plugins/remark-reading-time.ts';
import { remarkLqip } from './src/plugins/remark-lqip.ts';

import svelte from "@astrojs/svelte";
import swupIntegration from '@swup/astro';

const swup =
  /** @type {(options: Omit<NonNullable<Parameters<typeof swupIntegration>[0]>, 'accessibility' | 'smoothScrolling'> & Record<string, unknown>) => import('astro').AstroIntegration} */
  (swupIntegration);

import { siteConfig, i18nConfig } from './src/config';

import expressiveCode from "astro-expressive-code";
import { ecThemeOptions } from "./ec.config.mjs";

const ecSettings = siteConfig.expressiveCode ?? {};
const ecEnabled = ecSettings.enable !== false;
const collageSettings = siteConfig.theme?.imageCollage ?? {};

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
  swup({
    theme: false, 
    animationClass: 'transition-swup-',  // ⚠️ 不能是默认的 transition-（会命中 Tailwind 的 transition-all）
    containers: ['main#swup-container'],
    loadOnIdle: true,
    cache: true,
    preload: true,
    accessibility: {
      announcements: {
        'zh-CN': '已导航至：{title}',
        en: 'Navigated to: {title}',
        '*': 'Navigated to: {title}',
      },
    },
    updateHead: true, 
    updateBodyClass: false, 
    globalInstance: true, 
    smoothScrolling: { animateScroll: false },
    reloadScripts: true, 
    ignore: [
      /\.xml$/i, 
      /\.pdf$/i,
      /^\/cms/, 
      'a[download]',
      '[data-no-swup]',
    ],
  }),
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
        // [文字](url){target="_blank"}：新标签页打开 + 右上箭头图标
        rehypeLinkTarget,
        [rehypeImageCollage, {
          enable: collageSettings.enable !== false,
          maxColumns: collageSettings.maxColumns ?? 4,
          publicDir: fileURLToPath(new URL('./public/', import.meta.url))
        }],
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