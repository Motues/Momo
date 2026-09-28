import { h } from 'hastscript';
import type { Element, ElementContent, Properties } from 'hast';
import type { ComponentFunction } from 'rehype-components';

export type AdmonitionType = 'tip' | 'note' | 'important' | 'caution' | 'warning';

/** 提示块组件（:::note / :::tip ... 的渲染体） */
export function AdmonitionComponent(
  properties: Properties,
  children: ElementContent[],
  type: AdmonitionType,
): Element {
  if (!Array.isArray(children) || children.length === 0) {
    return h(
      'div',
      { class: 'hidden' },
      'Invalid admonition directive. (Admonition directives must be of block type ":::note{name="name"} <content> :::")',
    );
  }

  let label: Element | null = null;
  if (properties['has-directive-label']) {
    // 第一个子节点是指令标签，原本是 <p>，这里换成 <div>
    label = children[0] as Element;
    children = children.slice(1);
    label.tagName = 'div';
  }

  return h('div', { class: `${type}` }, [
    h('span', { class: 'admonition-title' }, label ?? type.toUpperCase()),
    ...children,
  ]);
}

/** 绑定类型的工厂：admonition('note') / admonition('tip') ... */
export const admonition =
  (type: AdmonitionType): ComponentFunction =>
  (properties, children) =>
    AdmonitionComponent(properties, children, type);
