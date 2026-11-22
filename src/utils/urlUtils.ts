import { i18n } from "astro:config/client";

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}
/**
 * 构建完整的URL路径
 * @param path - 需要拼接的路径片段
 * @returns 返回拼接后的完整URL路径
 */
export function baseUrl(path: string) {
	return joinUrl("", import.meta.env.BASE_URL, path);
}

/**
 * 将相对于content/blog目录的路径转换为相对于src目录的路径
 * @param contentPath 相对于content/blog目录的路径
 * @param blogName 博客文章的名称/ID，用于构建完整路径
 * @returns 相对于src目录的路径
 */
export function blogCoverUrl(contentPath: string, blogName: string): string {

    if (!contentPath) return '';
    
    if (contentPath.startsWith('http')) {
        return contentPath;
    }

    // 处理相对路径 ./ 开头的情况
    if (contentPath.startsWith('./')) {
        contentPath = contentPath.substring(2);
    }
    
    // 移除可能的前导斜杠
    const normalizedPath = contentPath.startsWith('/') ? contentPath.slice(1) : contentPath;
    
    // 构造相对于src目录的路径，包含博客名称文件夹
    return joinUrl("content/blog/", blogName, normalizedPath)
}

export function getRelativeLocaleUrl(lang: string, path: string) : string { 
    const prefixDefaultLocale = i18n.routing.prefixDefaultLocale;
    if(prefixDefaultLocale) {
        return joinUrl("/", lang, path);
    }else {
        if(lang === i18n.defaultLocale) return joinUrl("/", path);
        return joinUrl("/", lang, path);
    }
}

/**
 * 给站内页面地址补上尾斜杠。
 *
 * 线上（GitHub Pages）对 `/blog/xxx` 会 301 到 `/blog/xxx/`，而 canonical 一直是
 * 目录形式：生成链接时漏掉斜杠 = 每次点击多一跳。所以站内路径统一走这里，
 * 由 `astro.config.mjs` 的 `trailingSlash: 'always'` 兜住开发服务器与 `Astro.url`。
 *
 * 带扩展名的静态资源（`/rss.xml`、`/favicon.ico`）和带查询串的地址不加。
 */
export function withTrailingSlash(path: string): string {
    const value = String(path || "/");
    if (!value) return "/";
    if (value.endsWith("/")) return value;

    const hashIndex = value.indexOf("#");
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
    const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;

    const queryIndex = withoutHash.indexOf("?");
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
    const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

    if (pathname.endsWith("/")) return value;
    if (/\.[a-z0-9]+$/i.test(pathname)) return value;
    return `${pathname}/${query}${hash}`;
}

/**
 * 文章详情页的站内地址（含语言前缀与尾斜杠）。
 * 卡片、归档、上一篇 / 下一篇、RSS 与站内示例都走这里，避免各处手写路径。
 */
export function blogPostUrl(lang: string, id: string): string {
    return withTrailingSlash(getRelativeLocaleUrl(lang, `/blog/${id}`));
}