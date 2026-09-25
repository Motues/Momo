/**
 * /robots.txt —— 爬虫规则（动态生成，站点地址始终跟随 src/config.ts 的 rootSiteUrl）
 */
import type { APIContext } from 'astro';
import { absoluteUrl } from '@utils/seo';
import { baseUrl } from '@utils/urlUtils';

export function GET(_context: APIContext) {
  const lines = [
    'User-agent: *',
    'Allow: /',
    // 搜索索引资源对爬虫没有价值，避免浪费抓取配额
    `Disallow: ${baseUrl('/pagefind/')}`,
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
