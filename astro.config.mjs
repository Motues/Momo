// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import icon from 'astro-icon';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkDirective from 'remark-directive';
import rehypeComponents from "rehype-components";

import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";


// https://astro.build/config
export default defineConfig({
  site: 'https://momo.motues.top', // Root URL of site
  i18n: {
    locales: ['zh-cn', 'en'],
    defaultLocale: 'zh-cn',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  },
  integrations: [
    icon({
      include: {
        "fa6-brands": ["*"],
        "fa6-solid": ["*"],
        "simple-icons": ["*"],
        "vscode-icons": ["*"],
        "material-symbols": ["*"]
      }
    })
  ],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro', // code theme
      // theme: 'github-dark',
      wrap: false
    },
    remarkPlugins: [
      remarkMath,
      remarkDirective,
      parseDirectiveNode
    ],
    rehypePlugins: [
      rehypeKatex,
      [
				rehypeComponents,
				{
					components: {
						note: (x, y) => AdmonitionComponent(x, y, "note"),
						tip: (x, y) => AdmonitionComponent(x, y, "tip"),
						important: (x, y) => AdmonitionComponent(x, y, "important"),
						caution: (x, y) => AdmonitionComponent(x, y, "caution"),
						warning: (x, y) => AdmonitionComponent(x, y, "warning"),
					},
				},
			],
    ]
  },

  vite: {
    plugins: [tailwindcss()]
  }
});