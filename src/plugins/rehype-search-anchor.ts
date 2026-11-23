import type { Element, ElementContent, Root } from 'hast';

/**
 * 给正文顶层块注入稳定锚点（`s-1`…），供站内搜索深度链接；标题只加 `data-search-heading`，不改写 slug id。
 * ⚠️ 只处理顶层块与顶层列表的直接 li；id 只依赖文档顺序，`script/build-search-index.mjs` 按它切段落。
 */

const HEADING = /^h[1-6]$/;

// 这些子树里的文字不进索引，也就不需要锚点
const SKIP_TAGS = new Set(['pre', 'script', 'style', 'svg', 'button', 'template', 'noscript']);
const SKIP_CLASSES = new Set([
    'expressive-code',
    'katex',
    'katex-display',
    'sr-only',
    'newtab-icon',
]);

function classList(node: Element): string[] {
    const value = node.properties?.className;
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
    return [];
}

function isSkipped(node: Element): boolean {
    if (SKIP_TAGS.has(node.tagName)) return true;
    return classList(node).some((name) => SKIP_CLASSES.has(name));
}

function collectText(node: ElementContent, parts: string[]): void {
    if (node.type === 'text') {
        parts.push(node.value);
        return;
    }
    if (node.type !== 'element' || isSkipped(node)) return;
    for (const child of node.children) collectText(child, parts);
}

/** 块内可读文字（跳过代码 / 公式 / 按钮等） */
function visibleText(node: Element): string {
    const parts: string[] = [];
    for (const child of node.children) collectText(child, parts);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function rehypeSearchAnchor() {
    return (tree: Root) => {
        let counter = 0;

        const assign = (node: Element): void => {
            if (isSkipped(node)) return;
            if (visibleText(node).length < 2) return;

            const properties = node.properties ?? (node.properties = {});
            properties.dataSearchAnchor = '';
            if (!properties.id) properties.id = `s-${++counter}`;
        };

        for (const child of tree.children) {
            if (child.type !== 'element') continue;

            if (HEADING.test(child.tagName)) {
                // 标题的 id 由 Astro 的 heading-id 插件负责，这里只做标记
                if (!visibleText(child)) continue;
                const properties = child.properties ?? (child.properties = {});
                properties.dataSearchAnchor = '';
                properties.dataSearchHeading = '';
                continue;
            }

            if (child.tagName === 'ul' || child.tagName === 'ol') {
                for (const item of child.children) {
                    if (item.type === 'element' && item.tagName === 'li') assign(item);
                }
                continue;
            }

            assign(child);
        }
    };
}
