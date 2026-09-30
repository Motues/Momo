/**
 * 当前语言的判定工具。
 *
 * 路由是 URL 前缀制（`/` = 默认语言，`/en/...` = 英文），所以**地址本身**就是
 * 语言的稳定真源。不要再依赖 `<html lang>`：
 *   - swup 下 `<html>` 是持久的，lang 由 @swup/head-plugin 从新文档复制过来
 *     （只在真实换页之后才会更新，首屏 / updateHead 关闭 / 裸 swup 都不成立）；
 *   - 顶栏在容器之外不会重建，语言菜单的链接与高亮必须在每次换页后按地址重算。
 */
import { i18n } from 'astro:config/client';

/** 站点支持的语言代码（zh-cn / en ...），与 astro.config 的 i18n.locales 同源 */
const locales = i18n?.locales || ['zh-cn'];
export const LOCALES: string[] = locales.map((locale) =>
  typeof locale === 'string' ? locale : locale.path,
);

/** 默认语言（无前缀的那一个） */
export const DEFAULT_LOCALE: string = i18n?.defaultLocale || LOCALES[0] || 'zh-cn';

/**
 * 从地址推导当前语言。
 * 只看带前缀的语言：`/en` 与 `/en/...` 命中 en，其余一律算默认语言。
 */
export function currentLangFromUrl(pathname: string = window.location.pathname): string {
  const hit = LOCALES.filter((code) => code !== DEFAULT_LOCALE).find(
    (code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`),
  );
  return hit ?? DEFAULT_LOCALE;
}

/**
 * 把 `<html lang>` 拉正到地址对应的语言。
 * 与 swup head 插件的行为幂等（双保险）——插件更新 `<html lang|dir>` 只是
 * 「顺带」，地址才是真源；两者不一致时以地址为准。
 */
export function syncDocumentLang(): void {
  const lang = currentLangFromUrl();
  if ((document.documentElement.lang || '').toLowerCase() !== lang.toLowerCase()) {
    document.documentElement.lang = lang;
  }
}
