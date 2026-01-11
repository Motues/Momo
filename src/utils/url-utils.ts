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