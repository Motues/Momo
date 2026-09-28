import { h } from 'hastscript';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Properties } from 'hast';
import type { Node as UnistNode, Parent } from 'unist';

/** remark-directive 的指令节点（mdast 类型未收录，这里声明最小结构） */
interface DirectiveChild extends UnistNode {
  data?: { directiveLabel?: boolean };
}

interface DirectiveData {
  hName?: string;
  hProperties?: Properties;
}

interface DirectiveNode extends Parent {
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes: Properties;
  data?: DirectiveData;
  children: DirectiveChild[];
}

/** 把 :::note{...} 这类指令转成对应 hast 标签，交给 rehype-components 渲染 */
export function parseDirectiveNode() {
  return (tree: Root) => {
    visit(tree, (node) => {
      // mdast 的类型里没有指令节点，先按字符串比较再断言
      const type: string = node.type;
      if (
        type !== 'containerDirective' &&
        type !== 'leafDirective' &&
        type !== 'textDirective'
      ) {
        return;
      }

      const directive = node as unknown as DirectiveNode;
      const data = directive.data || (directive.data = {});
      directive.attributes = directive.attributes || {};

      // 指令标签（:::note[标题] 里的 [标题]）打上标记，组件会把它当作标题
      if (directive.children[0]?.data?.directiveLabel) {
        directive.attributes['has-directive-label'] = true;
      }

      const hast = h(directive.name, directive.attributes);
      data.hName = hast.tagName;
      data.hProperties = hast.properties;
    });
  };
}
