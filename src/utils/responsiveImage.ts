/**
 * 手工拼 `<picture>`：AVIF + WebP 各用自己的编码质量。
 * 预加载（@utils/imagePreload）走同一个函数，保证 imagesrcset 与 <source> 逐字一致。
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/** AVIF 的编码质量：与 WebP 的 65 在体积上大致对齐（sharp 两种编解码器刻度不同） */
export const AVIF_QUALITY = 45;

export interface PictureSource {
    type: string;
    srcset: string;
}

export interface PictureData {
    /** 依次是 AVIF、WebP（浏览器挑第一个支持的） */
    sources: PictureSource[];
    /** `<img>` 的兜底地址（WebP），以及它的宽高 */
    src: string;
    width?: number;
    height?: number;
    /** AVIF 最大档的地址（预加载用；没有 AVIF 时为 undefined） */
    avifHref?: string;
}

interface BuildPictureOptions {
    /** 宽度档位；超过原图的会被过滤掉 */
    widths?: number[];
    /** WebP 的编码质量（AVIF 内部固定 AVIF_QUALITY） */
    quality?: number;
}

export async function buildPicture(
    meta: ImageMetadata,
    options: BuildPictureOptions = {},
): Promise<PictureData> {
    const quality = options.quality ?? 65;
    const widths = (options.widths ?? []).filter((w) => w <= meta.width);

    const sources: PictureSource[] = [];
    let avifHref: string | undefined;

    if (widths.length > 0) {
        const avifEntries: string[] = [];
        for (const width of widths) {
            const image = await getImage({ src: meta, width, format: 'avif', quality: AVIF_QUALITY });
            avifEntries.push(`${image.src} ${width}w`);
            avifHref = image.src;
        }
        sources.push({ type: 'image/avif', srcset: avifEntries.join(', ') });

        const webpEntries: string[] = [];
        for (const width of widths) {
            const image = await getImage({ src: meta, width, format: 'webp', quality });
            webpEntries.push(`${image.src} ${width}w`);
        }
        sources.push({ type: 'image/webp', srcset: webpEntries.join(', ') });
    }

    // `<img>` 的 src：没有宽度档位（原图比所有档位都窄）时给一张原尺寸 WebP
    const fallback = await getImage(
        widths.length > 0
            ? { src: meta, width: Math.max(...widths), format: 'webp', quality }
            : { src: meta, format: 'webp', quality },
    );

    return {
        sources,
        src: fallback.src,
        width: fallback.attributes.width,
        height: fallback.attributes.height,
        avifHref,
    };
}
