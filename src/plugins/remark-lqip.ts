import path from 'node:path';
import { visit } from 'unist-util-visit';
import { getLqipGradient } from '../utils/getLqipColors';
import type { ImageData, Root } from 'mdast';
import type { Properties } from 'hast';
import type { VFile } from 'vfile';

export interface RemarkLqipOptions {
  enable?: boolean;
}

/** mdast 的 ImageData 里没有 hast 属性，这里补一个 */
interface LqipImageData extends ImageData {
  hProperties?: Properties;
}

/** 给本地相对路径图片加上 LQIP 弥散渐变占位（siteConfig.theme.LQIP 控制） */
export function remarkLqip(options: RemarkLqipOptions = {}) {
  const { enable = true } = options;

  return async (tree: Root, vfile: VFile) => {
    if (!enable) return;

    const promises: Promise<void>[] = [];

    visit(tree, 'image', (node) => {
      // 只处理本地图片
      if (node.url.startsWith('http') || node.url.startsWith('/')) return;

      promises.push(
        (async () => {
          const imagePath = path.resolve(path.dirname(vfile.path), node.url);
          const lqip = await getLqipGradient(imagePath);

          const data: LqipImageData = (node.data as LqipImageData | undefined) ?? {};
          data.hProperties = {
            style: `--lqip: ${lqip}`,
            class: 'lqip-markdown-img',
          };
          node.data = data;
        })(),
      );
    });

    await Promise.all(promises);
  };
}
