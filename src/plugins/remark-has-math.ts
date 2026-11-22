/**
 * 标记「这一篇是否含数学公式」。
 *
 * 用途：KaTeX 的样式表（katex.min.css，23 KB raw / 3.4 KB gzip）以前被静态打进
 * 每个正文页，而站里真正用公式的文章只有一两个。这里在构建期扫一遍语法树，把结果
 * 写进 frontmatter（与 remark-reading-time 同一个套路），页面再按它决定挂不挂样式表。
 *
 * ⚠️ 必须在 remark-math **之后**执行（那时才有 math / inlineMath 节点）。
 * 它只写 frontmatter、不改 HTML，因此 CMS 预览管线不需要接入（预览总是带上 KaTeX 样式）。
 */
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
