import { visit } from 'unist-util-visit';
import { getLqipGradient } from '../utils/getLqipColors';
import path from 'path';

export function remarkLqip(options = {}) {
  const { enable = true } = options;
  
  return async (tree, vfile) => {
    if (!enable) return;
    
    const promises = [];

    visit(tree, 'image', (node) => {
      // 只处理本地图片
      if (!node.url.startsWith('http') && !node.url.startsWith('/')) {
        const promise = (async () => {
          // 计算图片的绝对路径
          const imagePath = path.resolve(path.dirname(vfile.path), node.url);
          // 获取弥散渐变色
          const lqip = await getLqipGradient(imagePath);
          
          // 将颜色存入节点的 data 中,方便后续渲染
          node.data = node.data || {};
          node.data.hProperties = {
            style: `--lqip: ${lqip}`,
            class: 'lqip-markdown-img'
          };
        })();
        promises.push(promise);
      }
    });

    await Promise.all(promises);
  };
}