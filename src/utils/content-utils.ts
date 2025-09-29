import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

/**
 * 获取排序后的博客条目
 * @param filter 过滤函数，可选，默认过滤掉生产环境中的草稿文章
 * @param sort 排序函数，可选，默认按发布日期降序排列
 * @returns 排序后的博客条目数组
 */
export async function getBlogEntrySort(
  filter?: (entry: CollectionEntry<'blog'>) => boolean | undefined,
  sort?: (a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => number
): Promise<CollectionEntry<'blog'>[]> {
  // 默认过滤函数：在生产环境中过滤掉草稿文章
  const defaultFilter = ({ data }: CollectionEntry<'blog'>) => {
    return import.meta.env.PROD ? data.draft !== true : true;
  };

  // 默认排序函数：按发布日期降序排列
  const defaultSort = (a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => {
    return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
  };

  // 获取博客集合，应用过滤器
  const blogEntries = await getCollection('blog', filter || defaultFilter);

  // 应用排序并返回结果
  return blogEntries.sort(sort || defaultSort);
}

/**
 * 解析备忘录内容
 * @param content 备忘录文件内容
 * @returns 备忘录数组
 */
export function parseMessages(content: string): Array<{time: string, content: string}> {
  // 由于 Astro 的 body 属性不包含 frontmatter 之外的标题，我们需要解析原始内容
  // 这里我们按 ## 标题分割内容
  const messageSections = content.split('\n## ');
  const messages: Array<{time: string, content: string}> = [];
  
  // 跳过第一个部分（通常是标题行）
  for (let i = 1; i < messageSections.length; i++) {
    const section = messageSections[i].trim();
    if (!section) continue;
    
    // 第一行为时间，其余为内容
    const lines = section.split('\n');
    const time = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    
    if (time && content) {
      messages.push({
        time,
        content
      });
    }
  }
  
  return messages.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}