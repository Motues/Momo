/**
 * SEO 工具集：绝对 URL、canonical、hreflang 多语言对照、结构化数据与社交分享图。
 * 站内路径一律传相对路径，由 absoluteUrl 统一补上站点域名与 BASE_URL。
 */
import { getImage } from 'astro:assets'
import { i18n } from 'astro:config/client'
import { profileConfig, siteConfig } from '@/config'

/**
 * 内容目录里的图片：构建期取出优化后的 URL 作为分享图。
 * caseSensitive: false 只用于「发现」图片，下面的查找仍按 key 精确匹配。
 */
const contentImages = import.meta.glob<ImageMetadata>(
    '/src/content/blog/**/*.{png,jpg,jpeg,webp,avif,gif}',
    { import: 'default', eager: true, caseSensitive: false },
)

/** 站内路径 -> 绝对 URL（已带 base 的路径不会重复拼接） */
export function absoluteUrl(path = '/'): string {
    const p = String(path || '/')
    // 已经是绝对地址（含协议或协议相对）
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p) || p.startsWith('//')) return p

    const origin = (siteConfig.rootSiteUrl || '').replace(/\/+$/, '')
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') // 根路径时为 ''
    let rel = p.startsWith('/') ? p : `/${p}`
    if (base && rel !== base && !rel.startsWith(`${base}/`)) rel = base + rel
    return origin + rel
}

/** 规范化页面路径：去掉 index.html、目录形式补尾斜杠（canonical / hreflang 用） */
export function normalizePath(pathname: string): string {
    let p = String(pathname || '/')
    p = p.split('?')[0].split('#')[0].replace(/index\.html$/i, '')
    if (!p.startsWith('/')) p = `/${p}`
    // 没有文件扩展名的路径统一成目录形式，避免 /about 与 /about/ 被当成两个页面
    if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/'
    return p.replace(/\/{2,}/g, '/')
}

/** 语言代码 -> BCP 47（zh-cn -> zh-CN），用于 <html lang> 与 og:locale */
export function bcp47(lang?: string): string {
    const raw = String(lang || i18n?.defaultLocale || 'en').replace(/_/g, '-')
    const [head, ...rest] = raw.split('-')
    return [head.toLowerCase(), ...rest.map((s) => s.toUpperCase())].join('-')
}

/** 站点支持的语言代码列表 */
export function localeCodes(): string[] {
    const locales = i18n?.locales || []
    return locales.map((l) => (typeof l === 'string' ? l : l.path))
}

/** 去掉路径开头的语言前缀，得到「语言无关」路径 */
export function stripLocale(pathname: string): string {
    let p = String(pathname || '/').replace(/index\.html$/i, '')
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
    if (base && p.startsWith(`${base}/`)) p = p.slice(base.length)

    const prefixDefault = !!i18n?.routing?.prefixDefaultLocale
    const segment = p.replace(/^\/+/, '').split('/')[0]
    if (segment && localeCodes().includes(segment) && (segment !== i18n.defaultLocale || prefixDefault)) {
        p = `/${p.replace(/^\/+/, '').split('/').slice(1).join('/')}`
    }
    return p.startsWith('/') ? p : `/${p}`
}

/** 同一页面在各语言下的 URL（hreflang 用） */
export function localeAlternates(pathname: string): { lang: string; url: string }[] {
    const rest = stripLocale(pathname)
    const prefixDefault = !!i18n?.routing?.prefixDefaultLocale
    const codes = localeCodes()
    return (codes.length ? codes : [i18n.defaultLocale]).map((code) => ({
        lang: code,
        url: absoluteUrl(code === i18n.defaultLocale && !prefixDefault ? rest : `/${code}${rest}`),
    }))
}

/** x-default 指向默认语言版本 */
export function defaultLocaleUrl(pathname: string): string {
    const rest = stripLocale(pathname)
    const prefixDefault = !!i18n?.routing?.prefixDefaultLocale
    return absoluteUrl(prefixDefault ? `/${i18n.defaultLocale}${rest}` : rest)
}

/** 压缩空白并截断过长的文本（meta description 建议 150-160 字符） */
export function clampText(text: string, max = 160): string {
    const t = String(text || '').replace(/\s+/g, ' ').trim()
    if (t.length <= max) return t
    return `${t.slice(0, max - 1).trimEnd()}…`
}

/**
 * 站点描述（按语言解析）：`siteConfig.description` 可为单串或按语言给，
 * 缺当前语言退回默认语言，再退回个人信息里的简介。
 */
export function siteDescription(lang?: string): string {
    const value = siteConfig.description
    if (!value) return profileConfig.description || ''
    if (typeof value === 'string') return value

    const code = lang || i18n.defaultLocale
    return value[code] || value[i18n.defaultLocale] || Object.values(value)[0] || profileConfig.description || ''
}

/** 页面描述：本页描述 → 站点描述 → 个人信息简介 */
export function pageDescription(description?: string, lang?: string): string {
    return clampText(description || siteDescription(lang))
}

/** 日期 -> ISO 8601（结构化数据 / article meta 用） */
export function toIsoDate(value: Date | string | undefined): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.valueOf()) ? '' : date.toISOString()
}

/** 站点级结构化数据（WebSite），所有页面都会输出 */
export function websiteJsonLd(lang?: string): Record<string, unknown> {
    const owner = {
        '@type': 'Person',
        name: profileConfig.name,
        ...(profileConfig.indexPage ? { url: profileConfig.indexPage } : {}),
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteConfig.title,
        ...(siteConfig.subTitle ? { alternateName: siteConfig.subTitle } : {}),
        url: absoluteUrl('/'),
        description: siteDescription(lang || i18n.defaultLocale),
        inLanguage: bcp47(lang || i18n.defaultLocale),
        author: owner,
        publisher: owner,
        // 站内搜索支持 `?q=` 深链接，引擎可据此给出搜索框
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${absoluteUrl('/')}?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    }
}

/** 文章页的面包屑（首页 › 文章标题），用于搜索结果的层级显示 */
export function articleBreadcrumbJsonLd(opts: {
    title: string
    url: string
    lang?: string
}): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        inLanguage: bcp47(opts.lang),
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: siteConfig.title,
                item: absoluteUrl('/'),
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: clampText(opts.title, 110),
                item: opts.url,
            },
        ],
    }
}

/** 关于页的 ProfilePage：把站点主人明确标注成 Person */
export function profilePageJsonLd(opts: {
    url: string
    lang?: string
    description?: string
}): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: opts.url,
        inLanguage: bcp47(opts.lang),
        ...(opts.description ? { description: clampText(opts.description) } : {}),
        mainEntity: {
            '@type': 'Person',
            name: profileConfig.name,
            description: profileConfig.description || '',
            ...(profileConfig.indexPage ? { url: profileConfig.indexPage, sameAs: [profileConfig.indexPage] } : {}),
        },
    }
}

/** 文章结构化数据（BlogPosting），用于搜索结果与社交平台的富摘要 */
export function articleJsonLd(opts: {
    title: string
    description?: string
    url: string
    image?: string
    lang?: string
    pubDate: Date | string
    category?: string
    words?: number
    minutes?: number
}): Record<string, unknown> {
    const author = {
        '@type': 'Person',
        name: profileConfig.name,
        ...(profileConfig.indexPage ? { url: profileConfig.indexPage } : {}),
    }
    const published = toIsoDate(opts.pubDate)
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: clampText(opts.title, 110),
        name: opts.title,
        ...(opts.description ? { description: clampText(opts.description) } : {}),
        url: opts.url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
        inLanguage: bcp47(opts.lang),
        ...(published ? { datePublished: published, dateModified: published } : {}),
        ...(opts.image ? { image: [opts.image], thumbnailUrl: opts.image } : {}),
        ...(opts.category ? { articleSection: opts.category, keywords: [opts.category] } : {}),
        ...(opts.words ? { wordCount: opts.words } : {}),
        ...(opts.minutes ? { timeRequired: `PT${Math.max(1, Math.round(opts.minutes))}M` } : {}),
        author,
        publisher: author,
        isPartOf: {
            '@type': 'Blog',
            '@id': absoluteUrl('/'),
            name: siteConfig.title,
        },
    }
}

/**
 * 文章封面图 -> 可分享的绝对 URL：外链原样返回，`/` 开头的 public 资源拼绝对地址，
 * 文章目录内的相对图片转成 1200px 宽的 jpg。
 */
export async function coverShareImage(image: string, id: string): Promise<string> {
    if (!image) return ''
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(image)) return image
    if (image.startsWith('/')) return absoluteUrl(image)

    const file = image.replace(/^\.\//, '')
    const meta = contentImages[`/src/content/blog/${id}/${file}`]
    if (!meta) return ''
    try {
        const optimized = await getImage({ src: meta, width: 1200, format: 'jpeg', quality: 72 })
        return absoluteUrl(optimized.src)
    } catch {
        // 图片处理失败时不影响页面构建，只是不输出分享图
        return ''
    }
}
