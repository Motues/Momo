/** 照片封面是否真的启用：开关打开**且**配了图片路径才算 */
import { siteConfig } from '@/config';

export function photoCoverEnabled(): boolean {
    const cover = siteConfig.theme.photoCover;
    return cover?.enable === true && !!cover?.image;
}
