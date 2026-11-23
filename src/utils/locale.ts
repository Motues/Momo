/**
 * 当前语言的判定工具。路由是 URL 前缀制（`/` = 默认语言，`/en/...` = 英文），地址是唯一真源。
 * ⚠️ 不要依赖 `<html lang>`：swup 下它由 head 插件从新文档复制，换页后才更新。
 */
import { i18n } from 'astro:config/client';

/** 站点支持的语言代码（zh-cn / en ...），与 astro.config 的 i18n.locales 同源 */
const locales = i18n?.locales || ['zh-cn'];
export const LOCALES: string[] = locales.map((locale) =>
  typeof locale === 'string' ? locale : locale.path,
);

/** 默认语言（无前缀的那一个） */
export const DEFAULT_LOCALE: string = i18n?.defaultLocale || LOCALES[0] || 'zh-cn';

/** 从地址推导当前语言：`/en` 与 `/en/…` 命中 en，其余一律算默认语言 */
export function currentLangFromUrl(pathname: string = window.location.pathname): string {
  const hit = LOCALES.filter((code) => code !== DEFAULT_LOCALE).find(
    (code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`),
  );
  return hit ?? DEFAULT_LOCALE;
}

/** 把 `<html lang>` 拉正到地址对应的语言（与 swup head 插件幂等，不一致时以地址为准） */
export function syncDocumentLang(): void {
  const lang = currentLangFromUrl();
  if ((document.documentElement.lang || '').toLowerCase() !== lang.toLowerCase()) {
    document.documentElement.lang = lang;
  }
}
