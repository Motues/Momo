/**
 * RSS 订阅源的共用生成逻辑：每个语言一个 feed（`/rss.xml`、`/<lang>/rss.xml`）。
 * 条目用 `content:encoded` 输出全文，站内链接与图片改写成绝对地址。
 */
import rss from '@astrojs/rss';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { APIContext } from 'astro';
import { getBlogEntrySort } from './contentUtils';
import { profileConfig, siteConfig } from '@/config';
import { getSiteTitle } from './siteTitle';
import { absoluteUrl, bcp47, siteDescription } from './seo';
import { blogPostUrl } from './urlUtils';

/** 单个 feed 最多收录多少篇（只影响 XML 体积，全文很长） */
const MAX_ITEMS = 20;

/** 把正文 HTML 里的站内相对地址改成绝对地址，并清掉内联 <script> 与 data-search-* 属性 */
function absolutizeHtml(html: string, base: string): string {
    return html
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/\sdata-search-(?:anchor|heading)(?:="")?/g, '')
        .replace(/\s(src|href)="([^"]*)"/g, (match, attr: string, value: string) => {
            if (!value || /^(https?:|data:|mailto:|tel:|#)/i.test(value)) return match;
            try {
                return ` ${attr}="${new URL(value, base).href}"`;
            } catch {
                return match;
            }
        })
        .replace(/\ssrcset="([^"]*)"/g, (_match, set: string) => {
            const entries = set
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
                .map((entry) => {
                    const [url, ...descriptor] = entry.split(/\s+/);
                    try {
                        return [new URL(url, base).href, ...descriptor].join(' ');
                    } catch {
                        return entry;
                    }
                });
            return ` srcset="${entries.join(', ')}"`;
        });
}

export async function buildFeed(context: APIContext, lang: string) {
    const posts = (await getBlogEntrySort(lang)).slice(0, MAX_ITEMS);
    const container = await AstroContainer.create();

    const items = [];
    for (const post of posts) {
        const link = blogPostUrl(lang, post.id);
        const pageUrl = absoluteUrl(link);

        let content = '';
        try {
            const { Content } = await render(post);
            content = absolutizeHtml(await container.renderToString(Content), pageUrl);
        } catch (error) {
            // 单篇渲染失败不影响整个 feed：退化成摘要（description）
            console.warn(`[rss] 正文渲染失败，仅输出摘要：${post.id}`, error);
        }

        items.push({
            title: post.data.title,
            pubDate: post.data.pubDate,
            description: post.data.description,
            content,
            categories: post.data.category ? [post.data.category] : undefined,
            link,
        });
    }

    const site = context.site ?? siteConfig.rootSiteUrl ?? 'https://momo.motues.top';
    const selfUrl = new URL(context.url.pathname, site).href;
    // 站点最近一次更新的时间：没有文章时退回构建时间
    const lastBuild = posts[0]?.data.pubDate ?? new Date();

    return rss({
        title: getSiteTitle(),
        description: siteDescription(lang) || profileConfig.description,
        site,
        items,
        xmlns: { atom: 'http://www.w3.org/2005/Atom' },
        customData: [
            `<language>${bcp47(lang)}</language>`,
            `<lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>`,
            `<atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>`,
        ].join(''),
        trailingSlash: true,
    });
}
