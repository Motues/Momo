#!/usr/bin/env node
/**
 * 构建后清理：删除 dist/_astro 里没有任何产物引用的图片。
 * 判定：所有文本产物（html / css / js / json / xml…）里出现过文件名的就保留——宁可误留，绝不误删。
 * 用法：node script/prune-unused-images.mjs [--check]（--check 只报告，有未引用图片时退出码 1）
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

    // 文本产物拼成一个 haystack
    const textParts = [];
    for (const file of all) {
        if (!TEXT_EXTS.has(extname(file).toLowerCase())) continue;
        textParts.push(await readFile(file, 'utf8'));
    }
    const haystack = textParts.join('\n');

    // 逐个核对 _astro 下图片是否被引用
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
