#!/usr/bin/env node
/**
 * 构建后清理：删掉 dist/_astro 里没有任何产物引用的图片。
 *
 * 为什么需要这一步：
 * ImageModule 用 `import.meta.glob` 取 ImageMetadata，而 Vite 会把 glob 命中的
 * **每一张**图片都当静态资源输出（哪怕从来没人引用它，例如 src/assets 下遗留的
 * 素材）。同时 `<Image>` 只输出尺寸变体，那些「原图副本」在 HTML / CSS / JS 里
 * 一个引用都没有，属于纯浪费。
 *
 * 判定方式：把所有文本产物（html / css / js / json / xml …）拼成一个大字符串，
 * 图片文件名在里面出现过就保留。文件名带内容 hash，不会和别的文件撞名；宁可
 * 误留（多一个文件）也绝不误删，所以只做「完全没出现过」的删除。
 *
 * 用法：
 *   node script/prune-unused-images.mjs           # 删除
 *   node script/prune-unused-images.mjs --check   # 只报告，有未引用图片时退出码 1
 */

import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const distArg = process.argv.indexOf('--dist');
const DIST = distArg > -1 && process.argv[distArg + 1]
    ? join(ROOT, process.argv[distArg + 1])
    : join(ROOT, 'dist');
const ASSETS_DIR = join(DIST, '_astro');

const checkOnly = process.argv.includes('--check');

/** 只处理图片；js / css / 字体等不归这个脚本管 */
const IMAGE_EXTS = new Set(['.webp', '.avif', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico']);
/** 可能引用图片的文本产物 */
const TEXT_EXTS = new Set([
    '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.xml', '.txt', '.webmanifest', '.map',
]);

const fmtSize = (bytes) =>
    bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
        : `${(bytes / 1024).toFixed(1)} KB`;

/** 递归列出目录下的所有文件（目录不存在时返回空数组） */
async function walk(dir) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const files = [];
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...(await walk(full)));
        else if (entry.isFile()) files.push(full);
    }
    return files;
}

async function main() {
    const all = await walk(DIST);
    if (all.length === 0) {
        console.error(`[prune] 找不到构建产物：${DIST}（先跑 astro build）`);
        process.exit(1);
    }

    // 1. 文本产物拼成一个 haystack
    const textParts = [];
    for (const file of all) {
        if (!TEXT_EXTS.has(extname(file).toLowerCase())) continue;
        textParts.push(await readFile(file, 'utf8'));
    }
    const haystack = textParts.join('\n');

    // 2. _astro 下的图片逐个核对引用
    const images = [];
    for (const file of all) {
        if (!file.startsWith(ASSETS_DIR + sep)) continue;
        if (!IMAGE_EXTS.has(extname(file).toLowerCase())) continue;
        images.push(file);
    }

    const unused = [];
    let keptBytes = 0;
    for (const file of images) {
        const name = basename(file);
        if (haystack.includes(name)) {
            keptBytes += (await stat(file)).size;
            continue;
        }
        unused.push({ file, size: (await stat(file)).size });
    }

    if (unused.length === 0) {
        console.log(`[prune] 没有未引用的图片（共 ${images.length} 个，${fmtSize(keptBytes)}）`);
        return;
    }

    const unusedBytes = unused.reduce((sum, item) => sum + item.size, 0);
    console.log(`[prune] 未引用图片 ${unused.length} 个，共 ${fmtSize(unusedBytes)}：`);
    for (const { file, size } of unused) {
        console.log(`  - ${relative(DIST, file).replace(/\\/g, '/')}  ${fmtSize(size)}`);
    }

    if (checkOnly) {
        console.log('[prune] --check 模式：文件未删除（有未引用图片时以退出码 1 结束）');
        process.exit(1);
    }

    for (const { file } of unused) await unlink(file);
    console.log(`[prune] 已删除；剩余图片 ${images.length - unused.length} 个，${fmtSize(keptBytes)}`);
}

await main();
