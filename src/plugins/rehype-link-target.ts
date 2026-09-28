import { h } from 'hastscript';
import type { Element, ElementContent, Properties, Root, RootContent } from 'hast';

/**
 * 链接后面**紧跟**属性块 `{target="_blank"}` 时改为新标签页打开，并在链接后追加右上箭头图标。
 * 只认 target / rel / class 三个属性，出现别的属性就整体放弃、原样留在正文里；
 * 图标样式见 `src/styles/markdown.css` 与 `cms/server/prose.css`，两处要保持一致。
 */

// 紧跟链接的属性块：{...} 内不允许出现花括号
const MARKER = /^\{([^{}]*)\}/;
// 属性写法：key="v" | key='v' | key=v
const ATTR = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/g;
// 允许出现在属性块里的属性名
const ALLOWED = new Set(['target', 'rel', 'class']);
// word joiner：粘住「链接 + 箭头」，避免箭头被单独折行
const WORD_JOINER = '\u2060';

// Astro 的 Markdown 默认开启 smartypants，属性块里的直引号到 rehype 阶段已变成弯引号，
// 解析前要还原成直引号，否则属性值会带上引号本身（target=“_blank” 是无效值）
function straightenQuotes(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d\u201e\u201f]/g, '"');
}

// 右上箭头（Feather 的 arrow-up-right）：viewBox 收紧到箭头自身边界，
// 这样 CSS 里的 width / height 就是箭头本身的大小（改 stroke-width 时要同步 viewBox）
function newtabIcon(): Element {
  return h(
    'svg.newtab-icon',
    {
      viewBox: '6 6 12 12',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [
      h('line', { x1: 7, y1: 17, x2: 17, y2: 7 }),
      h('polyline', { points: '9 7 17 7 17 15' }),
    ],
  );
}

function isNewtabIcon(node: ElementContent | undefined): boolean {
  const className = node?.type === 'element' ? node.properties?.className : undefined;
  return Array.isArray(className) && className.includes('newtab-icon');
}

/** 解析属性块；出现不认识的属性（或一个属性都没有）就返回 null */
function parseAttrs(text: string): Properties | null {
  const props: Properties = {};
  const source = straightenQuotes(text);
  ATTR.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ATTR.exec(source)) !== null) {
    let name = match[1].toLowerCase();
    if (!ALLOWED.has(name)) return null;
    // 属性块里写的是 class，hast 里叫 className
    if (name === 'class') name = 'className';
    props[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }

  return Object.keys(props).length > 0 ? props : null;
}

export function rehypeLinkTarget() {
  return (tree: Root) => {
    // 一次遍历做两件事：① 摘掉链接后的属性块并挂到链接上；② 给新标签页链接补 rel + 箭头。
    // 每层子节点都从后往前处理，删除属性块或插入箭头都不会打乱还没处理的下标。
    const stack: Array<Root | Element> = [tree];

    while (stack.length > 0) {
      const parent = stack.pop();
      if (!parent) continue;
      const children = parent.children as ElementContent[];

      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];

        if (child.type === 'element' && child.tagName === 'a') {
          // ---- ① 解析紧跟其后的属性块 ----
          const next = children[i + 1];
          if (next?.type === 'text') {
            const match = MARKER.exec(next.value);
            const props = match ? parseAttrs(match[1]) : null;

            if (match && props) {
              // 类名拆成数组（hast 的 className）
              const parsed: Properties = { ...props };
              const className = parsed.className;
              if (className) parsed.className = String(className).split(/\s+/).filter(Boolean);
              child.properties = { ...child.properties, ...parsed };

              const rest = next.value.slice(match[0].length);
              if (rest) next.value = rest;
              else children.splice(i + 1, 1);
            }
          }

          // ---- ② 新标签页链接：补 rel + 在链接外面插箭头 ----
          if (child.properties?.target === '_blank') {
            const relValue: unknown = child.properties.rel;
            const relList = Array.isArray(relValue)
              ? relValue.map((item) => String(item))
              : String(relValue ?? '').split(/\s+/);
            const rel = new Set(relList.filter(Boolean));
            rel.add('noopener');
            rel.add('noreferrer');
            // 整体赋新对象：rel 在 hast 里声明为数组（序列化时按空格连接）
            child.properties = { ...child.properties, rel: [...rel] };

            const anchorChildren = child.children || [];
            const alreadyHasIcon =
              isNewtabIcon(children[i + 1]) || isNewtabIcon(children[i + 2]);
            // 链接内容里只有图片时不插图标（箭头会压在图片上）
            const onlyImage =
              anchorChildren.length > 0 &&
              anchorChildren.every(
                (node) => node.type === 'element' && ['img', 'figure'].includes(node.tagName),
              );

            if (!alreadyHasIcon && !onlyImage) {
              children.splice(
                i + 1,
                0,
                { type: 'text', value: WORD_JOINER },
                newtabIcon(),
              );
            }
          }
        }

        if (child.type === 'element') stack.push(child);
      }
    }
  };
}
