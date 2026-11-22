/**
 * `src/` 下的本地图片：统一的 glob 与解析入口。
 *
 * 三个地方需要「把 frontmatter / 配置里的相对路径变成 ImageMetadata」：
 *   - `components/misc/ImageModule.astro`（渲染）
 *   - `utils/imagePreload.ts`（首屏 LCP 预加载）
 *   - 文章页 / 首页（决定要不要预加载）
 * 以前每个地方各写一份 glob，键的写法一旦对不上就「图片找不到」。
 *
 * ⚠️ glob 只收图片扩展名：早先 ImageModule 用的是 `../../**\/*`，会把 src 下的
 * 所有文件都变成动态 import，用到它的页面（例如首页）平白多背几百 KB 的正文样式。
 */
import type { ImageMetadata } from 'astro';

const images = import.meta.glob<ImageMetadata>(
    '/src/**/*.{jpg,jpeg,jfif,png,apng,webp,avif,gif,svg,tiff,tif,bmp,ico,heic}',
    { import: 'default', caseSensitive: false },
);

/**
 * 相对 `src/` 的路径 -> glob 的键。
 * 容错：反斜杠、开头的 `./` 或 `/` 都会被归一。
 * ⚠️ 大小写不做归一：glob 的键是磁盘上的真实文件名，
 * `cover.jpg` 与 `COVER.JPG` 是两个不同文件，写错依旧应该报错而不是静默取另一个。
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
