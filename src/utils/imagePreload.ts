/**
 * 首屏 LCP 图片的 `<link rel="preload">` 数据：把封面预加载提前到 `<head>`。
 * ⚠️ `imagesrcset` 必须与 `<picture>` 的 AVIF `<source>` 完全相同，故复用同一个 `buildPicture()`。
 */
import { getLocalImage } from './localImages';
import { CONTENT_COVER } from './coverImage';
import { buildPicture } from './responsiveImage';

export interface PreloadImage {
    href: string;
    srcset?: string;
    sizes?: string;
    type?: string;
}

export async function coverPreload(
    src: string,
    options: { widths?: readonly number[]; sizes?: string; quality?: number } = {},
): Promise<PreloadImage | undefined> {
    if (!src) return undefined;

    // 远程图片：URL 固定，直接预加载原图
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src) || src.startsWith('//')) {
        return { href: src };
    }

    if (src.startsWith('/')) {
        return { href: src };
    }

    const meta = await getLocalImage(src);
    if (!meta) return undefined;

    const widths = (options.widths ?? CONTENT_COVER.widths).filter((w) => w <= meta.width);
    // 原图太窄时没有 srcset 可预加载
    if (widths.length === 0) return undefined;

    const quality = options.quality ?? CONTENT_COVER.quality;
    const sizes = options.sizes ?? CONTENT_COVER.sizes;

    const picture = await buildPicture(meta, { widths: [...widths], quality });
    const avif = picture.sources.find((source) => source.type === 'image/avif');
    if (!avif || !picture.avifHref) return undefined;

    return {
        href: picture.avifHref,
        srcset: avif.srcset,
        sizes,
        type: 'image/avif',
    };
}
