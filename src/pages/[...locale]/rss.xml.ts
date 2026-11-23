import type { APIContext, GetStaticPaths } from 'astro';
import { i18n } from 'astro:config/client';
import { buildFeed } from '../../utils/rss';

/** 其它语言的订阅源：/en/rss.xml，除默认语言外每种语言各生成一个路由 */
export const getStaticPaths = (() => {
    const defaultLocale = i18n!.defaultLocale;
    return i18n!.locales
        .map((locale) => (typeof locale === 'string' ? locale : locale.path))
        .filter((locale) => locale !== defaultLocale)
        .map((locale) => ({ params: { locale } }));
}) satisfies GetStaticPaths;

export async function GET(context: APIContext) {
    const lang = context.params.locale || i18n!.defaultLocale;
    return buildFeed(context, lang);
}
