import { visit } from 'unist-util-visit';

export function remarkCombined() {
  function processText(text) {
    if (!text) return [];

    // 关键修复：正则表达式新增了 ++(.+?)++ 用于匹配下划线
    // 分组索引：{1}(2) = Ruby, 3 = Spoiler, 4 = Rainbow, 5 = Underline
    const regex = /\{(.+?)\}\((.+?)\)|!!(.+?)!!|==(.+?)==|\+\+(.+?)\+\+/g;
    const nodes = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // 1. 添加匹配项之前的纯文本
      if (match.index > lastIndex) {
        nodes.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }

      if (match[1] && match[2]) {
        // --- Ruby 逻辑 ---
        const baseText = match[1];
        const readingText = match[2];
        let rubyInnerHtml = '';

        if (readingText.includes('|')) {
          const baseChars = Array.from(baseText);
          const readings = readingText.split('|');
          const maxLength = Math.max(baseChars.length, readings.length);

          for (let i = 0; i < maxLength; i++) {
            const char = baseChars[i] || '';
            const rt = readings[i] || '';
            rubyInnerHtml += `${char}<rt>${rt}</rt>`;
          }
        } else {
          rubyInnerHtml = `${baseText}<rt>${readingText}</rt>`;
        }
        nodes.push({ type: 'html', value: `<ruby>${rubyInnerHtml}</ruby>` });

      } else if (match[3]) {
        // --- Spoiler (!!...!!) ---
        nodes.push({ type: 'html', value: '<span class="spoiler">' });
        nodes.push(...processText(match[3]));
        nodes.push({ type: 'html', value: '</span>' });

      } else if (match[4]) {
        // --- Rainbow (==...==) ---
        nodes.push({ type: 'html', value: '<span class="rainbow-text">' });
        nodes.push(...processText(match[4]));
        nodes.push({ type: 'html', value: '</span>' });

      } else if (match[5]) {
        // --- Underline (++...++) ---
        nodes.push({ type: 'html', value: '<span class="underline-text">' });
        nodes.push(...processText(match[5])); // 支持嵌套
        nodes.push({ type: 'html', value: '</span>' });
      }

      lastIndex = regex.lastIndex;
    }

    // 3. 处理剩余文本
    if (lastIndex < text.length) {
      nodes.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return nodes.length > 0 ? nodes : [{ type: 'text', value: text }];
  }

  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!node.value) return;

      const resultNodes = processText(node.value);
      
      if (resultNodes.length > 1 || (resultNodes.length === 1 && resultNodes[0].type !== 'text')) {
        parent.children.splice(index, 1, ...resultNodes);
        return index + resultNodes.length;
      }
    });
  };
}