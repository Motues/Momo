/**
 * 搜索用的文本归一化与查询分析：中文切二元词（bigram），不依赖词典。
 * ⚠️ 索引与查询必须共用 normalizeText，否则同一短语在两边会算出不同 token。
 */

/** 零宽、方向控制、软连字符等不可见字符：直接当空白 */
const INVISIBLE = /[\u0000-\u001f\u007f\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;

/** 汉字 + 日文假名 + 韩文：没有空格分词，按二元词处理 */
const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;
const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]+/g;

export interface QueryAnalysis {
    /** 所有用于匹配的 term（中文二元词 + 英文单词） */
    terms: string[]
    /** 中文 term */
    cjk: string[]
    /** 英文 / 数字 term */
    latin: string[]
    /** 整个查询去掉空白后的原样，用于「整串连续命中」加分 */
    phrase: string
}

export function isCjkChar(char: string): boolean {
    return CJK_CHAR.test(char);
}

/** 归一化：NFKC 全角→半角、小写、去不可见字符、标点与符号→空格、压缩空白 */
export function normalizeText(input: string): string {
    return input
        .normalize('NFKC')
        .toLowerCase()
        .replace(INVISIBLE, ' ')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 把一段文本切成中文连续段（每段再切二元词） */
export function cjkBigrams(text: string): string[] {
    const out: string[] = [];
    for (const run of text.match(CJK_RUN) ?? []) {
        if (run.length <= 2) {
            out.push(run);
        } else {
            for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
        }
    }
    return out;
}

/** 取出英文 / 数字 token（中文已由 cjkBigrams 处理） */
export function latinTokens(text: string): string[] {
    return text
        .replace(CJK_RUN, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

/**
 * 分析查询：中文取二元词（1 / 2 字的连续段整体保留，最多 32 个），英文按词切分（最多 12 个）。
 */
export function analyzeQuery(raw: string): QueryAnalysis | null {
    const normalized = normalizeText(raw);
    if (!normalized) return null;

    const cjk = [...new Set(cjkBigrams(normalized))].slice(0, 32);
    const latin = [...new Set(latinTokens(normalized))].slice(0, 12);

    if (cjk.length === 0 && latin.length === 0) return null;

    return {
        cjk,
        latin,
        terms: [...cjk, ...latin],
        phrase: normalized.replace(/\s+/g, ''),
    };
}
