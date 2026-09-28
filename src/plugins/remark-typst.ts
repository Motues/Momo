import { visit } from 'unist-util-visit';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import type { Code, Root, RootContent } from 'mdast';
import type { Parent } from 'unist';

// 编译器初始化成本高，构建期复用同一个实例
const compiler = NodeCompiler.create();

/** 把 ```typst 代码块编译成 SVG，标题取 info string（支持 *斜体*） */
export function remarkTypst() {
  return async (tree: Root) => {
    const instances: Array<{ node: Code; index: number; parent: Parent }> = [];

    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'typst' && index !== undefined && parent) {
        instances.push({ node, index, parent });
      }
    });

    for (const { node, index, parent } of instances) {
      try {
        const title = node.meta ? node.meta.trim() : '';
        const formattedTitle = title.replace(/\*(.*?)\*/g, '<em>$1</em>');
        const svg = await compiler.svg({ mainFileContent: node.value });

        const rendered: RootContent = {
          type: 'html',
          value: `<div class="typst-render">
          ${svg}
          <div class="typst-title">${formattedTitle}</div>
          </div>`,
        };
        parent.children[index] = rendered;
      } catch (e) {
        console.error('Typst compilation failed:', e);
      }
    }
  };
}
