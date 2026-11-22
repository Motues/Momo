import type { APIContext } from 'astro';
import { i18nConfig } from '../config';
import { buildFeed } from '../utils/rss';

/** 默认语言的订阅源：/rss.xml */
export async function GET(context: APIContext) {
    return buildFeed(context, i18nConfig.defaultLanguage);
}
