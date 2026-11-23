import { siteConfig } from "@/config";

/** 站点的完整标题（浏览器标签栏 / RSS 使用）：subTitle 为空时只返回主标题，不留多余分隔符 */
export function getSiteTitle(): string {
    const { title, subTitle } = siteConfig;
    return subTitle ? `${title} - ${subTitle}` : title;
}
