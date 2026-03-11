import { visit } from 'unist-util-visit';

export function customFigurePlugin() {
  return (tree) => {
    visit(tree, { type: 'element', tagName: 'img' }, (node, index, parent) => {
      // 检查是否存在 title 属性
      const title = node.properties?.title;
      // if (!title) return;

      const figureChildren = [node];

      // 如果有标题，则添加 figcaption
      if (title) {
        figureChildren.push({
          type: 'element',
          tagName: 'figcaption',
          properties: {
            className: ['text-center', 'text-sm', 'text-[var(--text-color-70)]'],
          },
          children: [{ type: 'text', value: title }],
        });
      }

      // 构造 figure 节点
      const figure = {
        type: 'element',
        tagName: 'figure',
        properties: { style: 'text-align: center;' },
        children: figureChildren,
      };

      // 用 figure 替换原有的 img
      parent.children[index] = figure;
    });
  };
}