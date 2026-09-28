import { h } from 'hastscript';
import type { Element, ElementContent, Properties } from 'hast';

/** 居中引用组件（::quote[内容]） */
export function QuoteComponent(
  properties: Properties,
  children: ElementContent[],
): Element {
  if (!Array.isArray(children) || children.length === 0) {
    return h('div', { class: 'hidden' }, 'Invalid quote content');
  }

  const currentChildren = properties?.['has-directive-label'] ? children.slice(1) : children;

  const processNodes = (nodes: ElementContent[]): ElementContent[] =>
    nodes.flatMap((node, index) => {
      if (node.type !== 'element') return node;
      if (node.tagName === 'p') {
        const pContent = processNodes(node.children);

        // 不是最后一个段落时补 <br>，还原原本的换行
        return index < nodes.length - 1 ? [...pContent, h('br')] : pContent;
      }
      return { ...node, children: processNodes(node.children) };
    });

  return h('div', { class: 'quote' }, processNodes(currentChildren));
}
