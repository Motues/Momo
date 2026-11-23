/**
 * 站内搜索的打分与摘要：简化 BM25（tf 饱和 + IDF），不做倒排表，查询时线性扫一遍。
 * 字段权重：页面级 标题 ×3 / 描述 ×1；正文块 标题路径 ×2 / 正文 ×1。
 */

import type { SearchHit, SearchIndexFile, SnippetPart } from '@/types/search';
import { analyzeQuery, isCjkChar, normalizeText, type QueryAnalysis } from './normalize';

/** tf 饱和系数：出现 1 次约得 0.45，3 次约得 0.71 */
const K1 = 1.2;
/** 单篇最多展示几条 */
const PER_PAGE_LIMIT = 3;
/** 单次搜索最多展示几条 */
const TOTAL_LIMIT = 20;
/** 摘要最多高亮多少段，超出部分不再标 */
const MAX_MARKS = 24;

export interface PreparedPage {
    url: string;
    title: string;
    titleNorm: string;
    titleCompact: string;
    description: string;
    descNorm: string;
    /** 分类（只有文章页有） */
    category: string;
    /** 发布日期 YYYY-MM-DD（只有文章页有） */
    published: string;
}

interface PreparedDoc {
    kind: 'page' | 'block';
    page: number;
    anchor: string;
    /** 展示用标题路径 */
    trail: string;
    trailNorm: string;
    /** 展示用正文（页面级结果是 description） */
    text: string;
    bodyNorm: string;
    titleNorm: string;
    titleCompact: string;
    /** 标题 + 路径 + 正文，用于整串短语加成 */
    allNorm: string;
    /** 去掉空白的 allNorm，用于多词整串匹配 */
    compactNorm: string;
}

export interface PreparedIndex {
    lang: string;
    pages: PreparedPage[];
    docs: PreparedDoc[];
}

/** 把索引文件预处理成查询时直接扫的结构（每页加载只做一次） */
export function prepareIndex(file: SearchIndexFile): PreparedIndex {
    const pages: PreparedPage[] = file.pages.map((page) => {
        const titleNorm = normalizeText(page.t || '');
        const descNorm = normalizeText(page.d || '');
        return {
            url: page.u,
            title: page.t,
            titleNorm,
            titleCompact: titleNorm.replace(/\s+/g, ''),
            description: page.d || '',
            descNorm,
            category: page.c || '',
            published: page.p || '',
        };
    });

    const docs: PreparedDoc[] = [];

    // 页面级结果：搜文章标题 / 描述；锚点为空，落到文章顶部
    pages.forEach((page, index) => {
        const allNorm = `${page.titleNorm} ${page.descNorm}`.trim();
        docs.push({
            kind: 'page',
            page: index,
            anchor: '',
            trail: '',
            trailNorm: '',
            text: page.description,
            bodyNorm: page.descNorm,
            titleNorm: page.titleNorm,
            titleCompact: page.titleCompact,
            allNorm,
            compactNorm: allNorm.replace(/\s+/g, ''),
        });
    });

    for (const block of file.blocks) {
        const page = pages[block.p];
        if (!page) continue;

        const trail = block.h || '';
        const trailNorm = normalizeText(trail);
        const bodyNorm = normalizeText(block.x || '');
        if (!bodyNorm && !trailNorm) continue;

        const allNorm = `${page.titleNorm} ${trailNorm} ${bodyNorm}`.trim();
        docs.push({
            kind: 'block',
            page: block.p,
            anchor: block.a || '',
            trail,
            trailNorm,
            text: block.x || '',
            bodyNorm,
            titleNorm: page.titleNorm,
            titleCompact: page.titleCompact,
            allNorm,
            compactNorm: allNorm.replace(/\s+/g, ''),
        });
    }

    return { lang: file.lang, pages, docs };
}

/** 转义正则里的特殊字符（英文 term 用于词边界匹配） */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 中文 / 非拉丁文本的不重叠计数 */
function countAll(haystack: string, needle: string): number {
    if (!haystack || !needle) return 0;
    let count = 0;
    let index = 0;
    while ((index = haystack.indexOf(needle, index)) !== -1) {
        count++;
        index += needle.length;
    }
    return count;
}

/**
 * 英文计数：按词边界；prefix 为真时只要求词首一致（搜索词打了一半也能命中）。
 * 普通模式带一层很轻的后缀匹配（s / es / ed / d / ing / ly），4 个字母以下不做。
 */
function countWord(haystack: string, word: string, prefix: boolean): number {
    if (!haystack || !word) return 0;
    const suffix = word.length >= 4 ? '(?:s|es|ed|d|ing|ly)?(?![a-z0-9])' : '(?![a-z0-9])';
    const end = prefix ? '' : suffix;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}${end}`, 'g');
    let count = 0;
    while (re.exec(haystack)) count++;
    return count;
}

function countTerm(haystack: string, term: string, prefix: boolean): number {
    return isCjkChar(term[0] || '') ? countAll(haystack, term) : countWord(haystack, term, prefix);
}

/** 一个 term 在文档三个字段里的加权词频 */
function fieldTf(doc: PreparedDoc, term: string, prefix: boolean): number {
    const titleWeight = doc.kind === 'page' ? 3 : 0;
    const trailWeight = doc.kind === 'page' ? 0 : 2;
    const title = countTerm(doc.titleNorm, term, prefix) * titleWeight;
    const trail = countTerm(doc.trailNorm, term, prefix) * trailWeight;
    const body = countTerm(doc.bodyNorm, term, prefix);
    return title + trail + body;
}

function saturation(tf: number): number {
    return tf / (tf + K1);
}

function idf(df: number, total: number): number {
    return Math.max(0, Math.log(1 + (total - df + 0.5) / (df + 0.5)));
}

interface ScoredDoc {
    doc: PreparedDoc;
    score: number;
    latinMatched: number;
    cjkMatched: number;
}

/**
 * 搜索：先按严格条件（英文全中 + 中文至少 60% 的二元词）筛，一条都没有时自动放宽。
 * `categories` 非空时只在这些分类的页面里搜（搜索弹窗的分类胶囊）。
 */
export function search(
    index: PreparedIndex,
    rawQuery: string,
    options: { prefix?: boolean; categories?: string[] } = {},
): SearchHit[] {
    const analysis = analyzeQuery(rawQuery);
    if (!analysis) return [];

    const categories = options.categories?.length ? options.categories : undefined;
    let hits = run(index, analysis, options.prefix === true, categories);
    // 英文词打了一半（如 sear → search）：严格匹配无结果时再按词首匹配一次
    if (hits.length === 0 && !options.prefix && analysis.latin.some((term) => term.length >= 3)) {
        hits = run(index, analysis, true, categories);
    }
    return hits;
}

/** 索引里出现过的分类（按名称排序，去掉空值） */
export function indexCategories(index: PreparedIndex): string[] {
    return [...new Set(index.pages.map((page) => page.category).filter(Boolean))].sort();
}

/** 最近发布的文章页（没有日期的页面排最后），用于「没有结果时」的推荐 */
export function recentPages(index: PreparedIndex, limit = 4): PreparedPage[] {
    return [...index.pages]
        .filter((page) => page.title)
        .sort((a, b) => (b.published || '').localeCompare(a.published || ''))
        .slice(0, limit);
}

function run(
    index: PreparedIndex,
    analysis: QueryAnalysis,
    prefix: boolean,
    categories?: string[],
): SearchHit[] {
    const { pages } = index;
    // 分类筛选：先定好允许的页面集合，逐文档扫时跳过其他页面
    const allowedPages = categories
        ? new Set(pages.map((page, i) => (categories.includes(page.category) ? i : -1)).filter((i) => i >= 0))
        : null;
    const docs = allowedPages ? index.docs.filter((doc) => allowedPages.has(doc.page)) : index.docs;
    if (docs.length === 0) return [];

    // 第一遍：文档频率（IDF）
    const df = new Map<string, number>();
    for (const term of analysis.terms) {
        let count = 0;
        for (const doc of docs) {
            if (fieldTf(doc, term, prefix) > 0) count++;
        }
        df.set(term, count);
    }

    const total = docs.length;
    const scored: ScoredDoc[] = [];

    // 第二遍：逐文档打分
    for (const doc of docs) {
        let score = 0;
        let latinMatched = 0;
        let cjkMatched = 0;

        for (const term of analysis.latin) {
            const tf = fieldTf(doc, term, prefix);
            if (tf <= 0) continue;
            latinMatched++;
            score += idf(df.get(term) || 0, total) * saturation(tf);
        }

        for (const term of analysis.cjk) {
            const tf = fieldTf(doc, term, prefix);
            if (tf <= 0) continue;
            cjkMatched++;
            score += idf(df.get(term) || 0, total) * saturation(tf);
        }

        if (score <= 0) continue;

        // 整串连续命中（中文尤其明显）算强信号，加权
        if (analysis.phrase.length >= 2 && analysis.phrase.length <= 200 && doc.compactNorm.includes(analysis.phrase)) {
            score *= 1.6;
        }

        // 页面标题里直接含查询串：排在「正文里顺便提到」的前面
        if (doc.kind === 'page' && analysis.phrase.length >= 2 && doc.titleCompact.includes(analysis.phrase)) {
            score *= 2;
        }

        scored.push({ doc, score, latinMatched, cjkMatched });
    }

    if (scored.length === 0) return [];

    // 严格条件：英文 term 全中；中文二元词至少覆盖 60%，但最多只要求 12 个
    const latinAll = analysis.latin.length;
    const minCjk = analysis.cjk.length <= 1
        ? analysis.cjk.length
        : Math.min(12, Math.max(2, Math.ceil(analysis.cjk.length * 0.6)));

    let pool = scored.filter(
        (item) => item.latinMatched === latinAll && item.cjkMatched >= minCjk,
    );

    // 没有严格命中时放宽：任意命中一个 term 即可。
    // ⚠️ 不能要求「英文至少中一个」：查询里不存在的英文词会把中文命中全部挡掉。
    if (pool.length === 0) {
        pool = scored.filter((item) => item.latinMatched + item.cjkMatched >= 1);
    }

    if (pool.length === 0) return [];

    pool.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // 同分时页面级结果排前面（通常是标题直接命中）
        if (a.doc.kind !== b.doc.kind) return a.doc.kind === 'page' ? -1 : 1;
        return a.doc.page - b.doc.page;
    });

    const hits: SearchHit[] = [];
    const perPage = new Map<number, number>();
    const seen = new Set<string>();

    for (const item of pool) {
        const { doc } = item;
        const key = `${doc.page}#${doc.anchor}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const count = perPage.get(doc.page) || 0;
        if (count >= PER_PAGE_LIMIT) continue;
        perPage.set(doc.page, count + 1);

        const page = pages[doc.page];
        hits.push({
            url: page.url + (doc.anchor ? `#${doc.anchor}` : ''),
            page: doc.page,
            pageUrl: page.url,
            title: page.title,
            trail: doc.trail,
            parts: buildSnippet(doc, analysis.terms),
            score: item.score,
            anchor: doc.anchor,
        });

        if (hits.length >= TOTAL_LIMIT) break;
    }

    return hits;
}

/**
 * 生成摘要：以最早命中的 term 为中心截一段，命中处切成 hit 片段。
 * 中文上下文窄一点（34），英文宽一点（90）并把边界推到空格，避免从半个单词开始。
 */
function buildSnippet(doc: PreparedDoc, terms: string[]): SnippetPart[] {
    // 正文块可能只是标题路径命中，摘要改展示标题路径，避免出现无高亮的无关正文
    const candidates = (doc.kind === 'block' ? [doc.text, doc.trail] : [doc.text]).filter(Boolean);
    const source = (
        candidates.find((candidate) => {
            const lower = candidate.toLowerCase();
            return terms.some((term) => lower.includes(term));
        }) || candidates[0] || ''
    ).trim();
    if (!source) return [];

    const lower = source.toLowerCase();
    let pos = -1;
    let matchLength = 0;

    for (const term of terms) {
        const index = lower.indexOf(term);
        if (index >= 0 && (pos < 0 || index < pos)) {
            pos = index;
            matchLength = term.length;
        }
    }

    // 页面级结果只有标题命中时不再展示无关的描述（标题已经在上方了）
    if (pos < 0 && doc.kind === 'page') return [];

    const cjk = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(source);
    const radius = cjk ? 34 : 90;

    let start = pos >= 0 ? Math.max(0, pos - radius) : 0;
    let end = pos >= 0
        ? Math.min(source.length, pos + Math.max(matchLength, 1) + radius)
        : Math.min(source.length, radius * 2);

    if (!cjk && start > 0) {
        const space = source.indexOf(' ', start);
        if (space !== -1 && space < pos) start = space + 1;
    }
    if (!cjk && end < source.length) {
        const space = source.lastIndexOf(' ', end);
        if (space > pos + matchLength) end = space;
    }

    const raw = source.slice(start, end).trim();
    if (!raw) return [];

    // 找出摘要里所有 term 的位置（英文按原样、不区分大小写），合并重叠区间
    const ranges: Array<[number, number]> = [];
    const haystack = raw.toLowerCase();
    for (const term of terms) {
        if (!term) continue;
        let from = 0;
        let index = 0;
        while ((index = haystack.indexOf(term, from)) !== -1) {
            ranges.push([index, index + term.length]);
            from = index + Math.max(1, term.length);
        }
    }

    ranges.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1]) {
            last[1] = Math.max(last[1], range[1]);
        } else {
            merged.push([range[0], range[1]]);
        }
    }

    const parts: SnippetPart[] = [];
    let cursor = 0;
    let marks = 0;
    for (const [from, to] of merged) {
        if (marks >= MAX_MARKS) break;
        if (from > cursor) parts.push({ text: raw.slice(cursor, from), hit: false });
        parts.push({ text: raw.slice(from, to), hit: true });
        cursor = to;
        marks++;
    }
    if (cursor < raw.length) parts.push({ text: raw.slice(cursor), hit: false });

    if (parts.length > 0) {
        if (start > 0) parts.unshift({ text: '…', hit: false });
        if (end < source.length) parts.push({ text: '…', hit: false });
    }

    return parts;
}
