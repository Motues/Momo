/**
 * /sitemap.xml —— 站点地图（含分页、文章发布时间与各语言 hreflang 对照）
 *
 * 手写而不是引入 @astrojs/sitemap：URL 由 `getBlogEntrySort` 与分页规则推导，
 * 与页面实际生成的路径严格一致，同时不给模板增加新依赖。
 */
import type { APIContext } from 'astro';
import { i18n } from 'astro:config/client';
import { siteConfig } from '@/config';
import { getBlogEntrySort } from '@utils/contentUtils';
import { absoluteUrl, bcp47, normalizePath } from '@utils/seo';
import { getRelativeLocaleUrl } from '@utils/urlUtils';

interface Entry {
  /** 语言无关路径，如 `/`、`/2/`、`/blog/xxx/` */
  rest: string;
  lastmod?: string;
  /** 各语言下的绝对地址 */
  alternates: { lang: string; loc: string }[];
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch] as string,
  );
}

function isoDate(value: Date | string | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}

export async function GET(_context: APIContext) {
  const locales = (i18n?.locales || [i18n?.defaultLocale]).map((l) =>
    typeof l === 'string' ? l : l.path,
  );
  const defaultLocale = i18n.defaultLocale;
  const entries = new Map<string, Entry>();

  const push = (rest: string, lastmod?: string) => {
    const existing = entries.get(rest);
    if (existing) {
      if (!existing.lastmod && lastmod) existing.lastmod = lastmod;
      return;
    }
    entries.set(rest, {
      rest,
      lastmod,
      alternates: locales.map((code) => ({
        lang: code,
        loc: absoluteUrl(normalizePath(getRelativeLocaleUrl(code, rest))),
      })),
    });
  };

  for (const locale of locales) {
    const posts = await getBlogEntrySort(locale);
    const totalPages = Math.max(1, Math.ceil(posts.length / siteConfig.pageSize));

    // 首页与分页
    push('/');
    for (let page = 2; page <= totalPages; page++) push(`/${page}/`);

    // 独立页面
    for (const page of ['/archives/', '/about/', '/friends/']) push(page);

    // 文章（404 不在站点地图里）
    for (const post of posts) push(`/blog/${post.id}/`, isoDate(post.data.pubDate));
  }

  const blocks: string[] = [];
  for (const entry of entries.values()) {
    const fallback = entry.alternates[0]?.loc || '';
    const xDefault = entry.alternates.find((a) => a.lang === defaultLocale)?.loc || fallback;
    const links = [
      ...entry.alternates.map(
        (a) => `    <xhtml:link rel="alternate" hreflang="${bcp47(a.lang)}" href="${escapeXml(a.loc)}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefault)}"/>`,
    ].join('\n');

    // 每个语言版本各占一条 <url>，并携带全部语言对照
    for (const alternate of entry.alternates) {
      blocks.push(
        [
          '  <url>',
          `    <loc>${escapeXml(alternate.loc)}</loc>`,
          entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
          links,
          '  </url>',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
