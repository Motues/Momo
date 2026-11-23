import { i18n } from "astro:config/client";

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}
/** 拼接完整的站内 URL 路径（含 BASE_URL） */
export function baseUrl(path: string) {
	return joinUrl("", import.meta.env.BASE_URL, path);
}

/** 把相对于 content/blog 的路径转成相对于 src 的路径（含文章名文件夹） */
export function blogCoverUrl(contentPath: string, blogName: string): string {

    if (!contentPath) return '';
    
    if (contentPath.startsWith('http')) {
        return contentPath;
    }

    if (contentPath.startsWith('./')) {
        contentPath = contentPath.substring(2);
    }

    const normalizedPath = contentPath.startsWith('/') ? contentPath.slice(1) : contentPath;

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
 * 给站内页面地址补上尾斜杠：线上 `/blog/xxx` 会 301 到 `/blog/xxx/`。
 * 带扩展名的静态资源（`/rss.xml`）与带查询串的地址不加。
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

/** 文章详情页的站内地址（含语言前缀与尾斜杠），站内各处统一走这里 */
export function blogPostUrl(lang: string, id: string): string {
    return withTrailingSlash(getRelativeLocaleUrl(lang, `/blog/${id}`));
}