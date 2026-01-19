import { visit } from 'unist-util-visit';

export function customFigurePlugin() {
  return (tree) => {
    visit(tree, { type: 'element', tagName: 'img' }, (node, index, parent) => {
      // 检查是否存在 title 属性
      const title = node.properties?.title;
      if (!title) return;

      // 创建 figcaption 节点
      const figcaption = {
        type: 'element',
        tagName: 'figcaption',
        children: [{ type: 'text', value: title }],
        properties: {
            className: ['text-center', 'text-sm', 'text-[var(--text-color)]/60'],
        }
      };

      // 创建 figure 容器，将原图片和说明文字包裹起来
      const figure = {
        type: 'element',
        tagName: 'figure',
        children: [node, figcaption],
        properties: { style: 'text-align: center;' }
      };

      // 用 figure 替换原有的 img
      parent.children[index] = figure;
    });
  };
}