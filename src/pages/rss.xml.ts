import rss from "@astrojs/rss";
import { getBlogEntrySort } from "../utils/contentUtils"
import { i18nConfig, profileConfig } from '../config';
import { getSiteTitle } from "../utils/siteTitle";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
    const blog = await getBlogEntrySort();
    return rss({
        title: getSiteTitle(),
        description: profileConfig.description,
        site: context.site ?? "https://momo.motues.top",
        // 订阅源只包含默认语言的文章，显式声明语言便于阅读器正确处理
        customData: `<language>${i18nConfig.defaultLanguage}</language>`,
        items: blog.slice(0, 20).map((post) => ({
            title: post.data.title,
            pubDate: post.data.pubDate,
            description: post.data.description,
            categories: post.data.category ? [post.data.category] : undefined,
            // 从 `id` 属性计算出 RSS 链接
            // 这个例子假设所有的文章都被渲染为 `/blog/[id]` 路由
            link: `/blog/${post.id}/`,
        })),
    })
}