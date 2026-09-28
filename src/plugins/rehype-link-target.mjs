import { h } from 'hastscript';

/**
 * rehypeLinkTarget —— 自定义语法：链接后面紧跟属性块 `{target="_blank"}`
 *
 *     当前标签页：[Momo](https://momo.motues.top)
 *     新标签页：  [Momo](https://momo.motues.top){target="_blank"}
 *
 * 规则：
 *   - 属性块必须**紧跟**在链接后面（中间不能有空格），否则按普通正文处理；
 *   - 只识别下面三个属性，出现别的属性就整个放弃并原样留在正文里，
 *     因此其它花括号写法（如 `{文字}(拼音)`）不会被误吃：
 *       target="_blank" 在新标签页打开（自动补 rel="noopener noreferrer" 与右上箭头图标）
 *       rel="..."       追加到 rel 上（noopener / noreferrer 始终保留）
 *       class="..."     追加类名
 *   - 只有写了属性块的链接才会新开标签页，其它链接保持默认行为（当前标签页）；
 *   - 链接里只有图片时（`[![alt](a.png)](url)`）不插图标，避免箭头压在图片上。
 *
 * 与 `markdown.css`、CMS 预览（`cms/server/preview.mjs` / `prose.css`）保持同步。
 */

// 紧跟链接的属性块：{...} 内不允许出现花括号
const MARKER = /^\{([^{}]*)\}/;
// 属性写法：key="v" | key='v' | key=v
const ATTR = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/g;
// 允许出现在属性块里的属性名
const ALLOWED = new Set(['target', 'rel', 'class']);
// word joiner：粘住「链接 + 箭头」，避免箭头被单独折行
const WORD_JOINER = '\u2060';

// Astro 的 Markdown 默认开启 smartypants：正文里的直引号会被替换成弯引号，
// 于是 `{target="_blank"}` 传到 rehype 阶段时已经是 `{target=“_blank”}`，
// 解析前必须先把弯引号还原成直引号，否则属性值会带上引号本身（target=“_blank” 是无效值）。
function straightenQuotes(text) {
    return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d\u201e\u201f]/g, '"');
}

// 右上箭头（Feather 的 arrow-up-right）
// viewBox 收紧到箭头自身的边界（线段 (7,17)-(17,7) + 箭头两笔，含 stroke-width 2 的圆头外扩：
// 6..18 正好是 12 个单位），这样 CSS 里的 width/height 就是「箭头本身」的大小：
// 原来用 24×24 的 viewBox 时箭头只占中间约 52%，1em 的方框里实际只画出 8.3px，看起来很小。
function newtabIcon() {
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

function isNewtabIcon(node) {
    return (
        node?.type === 'element' &&
        node.tagName === 'svg' &&
        (node.properties?.className || []).includes('newtab-icon')
    );
}

// 解析属性块；出现不认识的属性（或一个属性都没有）就返回 null
function parseAttrs(text) {
    const props = {};
    const source = straightenQuotes(text);
    ATTR.lastIndex = 0;
    let match;
    while ((match = ATTR.exec(source)) !== null) {
        let name = match[1].toLowerCase();
        if (!ALLOWED.has(name)) return null;
        // hast 里类名要用数组
        if (name === 'class') name = 'className';
        props[name] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    return Object.keys(props).length > 0 ? props : null;
}

export function rehypeLinkTarget() {
    return (tree) => {
        // 一次遍历同时做两件事：① 摘掉链接后面的属性块并挂到链接上；② 给新标签页链接补 rel + 箭头。
        // 从后往前处理每一层子节点：无论是删除属性块、还是往链接后面插箭头，都不会影响还没处理的下标。
        const stack = [tree];
        while (stack.length > 0) {
            const parent = stack.pop();
            const children = parent.children;
            if (!Array.isArray(children)) continue;
            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                if (child.type === 'element' && child.tagName === 'a') {
                    // ---- ① 解析紧跟其后的属性块 ----
                    const next = children[i + 1];
                    const match = next && next.type === 'text' ? MARKER.exec(next.value) : null;
                    const props = match ? parseAttrs(match[1]) : null;
                    if (props) {
                        if (props.className) props.className = String(props.className).split(/\s+/).filter(Boolean);
                        child.properties = { ...child.properties, ...props };
                        const rest = next.value.slice(match[0].length);
                        if (rest) next.value = rest;
                        else children.splice(i + 1, 1);
                    }

                    // ---- ② 新标签页链接：补 rel + 在链接外面插箭头 ----
                    if (child.properties?.target === '_blank') {
                        const rel = new Set(
                            (Array.isArray(child.properties.rel)
                                ? child.properties.rel
                                : String(child.properties.rel ?? '').split(/\s+/)
                            ).filter(Boolean),
                        );
                        rel.add('noopener');
                        rel.add('noreferrer');
                        child.properties.rel = [...rel].join(' ');

                        const anchorChildren = child.children || [];
                        const iconAfter = children[i + 1];
                        const alreadyHasIcon = isNewtabIcon(iconAfter) || isNewtabIcon(children[i + 2]);
                        // 链接内容里只有图片时不插图标（箭头会压在图片上）
                        const onlyImage =
                            anchorChildren.length > 0 &&
                            anchorChildren.every(
                                (node) => node.type === 'element' && ['img', 'figure'].includes(node.tagName),
                            );
                        if (!alreadyHasIcon && !onlyImage) {
                            children.splice(i + 1, 0, { type: 'text', value: WORD_JOINER }, newtabIcon());
                        }
                    }
                }
                if (child.children) stack.push(child);
            }
        }
    };
}
