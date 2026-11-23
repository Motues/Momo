/**
 * 封面图的响应式档位（首页卡片与文章页封面共用一套）。
 * widths / sizes 必须与预加载的 `imagesrcset` 一致，否则会生成另一份带 hash 的图片。
 */
export const CONTENT_COVER = {
    widths: [480, 1080],
    sizes: '(max-width: 862px) 90vw, 776px',
    quality: 65,
} as const;
