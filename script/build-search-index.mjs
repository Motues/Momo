#!/usr/bin/env node
/**
 * 构建后扫描 dist 里的 HTML，生成站内搜索索引：dist/search-index/<lang>.json + manifest.json。
 * 锚点以构建产物为准，依赖 `src/plugins/rehype-search-anchor.ts` 输出的标记：
 * `data-search-content`（正文容器）/ `data-search-anchor`（可跳转块）/ `data-search-heading`（标题）/ `data-search-ignore`（整棵跳过）。
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const distArg = process.argv.indexOf('--dist');
const DIST = distArg > -1 && process.argv[distArg + 1]
    ? resolve(process.argv[distArg + 1])
    : join(ROOT, 'dist');
const OUT_DIR = join(DIST, 'search-index');

/** 这些子树里的文字不进索引（代码、公式、图标、按钮、模板） */
const SKIP_TAGS = new Set(['script', 'style', 'pre', 'svg', 'button', 'template', 'noscript']);
const SKIP_CLASSES = new Set([
    'expressive-code',
    'katex',
    'katex-display',
    'sr-only',
    'newtab-icon',
]);

/** 一个块最多保留多少字；超过就按句子 / 空格切成多段，共用同一个锚点 */
const BLOCK_MAX = 1200;
const CHUNK_SIZE = 800;

function attr(node, name) {
    return node.attrs?.find((item) => item.name === name)?.value;
}

function hasAttr(node, name) {
    return node.attrs?.some((item) => item.name === name) === true;
}

function classList(node) {
    const value = attr(node, 'class');
    return value ? value.split(/\s+/).filter(Boolean) : [];
}

function isSkipped(node) {
    if (!node.tagName) return false;
    if (SKIP_TAGS.has(node.tagName)) return true;
    if (hasAttr(node, 'data-search-ignore')) return true;
    return classList(node).some((name) => SKIP_CLASSES.has(name));
}

/** 提取块内可读文字，跳过代码块 / 公式 / 图标等子树 */
function textOf(node) {
    if (node.nodeName === '#text') return node.value;
    if (!node.tagName) {
        return (node.childNodes || []).map(textOf).join(' ');
    }
    if (isSkipped(node)) return '';
    return (node.childNodes || []).map(textOf).join(' ');
}

function clean(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function walk(node, visit) {
    visit(node);
    for (const child of node.childNodes || []) walk(child, visit);
}

function findFirst(root, predicate) {
    let hit = null;
    walk(root, (node) => {
        if (!hit && predicate(node)) hit = node;
    });
    return hit;
}

function findSearchRoot(doc) {
    let found = null;
    let ignoredDepth = 0;

    const visit = (node) => {
        if (node.tagName && hasAttr(node, 'data-search-ignore')) ignoredDepth++;
        if (!found && ignoredDepth === 0 && node.tagName && hasAttr(node, 'data-search-content')) {
            found = node;
        }
        for (const child of node.childNodes || []) visit(child);
        if (node.tagName && hasAttr(node, 'data-search-ignore')) ignoredDepth--;
    };

    visit(doc);
    return found;
}

function pageMeta(doc, filePath) {
    const html = findFirst(doc, (node) => node.tagName === 'html');
    const lang = (attr(html || { attrs: [] }, 'lang') || 'zh-cn').toLowerCase().replace(/_/g, '-');

    const robots = findFirst(
        doc,
        (node) => node.tagName === 'meta' && (attr(node, 'name') || '').toLowerCase() === 'robots',
    );
    if (/noindex/i.test(attr(robots || { attrs: [] }, 'content') || '')) return null;

    const titleNode = findFirst(doc, (node) => node.tagName === 'h1');
    let title = clean(textOf(titleNode || { childNodes: [] }));
    if (!title) {
        const titleTag = findFirst(doc, (node) => node.tagName === 'title');
        title = clean(textOf(titleTag || { childNodes: [] })).split(' - ')[0];
    }

    const descNode = findFirst(
        doc,
        (node) => node.tagName === 'meta' && (attr(node, 'name') || '').toLowerCase() === 'description',
    );
    const description = clean(attr(descNode || { attrs: [] }, 'content') || '');

    // 分类与发布日期来自文章页的 article:* meta（非文章页留空）
    const metaContent = (property) => {
        const node = findFirst(
            doc,
            (item) => item.tagName === 'meta' && (attr(item, 'property') || '').toLowerCase() === property,
        );
        return clean(attr(node || { attrs: [] }, 'content') || '');
    };
    const category = metaContent('article:section');
    const published = metaContent('article:published_time').slice(0, 10);

    const canonicalNode = findFirst(
        doc,
        (node) => node.tagName === 'link' && (attr(node, 'rel') || '').toLowerCase() === 'canonical',
    );
    const canonical = attr(canonicalNode || { attrs: [] }, 'href') || '';

    let url = '';
    if (canonical) {
        try {
            url = new URL(canonical, 'https://search.invalid').pathname;
        } catch {
            url = '';
        }
    }
    if (!url) {
        // 兜底：按 dist 里的相对路径推导，兼容 base 部署
        const rel = relative(DIST, filePath).split(sep).join('/');
        url = `/${rel}`;
    }
    if (url.endsWith('/index.html')) url = url.slice(0, -'index.html'.length);
    if (!url.endsWith('/')) url += '/';

    return { lang, title, description, url, category, published };
}

/** 长块切分：优先在空格处切；中文没有空格就按固定长度硬切 */
function chunkText(text) {
    if (text.length <= BLOCK_MAX) return [text];

    const chunks = [];
    let rest = text;
    while (rest.length > CHUNK_SIZE) {
        let cut = rest.lastIndexOf(' ', CHUNK_SIZE);
        if (cut < CHUNK_SIZE * 0.5) cut = CHUNK_SIZE;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
    return chunks.filter(Boolean);
}

/** 把正文里的锚点按文档顺序拆成 blocks，同时维护标题路径 */
function collectBlocks(root) {
    const blocks = [];
    let trail = [];

    const anchors = [];
    walk(root, (node) => {
        if (node.tagName && hasAttr(node, 'data-search-anchor') && !isSkipped(node)) anchors.push(node);
    });

    for (const node of anchors) {
        const id = attr(node, 'id') || '';
        const text = clean(textOf(node));
        if (!text) continue;

        if (/^h[1-6]$/.test(node.tagName)) {
            const level = Number(node.tagName[1]);
            // 标题自身作为结果时，路径展示它的上级标题，避免「第一节 › 第一节」
            const parentPath = trail.filter(Boolean).join(' › ');
            trail[level - 1] = text;
            trail.length = level;
            if (id) blocks.push({ a: id, h: parentPath, x: text });
            continue;
        }

        if (!id) continue;
        const path = trail.filter(Boolean).join(' › ');
        for (const chunk of chunkText(text)) blocks.push({ a: id, h: path, x: chunk });
    }

    return blocks;
}

async function collectHtmlFiles(dir) {
    const out = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'search-index' || entry.name === '_astro') continue;
            out.push(...await collectHtmlFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            out.push(full);
        }
    }
    return out;
}

async function main() {
    let files;
    try {
        files = await collectHtmlFiles(DIST);
    } catch (error) {
        console.error(`[search-index] 找不到构建产物目录：${DIST}`);
        throw error;
    }

    const byLang = new Map();
    let contentPages = 0;

    for (const file of files) {
        const html = await readFile(file, 'utf8');
        let doc;
        try {
            doc = parse(html);
        } catch (error) {
            throw new Error(`[search-index] 解析失败：${relative(DIST, file)}：${error.message}`);
        }

        const root = findSearchRoot(doc);
        if (!root) continue;

        const meta = pageMeta(doc, file);
        if (!meta || !meta.title) continue;

        const blocks = collectBlocks(root);
        if (blocks.length === 0) continue;

        contentPages++;
        if (!byLang.has(meta.lang)) byLang.set(meta.lang, []);
        byLang.get(meta.lang).push({
            u: meta.url,
            t: meta.title,
            d: meta.description,
            c: meta.category,
            p: meta.published,
            blocks,
        });
    }

    if (byLang.size === 0) {
        console.warn('[search-index] 没有找到任何带 data-search-content 的页面，索引为空');
    }

    // 先清掉上一次的索引：语言被删掉时不会留下孤立的旧文件
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });

    const locales = [];
    for (const [lang, pages] of [...byLang.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        pages.sort((a, b) => a.u.localeCompare(b.u));

        const outputPages = [];
        const outputBlocks = [];

        pages.forEach((page, index) => {
            // c / p 只有文章页才有（分类与发布日期），别的页面省略字段以省体积
            outputPages.push({
                u: page.u,
                t: page.t,
                d: page.d,
                ...(page.c ? { c: page.c } : {}),
                ...(page.p ? { p: page.p } : {}),
            });
            for (const block of page.blocks) {
                outputBlocks.push({ p: index, a: block.a, h: block.h, x: block.x });
            }
        });

        const payload = { v: 1, lang, pages: outputPages, blocks: outputBlocks };
        const json = JSON.stringify(payload);
        await writeFile(join(OUT_DIR, `${lang}.json`), json, 'utf8');
        locales.push(lang);

        const kb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);
        console.log(
            `[search-index] ${lang}: ${outputPages.length} 页 / ${outputBlocks.length} 块，${kb} KB`,
        );
    }

    const manifest = {
        v: 1,
        generated: new Date().toISOString(),
        locales,
    };
    await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest), 'utf8');
    console.log(`[search-index] 共收录 ${contentPages} 个正文页，输出到 ${relative(ROOT, OUT_DIR)}`);
}

await main();
