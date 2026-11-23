/**
 * 表情面板的数据层：并发拉取一组 owo.json、按数组顺序合并标签，并构建标签页与短代码映射（契约见 `doc/emoji.md`）。
 * 短代码：`text` 归一化合法则用它，否则用 `src` 的 FNV-1a 哈希 `e-<8 位十六进制>`；重名追加 `-2`/`-3`。
 * 缓存：`EMOJI_CACHE_TTL_MS`（7 天）内可同步水合，`EMOJI_REVALIDATE_MS`（6 小时）到点静默校验。
 */

export interface OwoItem {
	icon?: string;
	text?: string;
}

export interface OwoPack {
	type?: string;
	enabled?: boolean;
	container?: OwoItem[];
}

export type OwoShape = Record<string, OwoPack>;

export interface EmojiTabItem {
	/** 点击后插入评论框的内容：文本表情就是文本，图片表情是 `:name:` 短代码 */
	insert: string;
	/** 预览：文本表情是文本本身；图片表情是 data:/https: 图片地址 */
	preview: string;
	title: string;
	/** 图片表情的短代码（文本表情为 undefined） */
	shortcode?: string;
}

export interface EmojiTab {
	id: string;
	label: string;
	items: EmojiTabItem[];
}

export interface EmojiSet {
	tabs: EmojiTab[];
	/** 短代码 → 图片地址（只含通过校验的图片项） */
	images: Map<string, string>;
	/** 表情包是否来自过期缓存（面板据此提示「加载失败，用的是旧缓存」） */
	stale?: boolean;
	/** 是否只加载到**部分**来源（另有来源失败；面板据此提示可重试） */
	partial?: boolean;
}

export const EMOJI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** 后台校验间隔：缓存照常用，超过这个时间就静默拉一次来源（7 天的 TTL 只是「离线可用期」） */
export const EMOJI_REVALIDATE_MS = 6 * 60 * 60 * 1000;
export const EMOJI_CACHE_PREFIX = 'momo_emoji_cache_v1:';
export const EMOJI_MAX_TEXT_LENGTH = 64;
export const EMOJI_MAX_REMOTE_URL = 2048;

const SHORTCODE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const DATA_ICON_RE = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const REMOTE_ICON_RE = /^https:\/\/[^"<>]+$/;
const IMG_TAG_RE = /^<img\s+src="([^"<>]+)"\s*\/?>$/;

/** 码点长度（`😂` 算 1 个而不是 2 个） */
export function codePointLength(value: string): number {
	return [...String(value ?? '')].length;
}

/** FNV-1a 32 位哈希（十六进制，8 位）。同步、无依赖、跨浏览器一致。 */
export function fnv1aHex(text: string): string {
	let hash = 0x811c9dc5;
	const value = String(text ?? '');
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
}

/** 文案 → 合法短代码；无法归一化时返回空串 */
export function normalizeShortcode(label: unknown): string {
	const normalized = String(label ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 32);
	return SHORTCODE_NAME_RE.test(normalized) ? normalized : '';
}

/**
 * 把文本表情里的 HTML 实体还原成字符：只解一层、最小具名实体集 + 数字实体。
 * 不用 DOMParser / textarea：水合路径与单元测试环境不保证有 DOM。
 */
const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00a0',
};

export function decodeHtmlEntities(text: string): string {
	return String(text ?? '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
		if (body[0] === '#') {
			const isHex = body[1] === 'x' || body[1] === 'X';
			const code = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
			// 拒绝 0 / 代理项 / 超出 Unicode 上限的码点，避免还原出非法字符
			if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
			if (code >= 0xd800 && code <= 0xdfff) return match;
			return String.fromCodePoint(code);
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

/**
 * 从 `image` 项的 icon 里取出安全的图片地址（渲染侧安全边界）：只放行
 * `data:image/{png,jpeg,gif,webp};base64,…` 与 `https://…`，其余（含 svg data URI、http）一律丢弃。
 */
export function safeImageUrl(icon: unknown): string {
	const matched = IMG_TAG_RE.exec(String(icon ?? ''));
	if (!matched) return '';
	const url = matched[1];

	const dataIcon = DATA_ICON_RE.exec(url);
	if (dataIcon) return `data:${dataIcon[1]};base64,${dataIcon[2]}`;

	if (REMOTE_ICON_RE.test(url) && codePointLength(url) <= EMOJI_MAX_REMOTE_URL) return url;

	return '';
}

/**
 * 扫描文本里的短代码：名称前不能是字母/数字、后不能是数字（否则 `12:30:45` 会被当成短代码）。
 * 不用正则 lookbehind：Safari 16.4 之前不支持，本组件要覆盖 iOS 15+。
 */
export function findShortcodes(
	text: string,
	limit = Number.POSITIVE_INFINITY
): Array<{ start: number; end: number; name: string }> {
	const matches: Array<{ start: number; end: number; name: string }> = [];
	const value = String(text ?? '');
	let index = 0;

	while (index < value.length && matches.length < limit) {
		const start = value.indexOf(':', index);
		if (start < 0) break;
		const end = value.indexOf(':', start + 1);
		if (end < 0) break;

		const name = value.slice(start + 1, end);
		const before = start > 0 ? value[start - 1] : '';
		const after = end + 1 < value.length ? value[end + 1] : '';
		if (SHORTCODE_NAME_RE.test(name) && !/[0-9a-z]/i.test(before) && !/[0-9]/.test(after)) {
			matches.push({ start, end: end + 1, name });
			index = end + 1;
		} else {
			index = start + 1;
		}
	}
	return matches;
}

export function containsShortcode(text: string): boolean {
	return findShortcodes(text, 1).length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 只保留结构正确的标签与项（脏数据直接丢弃，绝不让它进入渲染路径） */
export function sanitizePacks(raw: unknown): OwoShape {
	if (!isPlainObject(raw)) return {};

	const packs: OwoShape = {};
	for (const [label, pack] of Object.entries(raw)) {
		if (!isPlainObject(pack)) continue;
		const container = Array.isArray(pack.container) ? pack.container : [];
		const items: OwoItem[] = [];
		for (const item of container) {
			if (!isPlainObject(item)) continue;
			if (typeof item.icon !== 'string' || item.icon === '') continue;
			items.push({
				icon: item.icon,
				text: typeof item.text === 'string' ? item.text : '',
			});
		}
		packs[String(label)] = {
			type: typeof pack.type === 'string' ? pack.type : 'image',
			enabled: pack.enabled !== false,
			container: items,
		};
	}
	return packs;
}

/** 归一化表情地址列表：只留非空字符串、顺序原样保留；单个字符串也兼容，空值得到空数组 */
export function normalizeCdnUrls(cdnUrls: string | string[] | null | undefined): string[] {
	const list = Array.isArray(cdnUrls) ? cdnUrls : typeof cdnUrls === 'string' ? [cdnUrls] : [];
	return list.filter((url): url is string => typeof url === 'string' && url !== '');
}

/**
 * 合并两个来源的 owo 形状：顶层标签保持**首次出现**的顺序，同名标签把 `container`
 * 追加进已有标签（不新建标签页）；标签自身的 `type` / `enabled` 以首次出现的来源为准。
 */
export function mergePacks(target: OwoShape, source: OwoShape): OwoShape {
	for (const [label, pack] of Object.entries(source)) {
		const existing = target[label];
		if (!existing) {
			target[label] = { ...pack, container: [...(pack.container ?? [])] };
			continue;
		}
		existing.container = [...(existing.container ?? []), ...(pack.container ?? [])];
	}
	return target;
}

/** 缓存键 = `EMOJI_CACHE_PREFIX` + 地址列表的 JSON（顺序即语义：不同列表 = 不同缓存） */
function cacheKey(cdnUrlsKey: string): string {
	return `${EMOJI_CACHE_PREFIX}${cdnUrlsKey}`;
}

interface EmojiCacheEntry {
	savedAt: number;
	/** 最近一次向来源校验（或尝试过）的时间；旧缓存没有这个字段时回落到 `savedAt` */
	revalidatedAt?: number;
	packs: OwoShape;
}

/** 读取 owo.json 的本地缓存（同步、零请求）；`cdnUrl` 实为**整个地址列表**的 JSON，不是单个地址 */
export function readEmojiCache(cdnUrl: string, storage: Storage | null = safeStorage()): EmojiCacheEntry | null {
	if (!cdnUrl || !storage) return null;
	try {
		const raw = storage.getItem(cacheKey(cdnUrl));
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return null;
		if (!Number.isFinite(parsed.savedAt) || !isPlainObject(parsed.packs)) return null;
		const entry: EmojiCacheEntry = { savedAt: parsed.savedAt, packs: sanitizePacks(parsed.packs) };
		if (Number.isFinite(parsed.revalidatedAt)) entry.revalidatedAt = parsed.revalidatedAt;
		return entry;
	} catch {
		return null;
	}
}

/**
 * 写入 owo.json 缓存（存储被禁用时静默失败）；`cdnUrl` 同样是地址列表的 JSON。
 * `revalidatedAt` 默认等于写入时间；只更新时间、不改内容请用 `touchEmojiCache`。
 */
export function writeEmojiCache(
	cdnUrl: string,
	packs: OwoShape,
	storage: Storage | null = safeStorage(),
	now = Date.now(),
	revalidatedAt = now
): boolean {
	if (!cdnUrl || !storage) return false;
	try {
		storage.setItem(cacheKey(cdnUrl), JSON.stringify({ savedAt: now, revalidatedAt, packs }));
		return true;
	} catch {
		return false;
	}
}

/** 只把「最近校验时间」推到 `revalidatedAt`（内容与 `savedAt` 都不动），避免同一访客每页都重试 */
export function touchEmojiCache(
	cdnUrl: string,
	storage: Storage | null = safeStorage(),
	revalidatedAt = Date.now()
): boolean {
	const entry = readEmojiCache(cdnUrl, storage);
	if (!entry) return false;
	return writeEmojiCache(cdnUrl, entry.packs, storage, entry.savedAt, revalidatedAt);
}

export function isEmojiCacheFresh(entry: EmojiCacheEntry | null, now = Date.now()): boolean {
	if (!entry) return false;
	const age = now - entry.savedAt;
	return age >= 0 && age < EMOJI_CACHE_TTL_MS;
}

/**
 * 缓存是否「到点该向来源校验了」：与 7 天可用期的 `isEmojiCacheFresh` 是两件事。
 * 没有缓存时返回 true，但调用方应走正常加载（`loadEmojiSet`）而不是后台校验。
 */
export function needsRevalidation(
	entry: EmojiCacheEntry | null,
	now = Date.now(),
	after = EMOJI_REVALIDATE_MS
): boolean {
	if (!entry) return true;
	const checkedAt = entry.revalidatedAt ?? entry.savedAt;
	const age = now - checkedAt;
	// 时钟倒退（age < 0）也当作到点：否则一次错乱的时间戳会让缓存永远不再校验
	return !(age >= 0 && age < after);
}

function safeStorage(): Storage | null {
	try {
		const storage = globalThis.localStorage;
		storage?.getItem('__momo_probe__');
		return storage ?? null;
	} catch {
		return null;
	}
}

async function fetchJson(url: string, fetchImpl: typeof fetch, cache?: RequestCache): Promise<unknown> {
	const init: RequestInit = { headers: { Accept: 'application/json' } };
	// 只有「强制重拉 / 后台校验」才指定 cache：'no-cache' 绕开浏览器 HTTP 缓存（源站没有 ETag）
	if (cache) init.cache = cache;
	const res = await fetchImpl(url, init);
	if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? '??'}`);
	return res.json();
}

export interface OwoLoadResult {
	packs: OwoShape;
	fromCache: boolean;
	/** 拉取失败但用了旧缓存 */
	stale: boolean;
	/** 只拿到了部分来源（另有来源失败）；成功的那几个照常合并 */
	partial?: boolean;
}

/** 拉取单个来源并做形状净化；不是合法 owo.json（没有任何标签）视为该来源失败 */
async function fetchPack(url: string, fetchImpl: typeof fetch, cache?: RequestCache): Promise<OwoShape> {
	const raw = await fetchJson(url, fetchImpl, cache);
	const packs = sanitizePacks(raw);
	if (Object.keys(packs).length === 0) throw new Error('owo.json 结构不正确');
	return packs;
}

/** 并发拉取全部来源并按数组顺序合并；失败的来源只记进 `errors`，不短路其他来源 */
async function fetchAllPacks(
	urls: string[],
	fetchImpl: typeof fetch,
	cache?: RequestCache
): Promise<{ packs: OwoShape; errors: unknown[] }> {
	const settled = await Promise.allSettled(urls.map((url) => fetchPack(url, fetchImpl, cache)));
	const merged: OwoShape = {};
	const errors: unknown[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') {
			mergePacks(merged, result.value);
		} else {
			errors.push(result.reason);
		}
	}
	return { packs: merged, errors };
}

/**
 * 拉取配置的 owo.json（可多个来源，按数组顺序并发拉取后合并）：命中 7 天缓存不发请求；
 * `force` 绕过缓存与浏览器 HTTP 缓存；部分成功标 `partial`，全部失败回退旧缓存并标 `stale`，
 * 连缓存都没有则抛错（由面板显示错误态）。
 */
export async function loadDefaultPacks(
	cdnUrls: string | string[],
	options: { force?: boolean; fetchImpl?: typeof fetch; storage?: Storage | null; now?: number } = {}
): Promise<OwoLoadResult> {
	const { force = false, fetchImpl = globalThis.fetch, storage = safeStorage(), now = Date.now() } = options;
	const urls = normalizeCdnUrls(cdnUrls);
	if (urls.length === 0) return { packs: {}, fromCache: true, stale: false, partial: false };

	const cdnUrlsKey = JSON.stringify(urls);
	const cached = readEmojiCache(cdnUrlsKey, storage);
	if (!force && cached && isEmojiCacheFresh(cached, now)) {
		return { packs: cached.packs, fromCache: true, stale: false, partial: false };
	}
	if (typeof fetchImpl !== 'function') {
		if (cached) return { packs: cached.packs, fromCache: true, stale: true, partial: false };
		throw new Error('当前环境不支持 fetch');
	}

	const { packs: merged, errors } = await fetchAllPacks(urls, fetchImpl, force ? 'no-cache' : undefined);

	if (errors.length === urls.length) {
		if (cached) return { packs: cached.packs, fromCache: true, stale: true, partial: false };
		const first = errors[0];
		throw first instanceof Error ? first : new Error('owo.json 加载失败');
	}

	writeEmojiCache(cdnUrlsKey, merged, storage, now);
	return { packs: merged, fromCache: false, stale: false, partial: errors.length > 0 };
}

/**
 * 把一份 owo 形状的数据转成标签页 + 短代码映射，标签顺序 = 各来源首次出现的顺序。
 * 只有显式声明 `emoji` / `emoticon` 的标签走文本分支，缺省与无法识别的 `type` 一律按 `image` 处理。
 */
export function buildEmojiSet(packs: OwoShape, options: { stale?: boolean; partial?: boolean } = {}): EmojiSet {
	const tabs: EmojiTab[] = [];
	const images = new Map<string, string>();

	for (const [label, pack] of Object.entries(packs ?? {})) {
		if (pack?.enabled === false) continue;
		const isTextPack = pack?.type === 'emoji' || pack?.type === 'emoticon';
		const used = new Set<string>();
		const items: EmojiTabItem[] = [];

		for (const raw of pack?.container ?? []) {
			if (!isTextPack) {
				const url = safeImageUrl(raw.icon);
				if (!url) continue;

				let name = normalizeShortcode(raw.text) || `e-${fnv1aHex(url)}`;
				// 名字被同包前面的项或靠前的包占用时追加 -2/-3……，否则水合会指向靠前包的那张图
				if (used.has(name) || images.has(name)) {
					let suffix = 2;
					while (used.has(`${name}-${suffix}`) || images.has(`${name}-${suffix}`)) suffix += 1;
					name = `${name}-${suffix}`;
				}
				used.add(name);
				images.set(name, url);

				items.push({
					insert: `:${name}:`,
					preview: url,
					title: raw.text || name,
					shortcode: name,
				});
				continue;
			}

			const text = decodeHtmlEntities(String(raw.icon ?? ''));
			if (!text) continue;
			if (codePointLength(text) > EMOJI_MAX_TEXT_LENGTH) continue;
			// 解码后再过滤尖括号：`&lt;` 会还原成 `<`，不能让它绕长度与尖括号过滤
			if (/[<>]/.test(text)) continue;
			// 悬停提示同样解实体
			const title = decodeHtmlEntities(String(raw.text ?? '')) || text;
			items.push({ insert: text, preview: text, title });
		}

		if (items.length === 0) continue;
		tabs.push({ id: label, label, items });
	}

	return {
		tabs,
		images,
		stale: options.stale ?? false,
		partial: options.partial ?? false,
	};
}

/**
 * 只读本地缓存构建的表情集合（同步、零请求）；`cdnUrls` 是完整地址列表（缓存键就是它的 JSON）。
 */
export function getCachedEmojiSet(
	options: { cdnUrls?: string | string[]; cdnUrl?: string | string[]; storage?: Storage | null; now?: number } = {}
): EmojiSet {
	const { storage = safeStorage(), now = Date.now() } = options;
	const urls = normalizeCdnUrls(options.cdnUrls ?? options.cdnUrl ?? []);
	const cached = urls.length > 0 ? readEmojiCache(JSON.stringify(urls), storage) : null;
	const packs = cached && isEmojiCacheFresh(cached, now) ? cached.packs : {};
	return buildEmojiSet(packs);
}

/**
 * 同步判断「本地缓存是否到点该后台校验了」：**没有缓存时返回 false**，那种情况应走 `loadEmojiSet`。
 */
export function emojiCacheNeedsRevalidation(
	options: {
		cdnUrls?: string | string[];
		cdnUrl?: string | string[];
		storage?: Storage | null;
		now?: number;
		revalidateAfter?: number;
	} = {}
): boolean {
	const { storage = safeStorage(), now = Date.now(), revalidateAfter = EMOJI_REVALIDATE_MS } = options;
	const urls = normalizeCdnUrls(options.cdnUrls ?? options.cdnUrl ?? []);
	if (urls.length === 0) return false;
	const entry = readEmojiCache(JSON.stringify(urls), storage);
	return entry ? needsRevalidation(entry, now, revalidateAfter) : false;
}

let moduleCache: { key: string; set: EmojiSet } | null = null;
let inflight: { key: string; promise: Promise<EmojiSet> } | null = null;
/** 后台校验的并发去重（返回值语义与 `inflight` 不同，单独记一份） */
let revalidateInflight: { key: string; promise: Promise<EmojiSet | null> } | null = null;

/** 测试用：清掉模块级缓存 */
export function resetEmojiSetCache(): void {
	moduleCache = null;
	inflight = null;
	revalidateInflight = null;
}

/**
 * 加载表情集合（来源 = 配置的一组 owo.json 地址，按数组顺序合并）：命中 7 天缓存不发请求；
 * 部分来源失败照常渲染并标 `partial`，全部失败回退旧缓存标 `stale`。
 * 同一地址列表的并发调用共享一次加载，结果缓存到模块级，各回复框的 picker 不会各拉一份。
 */
export async function loadEmojiSet(options: {
	cdnUrls: string | string[];
	force?: boolean;
	fetchImpl?: typeof fetch;
	storage?: Storage | null;
	now?: number;
}): Promise<EmojiSet> {
	const { cdnUrls = [], force = false, fetchImpl = globalThis.fetch } = options;
	const urls = normalizeCdnUrls(cdnUrls);
	// 模块级缓存/并发去重的键 = 地址列表的 JSON（顺序不同就是不同的一批来源）
	const key = JSON.stringify(urls);

	if (!force && moduleCache && moduleCache.key === key) return moduleCache.set;
	if (!force && inflight && inflight.key === key) return inflight.promise;

	const promise = (async () => {
		const result = await loadDefaultPacks(urls, {
			force,
			fetchImpl,
			storage: options.storage,
			now: options.now,
		});
		return buildEmojiSet(result.packs, { stale: result.stale, partial: result.partial });
	})();

	inflight = { key, promise };
	try {
		const set = await promise;
		moduleCache = { key, set };
		return set;
	} finally {
		if (inflight?.key === key) inflight = null;
	}
}

/**
 * 后台校验（stale-while-revalidate）：返回值就是「要不要换界面」——
 * `null` = 内容没变 / 有来源失败 / 无缓存基线，保持现有界面；`EmojiSet` = 内容确实变了，直接替换。
 * 任一来源失败不换界面（合并结果会缺一整包），但把 `revalidatedAt` 推到当前时间以维持重试节奏。
 */
export async function revalidateEmojiSet(options: {
	cdnUrls: string | string[];
	fetchImpl?: typeof fetch;
	storage?: Storage | null;
	now?: number;
}): Promise<EmojiSet | null> {
	const { cdnUrls = [], fetchImpl = globalThis.fetch, storage = safeStorage(), now = Date.now() } = options;
	const urls = normalizeCdnUrls(cdnUrls);
	if (urls.length === 0) return null;

	const key = JSON.stringify(urls);
	const cached = readEmojiCache(key, storage);
	if (!cached) return null;
	if (typeof fetchImpl !== 'function') return null;

	if (revalidateInflight && revalidateInflight.key === key) return revalidateInflight.promise;

	const promise = (async () => {
		const { packs, errors } = await fetchAllPacks(urls, fetchImpl, 'no-cache');

		if (errors.length > 0) {
			touchEmojiCache(key, storage, now);
			return null;
		}

		if (JSON.stringify(packs) === JSON.stringify(cached.packs)) {
			touchEmojiCache(key, storage, now);
			return null;
		}

		writeEmojiCache(key, packs, storage, now);
		const set = buildEmojiSet(packs);
		// 模块级缓存同步成最新，后续 loadEmojiSet / 面板不会再退回旧集合
		if (moduleCache && moduleCache.key === key) moduleCache = { key, set };
		return set;
	})();

	revalidateInflight = { key, promise };
	try {
		return await promise;
	} finally {
		if (revalidateInflight && revalidateInflight.key === key) revalidateInflight = null;
	}
}
