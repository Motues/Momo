/**
 * 站内搜索的数据结构。
 *
 * 索引文件由 `script/build-search-index.mjs` 在 `astro build` 之后生成，
 * 客户端只读这些字段；字段名刻意压短，减小下载体积。
 */

/** 索引里的一篇文章 / 一个正文页 */
export interface SearchIndexPage {
    /** 页面路径（含 base，末尾带 /） */
    u: string
    /** 页面标题 */
    t: string
    /** meta description，可能为空 */
    d?: string
    /** 分类（仅文章页，来自 article:section） */
    c?: string
    /** 发布日期 YYYY-MM-DD（仅文章页），用于「最近文章」推荐 */
    p?: string
}

/** 索引里的一个正文块（段落 / 列表项 / 提示块 / 标题……） */
export interface SearchIndexBlock {
    /** 所属页面在 pages 里的下标 */
    p: number
    /** 锚点 id；标题是 slug，其它块是 s-1、s-2…… */
    a: string
    /** 标题路径，如「安装 › macOS」 */
    h?: string
    /** 块内可读文本 */
    x: string
}

export interface SearchIndexFile {
    /** 索引格式版本，客户端只接受 1 */
    v: number
    /** 语言代码（zh-cn / en） */
    lang: string
    pages: SearchIndexPage[]
    blocks: SearchIndexBlock[]
}

/** 摘要按「普通文本 / 命中」切片，UI 据此生成 <mark> */
export interface SnippetPart {
    text: string
    hit: boolean
}

/** 一条搜索结果（已经指向具体段落） */
export interface SearchHit {
    /** 带 #锚点 的站内路径 */
    url: string
    /** 所属页面在索引 pages 里的下标（UI 按文章聚合结果用） */
    page: number
    /** 页面级路径（不含锚点），聚合时的分组键 */
    pageUrl: string
    /** 页面标题 */
    title: string
    /** 标题路径（页面级结果为真实标题本身时为空） */
    trail: string
    /** 带高亮切片的摘要 */
    parts: SnippetPart[]
    score: number
    /** 锚点 id，页面级结果为 '' */
    anchor: string
}
