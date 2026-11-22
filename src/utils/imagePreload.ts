/**
 * 首屏 LCP 图片的 `<link rel="preload">` 数据。
 *
 * 为什么要自己算：文章封面 / 首页首张卡片通常就是 LCP 元素，而 `<picture>` 产出的是
 * srcset，浏览器要等解析到那一段 HTML 才知道该下哪一档。预加载写在 `<head>` 里，
 * 能提前一个往返开始下载。
 *
 * 关键：`imagesrcset` 必须与 `<picture>` 里的 AVIF `<source>` **完全相同**
 * （同一套 src / width / format / quality 才命中 Astro 的图片缓存、拿到同一个带 hash 的地址），
 * 所以这里调用的是 @utils/responsiveImage 的同一个 `buildPicture()`。
 * 不支持 AVIF 的浏览器会忽略 type 与整条预加载，照常走回退链，不会白下。
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

    // 远程图片：URL 是固定的，直接预加载原图（<img> 的 src 也是它，不会重复下载）
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src) || src.startsWith('//')) {
        return { href: src };
    }

    // public/ 下的图片：同一个道理，预加载它本身
    if (src.startsWith('/')) {
        return { href: src };
    }

    const meta = await getLocalImage(src);
    if (!meta) return undefined;

    const widths = (options.widths ?? CONTENT_COVER.widths).filter((w) => w <= meta.width);
    // 原图本来就很窄：ImageModule 会退回「一张原图」，没有 srcset 可预加载，放弃
    if (widths.length === 0) return undefined;

    const quality = options.quality ?? CONTENT_COVER.quality;
    const sizes = options.sizes ?? CONTENT_COVER.sizes;

    // 与 <picture> 走同一个生成函数：同参数 → 同一份带 hash 的产物，预加载不会另下一份
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
