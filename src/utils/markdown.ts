import { marked } from 'marked';

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }: { text: string }) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
});

export function parseMarkdown(content: string): string {
  if (!content) return '';
  const result = marked.parse(content);
  return typeof result === 'string' ? result : '';
}

export function validateMarkdown(content: string): string[] {
  const warnings: string[] = [];

  // Check for unclosed code fences (```)
  const fenceMatches = content.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    warnings.push('codeFence');
  }

  // Check for unclosed inline code (single backtick, but not inside code fences)
  const lines = content.split('\n');
  let inFence = false;
  let backtickCount = 0;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      for (const ch of line) {
        if (ch === '`') backtickCount++;
      }
    }
  }
  if (backtickCount % 2 !== 0) {
    warnings.push('inlineCode');
  }

  return warnings;
}
