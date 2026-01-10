import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node newpost.js <path> [lang] (default lang is zh-cn)');
    process.exit(1);
}

const folderPath = args[0];
const lang = args[1] || 'zh-cn'; // 如果没有提供语言参数，默认使用 zh-cn

// 确保语言参数有效
const validLangs = ['en', 'zh-cn'];
if (!validLangs.includes(lang)) {
    console.error(`Invalid language: ${lang}. Valid options are: ${validLangs.join(', ')}`);
    process.exit(1);
}

// 定义基础路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const basePath = join(__dirname, '..', 'src', 'content', 'blog');

// 创建完整路径
const fullPath = join(basePath, folderPath);

// 创建文件夹（如果不存在）
try {
    await mkdir(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
} catch (error) {
    console.error(`Error creating directory: ${error.message}`);
    process.exit(1);
}

// 默认的 Markdown 内容
const defaultContent = `---
title: new post
date: ${new Date().toISOString().split('T')[0]}
description: Some description here
image: ""
draft: false
slug: ${folderPath}
---

## Title

Content goes here...
`;

// 创建语言特定的 Markdown 文件
const filePath = join(fullPath, `${lang}.md`);

try {
    if (existsSync(filePath)) {
        console.warn(`File already exists: ${filePath}`);
    } else {
        await writeFile(filePath, defaultContent, 'utf8');
        console.log(`Created file: ${filePath}`);
    }
} catch (error) {
    console.error(`Error creating file: ${error.message}`);
    process.exit(1);
}

console.log(`Successfully created new post at: ${filePath}`);