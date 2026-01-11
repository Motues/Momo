import rss from "@astrojs/rss";
import { getBlogEntrySort } from "../utils/content-utils"
import { siteConfig, profileConfig } from '../config';
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
    const blog = await getBlogEntrySort();
    return rss({
        title: `${siteConfig.title} - ${siteConfig.subTitle}`,
        description: profileConfig.description,
        site: context.site ?? "https://momo.motues.top",
        items: blog.slice(0, 20).map((post) => ({
            title: post.data.title,
            pubDate: post.data.pubDate,
            description: post.data.description,
            // 从 `id` 属性计算出 RSS 链接
            // 这个例子假设所有的文章都被渲染为 `/blog/[id]` 路由
            link: `/blog/${post.id}/`,
        })),
    })
}