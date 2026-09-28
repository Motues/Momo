import { toString } from 'mdast-util-to-string';
import getReadingTime from 'reading-time';
import type { Root } from 'mdast';
import type { VFile } from 'vfile';

/** Astro 注入到 vfile.data 上的结构 */
interface AstroFileData {
  astro: { frontmatter: { minutes?: number; words?: number } };
}

/** 把阅读时间与字数写进 frontmatter */
export function remarkReadingTime() {
  return (tree: Root, file: VFile) => {
    const readingTime = getReadingTime(toString(tree));
    const { frontmatter } = (file.data as unknown as AstroFileData).astro;

    frontmatter.minutes = Math.max(1, Math.round(readingTime.minutes));
    frontmatter.words = readingTime.words;
  };
}
