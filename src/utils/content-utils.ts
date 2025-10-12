import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { i18n } from "astro:config/client";

/**
 * 获取排序后的博客条目
 * @param filter 过滤函数，可选，默认过滤掉生产环境中的草稿文章
 * @param sort 排序函数，可选，默认按发布日期降序排列
 * @returns 排序后的博客条目数组
 */
export async function getBlogEntrySort(
  lang: string,
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

  // 按照 id 分组文章
  const grouped = new Map<string, Record<string, CollectionEntry<'blog'>>>();
  
  const defaultLanguage = i18n.defaultLocale;
  for (const post of blogEntries) {
    // 解析 id 和语言
    const parts = post.id.split('/');
    const fileName = parts[parts.length - 1]; // 最后一部分是文件名
    const id = parts.slice(0, -1).join('/'); // 除最后一部分外的路径
    
    // 提取语言代码
    const language: string = fileName.replace('.md', ''); // 如 en.md 等;

    if (!grouped.has(id)) {
      grouped.set(id, {});
    }
    grouped.get(id)![language] = post;
  }

  // 根据语言参数选择文章
  const selectedEntries: CollectionEntry<'blog'>[] = [];
  
  for (const [id, translations] of grouped.entries()) {
    let selectedPost: CollectionEntry<'blog'> | undefined;
    
    if (lang && lang !== defaultLanguage) {
      // 如果指定了语言且不是默认语言，优先选择该语言版本
      if (translations[lang]) {
        selectedPost = translations[lang];
      } else if (translations[defaultLanguage]) {
        // 回退到默认语言
        selectedPost = translations[defaultLanguage];
      }
    } else {
      // 默认语言或未指定语言时选择 index 版本
      if (translations[defaultLanguage]) {
        selectedPost = translations[defaultLanguage];
      }
    }
    
    // 如果找到了对应版本的文章，则添加到结果中，并标准化 id
    if (selectedPost) {
      const normalizedEntry = {
        ...selectedPost,
        id: id // 标准化 id 为不带语言的部分
      };
      selectedEntries.push(normalizedEntry);
    }
  }

  // 应用排序并返回结果
  return selectedEntries.sort(sort || defaultSort);
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