import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';

/** 给带 title 的图片套上 <figure> 与 <figcaption>（title 作为图注） */
export function customFigurePlugin() {
  return (tree: Root) => {
    visit(tree, { type: 'element', tagName: 'img' }, (node, index, parent) => {
      if (index === undefined || !parent) return;

      const title = node.properties?.title;
      const figureChildren: Element['children'] = [node];

      if (typeof title === 'string' && title) {
        figureChildren.push({
          type: 'element',
          tagName: 'figcaption',
          properties: {
            className: ['text-center', 'text-sm', 'text-[var(--text-color-70)]'],
          },
          children: [{ type: 'text', value: title }],
        });
      }

      // 用 figure 替换原有的 img
      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        properties: { style: 'text-align: center;' },
        children: figureChildren,
      };
    });
  };
}
