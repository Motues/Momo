/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * 创建一个引用组件 (Quote Component)
 * @param {Object} properties - 节点属性
 * @param {import('mdast').RootContent[]} children - 引用内容
 * @returns {import('hast').Element}
 */
export function QuoteComponent(properties, children) {
    if (!Array.isArray(children) || children.length === 0) {
        return h("div", { class: "hidden" }, "Invalid quote content");
    }

    let currentChildren = properties?.["has-directive-label"] ? children.slice(1) : children;

    const processNodes = (nodes) => {
        return nodes.flatMap((node, index) => {
            if (node.type !== 'element') return node;
            if (node.tagName === 'p') {
                const pContent = processNodes(node.children || []);
                
                // 如果这不是最后一个节点，我们在段落后面补一个 <br /> 来模拟原有的换行
                if (index < nodes.length - 1) {
                    return [...pContent, h("br")];
                }
                return pContent;
            }
            return {
                ...node,
                children: processNodes(node.children || [])
            };
        });
    };

    return h("div", { class: "quote" }, processNodes(currentChildren));
}
