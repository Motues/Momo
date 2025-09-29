import rss from "@astrojs/rss";
import { getBlogEntrySort } from "../utils/content-utils"
import { siteConfig } from '../config';
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
    const blog = await getBlogEntrySort();
    return rss({
        title: siteConfig.title,
        description: siteConfig.subTitle,
        site: context.site ?? "https://blog.motues.top",
        items: blog.map((post) => ({
            title: post.data.title,
            pubDate: post.data.pubDate,
            description: post.data.description,
            // 从 `id` 属性计算出 RSS 链接
            // 这个例子假设所有的文章都被渲染为 `/blog/[id]` 路由
            link: `/blog/${post.id}/`,
        })),
    })
}