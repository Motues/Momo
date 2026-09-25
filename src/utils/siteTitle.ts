import { siteConfig } from "@/config";

/**
 * 站点的完整标题（浏览器标签栏 / RSS 使用）。
 * 当 config.ts 里的 subTitle 为空时，只返回主标题，
 * 避免出现 "Momo - " 这样多余的分隔符。
 */
export function getSiteTitle(): string {
    const { title, subTitle } = siteConfig;
    return subTitle ? `${title} - ${subTitle}` : title;
}
