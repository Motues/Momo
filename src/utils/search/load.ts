/**
 * 按语言加载搜索索引。
 *
 * 索引文件由构建脚本写到 `dist/search-index/<lang>.json`，同一个语言在一个
 * 会话里只请求一次；失败时把缓存删掉，下次输入还能重试。
 */

import type { SearchIndexFile } from '@/types/search';
import { baseUrl } from '@utils/urlUtils';
import { prepareIndex, type PreparedIndex } from './rank';

export type SearchIndexErrorKind = 'missing' | 'network' | 'invalid';

export class SearchIndexError extends Error {
    readonly kind: SearchIndexErrorKind;

    constructor(kind: SearchIndexErrorKind, message: string) {
        super(message);
        this.name = 'SearchIndexError';
        this.kind = kind;
    }
}

const cache = new Map<string, Promise<PreparedIndex>>();

/** 加载并预处理指定语言的索引（同一语言并发调用会复用同一个 Promise） */
export function loadSearchIndex(lang: string): Promise<PreparedIndex> {
    const cached = cache.get(lang);
    if (cached) return cached;

    const task = fetchIndex(lang);
    cache.set(lang, task);
    task.catch(() => {
        if (cache.get(lang) === task) cache.delete(lang);
    });
    return task;
}

async function fetchIndex(lang: string): Promise<PreparedIndex> {
    let response: Response;
    try {
        response = await fetch(baseUrl(`/search-index/${encodeURIComponent(lang)}.json`), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        });
    } catch (error) {
        throw new SearchIndexError('network', `搜索索引请求失败：${String(error)}`);
    }

    if (response.status === 404) {
        throw new SearchIndexError('missing', `缺少 ${lang} 的搜索索引`);
    }
    if (!response.ok) {
        throw new SearchIndexError('network', `搜索索引返回 ${response.status}`);
    }

    let data: SearchIndexFile;
    try {
        data = (await response.json()) as SearchIndexFile;
    } catch {
        throw new SearchIndexError('invalid', '搜索索引不是合法的 JSON');
    }

    if (
        !data ||
        data.v !== 1 ||
        typeof data.lang !== 'string' ||
        !Array.isArray(data.pages) ||
        !Array.isArray(data.blocks)
    ) {
        throw new SearchIndexError('invalid', '搜索索引格式不匹配');
    }

    return prepareIndex(data);
}
