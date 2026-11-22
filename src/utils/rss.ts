/**
 * RSS 订阅源的共用生成逻辑（SEO-01）。
 *
 * 静态输出不能用查询参数切语言，所以每个语言一个 feed：
 *   /rss.xml      —— 默认语言
 *   /<lang>/rss.xml —— 其它语言（见 src/pages/[...locale]/rss.xml.ts）
 *
 * 内容用 `content:encoded` 输出**全文**：阅读器里直接能读完，不用再跳回站内。
 * HTML 由 Astro 的 Container API 把同一条渲染管线跑一遍得到，和页面里的正文一致；
 * 里面的站内链接 / 图片地址会被改写成绝对地址（RSS 阅读器没有「当前页面」可参照）。
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

/**
 * 把正文 HTML 里的站内相对地址改成绝对地址：
 * `./cover.jpg`、`/images/a.png` 在阅读器里都没有可参照的页面地址。
 *
 * 顺手清掉两类只对站内有意义的东西：GitHub / 音乐卡片随 HTML 内联的 <script>
 * （阅读器里不会执行，留着只是一堆乱码），以及搜索锚点用的 data-search-* 属性。
 */
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
