/**
 * 照片封面是否真的启用。
 *
 * 开关打开**且**配了图片路径才算启用：只开开关不配图会退化成「占了一屏却没有照片」，
 * 不如当作没开。三处都要用到（布局的样式表、PhotoCover 组件、首页的接线），
 * 所以收在这里，避免各写一份判断。
 */
import { siteConfig } from '@/config';

export function photoCoverEnabled(): boolean {
    const cover = siteConfig.theme.photoCover;
    return cover?.enable === true && !!cover?.image;
}
