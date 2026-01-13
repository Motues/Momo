// remark-typst.mjs
import { visit } from 'unist-util-visit';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';

// 初始化编译器（建议单例模式以提高性能）
const compiler = NodeCompiler.create();

export function remarkTypst() {
  return async (tree) => {
    const instances = [];

    // 1. 收集所有 typst 代码块
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'typst') {
        instances.push({ node, index, parent });
      }
    });

    // 2. 异步并行渲染
    for (const { node, index, parent } of instances) {
      try {
        const title = node.meta ? node.meta.trim() : '';
        const formattedTitle = title.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // 编译为 SVG 字符串
        const svg = await compiler.svg({
          mainFileContent: node.value,
        });

        // 将代码块替换为 raw 类型的 HTML 节点
        parent.children[index] = {
          type: 'html',
          value: `<div class="typst-render">
          ${svg}
          <div class="typst-title">${formattedTitle}</div>
          </div>`,
        };
      } catch (e) {
        console.error('Typst compilation failed:', e);
      }
    }
  };
}