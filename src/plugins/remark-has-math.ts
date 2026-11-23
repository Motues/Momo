/** 标记「这一篇是否含数学公式」，结果写进 frontmatter，页面据此决定是否挂 KaTeX 样式表 */
/** ⚠️ 必须排在 remark-math 之后（那时才有 math / inlineMath 节点）；只写 frontmatter 不改 HTML，CMS 预览无需接入 */
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { VFile } from 'vfile';

/** Astro 注入到 vfile.data 上的结构 */
interface AstroFileData {
  astro: { frontmatter: { hasMath?: boolean } };
}

export function remarkHasMath() {
  return (tree: Root, file: VFile) => {
    let found = false;

    visit(tree, (node) => {
      if (node.type === 'math' || node.type === 'inlineMath') {
        found = true;
        return false; // 命中一个就够，不再往下走
      }
      return undefined;
    });

    const data = file.data as unknown as AstroFileData | undefined;
    if (!data?.astro?.frontmatter) return;
    data.astro.frontmatter.hasMath = found;
  };
}
