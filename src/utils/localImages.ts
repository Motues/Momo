/**
 * `src/` 下本地图片的统一 glob 与解析入口：ImageModule、imagePreload 与页面共用。
 * ⚠️ glob 只收图片扩展名，否则会把 src 下所有文件变成动态 import。
 */
import type { ImageMetadata } from 'astro';

const images = import.meta.glob<ImageMetadata>(
    '/src/**/*.{jpg,jpeg,jfif,png,apng,webp,avif,gif,svg,tiff,tif,bmp,ico,heic}',
    { import: 'default', caseSensitive: false },
);

/**
 * 相对 `src/` 的路径 → glob 的键：归一反斜杠、开头的 `./` 与 `/`。
 * ⚠️ 大小写不归一：glob 的键是磁盘真实文件名，写错应报错而不是静默取另一个。
 */
export function localImageKey(src: string): string {
    const clean = String(src)
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .replace(/^\/+/, '');
    return `/src/${clean}`;
}

/** 按相对 `src/` 的路径取图片元数据；找不到返回 undefined */
export async function getLocalImage(src: string): Promise<ImageMetadata | undefined> {
    if (!src) return undefined;
    const getter = images[localImageKey(src)];
    if (!getter) return undefined;
    return await getter();
}
