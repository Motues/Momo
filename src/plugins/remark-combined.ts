import { visit } from 'unist-util-visit';
import type { PhrasingContent, Root } from 'mdast';

/** 行内语法：{中文}(拼音) 注音、!!折叠!!、==彩虹==、++下划线++ */
export function remarkCombined() {
  function processText(text: string): PhrasingContent[] {
    if (!text) return [];

    // 分组：1/2 = Ruby，3 = 折叠，4 = 彩虹，5 = 下划线
    const regex = /\{(.+?)\}\((.+?)\)|!!(.+?)!!|==(.+?)==|\+\+(.+?)\+\+/g;
    const nodes: PhrasingContent[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }

      if (match[1] && match[2]) {
        const baseText = match[1];
        const readingText = match[2];
        let rubyInnerHtml = '';

        if (readingText.includes('|')) {
          // 逐字注音：{漢字}(han|zi)
          const baseChars = Array.from(baseText);
          const readings = readingText.split('|');
          const maxLength = Math.max(baseChars.length, readings.length);

          for (let i = 0; i < maxLength; i++) {
            rubyInnerHtml += `${baseChars[i] || ''}<rt>${readings[i] || ''}</rt>`;
          }
        } else {
          rubyInnerHtml = `${baseText}<rt>${readingText}</rt>`;
        }
        nodes.push({ type: 'html', value: `<ruby>${rubyInnerHtml}</ruby>` });
      } else if (match[3]) {
        nodes.push({ type: 'html', value: '<span class="spoiler">' });
        nodes.push(...processText(match[3]));
        nodes.push({ type: 'html', value: '</span>' });
      } else if (match[4]) {
        nodes.push({ type: 'html', value: '<span class="rainbow-text">' });
        nodes.push(...processText(match[4]));
        nodes.push({ type: 'html', value: '</span>' });
      } else if (match[5]) {
        nodes.push({ type: 'html', value: '<span class="underline-text">' });
        nodes.push(...processText(match[5])); // 支持嵌套
        nodes.push({ type: 'html', value: '</span>' });
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      nodes.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return nodes.length > 0 ? nodes : [{ type: 'text', value: text }];
  }

  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!node.value || index === undefined || !parent) return;

      const resultNodes = processText(node.value);
      if (resultNodes.length > 1 || (resultNodes.length === 1 && resultNodes[0].type !== 'text')) {
        parent.children.splice(index, 1, ...resultNodes);
        return index + resultNodes.length;
      }
    });
  };
}
