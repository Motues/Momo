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
import { rehypeImageCollage } from "./src/plugins/rehype-image-collage.mjs";
import { remarkCombined } from './src/plugins/remark-combined.mjs';
import { remarkTypst } from './src/plugins/remark-typst.mjs';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';
import { remarkLqip } from './src/plugins/remark-lqip.js';

import svelte from "@astrojs/svelte";

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
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
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
        [rehypeImageCollage, {
          enable: collageSettings.enable !== false,
          maxColumns: collageSettings.maxColumns ?? 4
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