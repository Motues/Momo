import { i18n } from "astro:config/client";

import zhCN from "./language/zh-cn.ts";
import en from "./language/en.ts";

// 各语言代码 → 翻译数据
const translations = { "zh-cn": zhCN, en };

/** 为指定语言生成翻译函数，支持 `{name}` 占位符替换 */
function i18nit(language: string): (key: string, params?: Record<string, string | number>) => string {
	/** 按 `a.b.c` 路径取嵌套翻译值 */
	const nested = (language: string, key: string) => key.split('.').reduce((translation, key) => translation?.[key], (translations as any)[language]);

	/** 取翻译值，缺失时回退默认语言 */
	const fallback = (key: string) => nested(language, key) || nested(i18n!.defaultLocale, key);

	/** 缺失的键打 warn 并返回空串 */
	const t = (key: string, params?: Record<string, string | number>) => {
		const value = fallback(key);
		if (typeof value !== 'string') {
			console.warn(`[i18n] missing translation key: ${key} (${language})`);
			return '';
		}
		return value.replace(/\{(\w+)\}/g, (_, param) => String(params?.[param] ?? param));
	};

	return t;
}

export default i18nit;