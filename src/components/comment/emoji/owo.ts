/**
 * 表情面板的数据层：拉取 owo.json、短代码推导与标签构建。
 *
 * 契约 v3（见 `doc/emoji.md`，三端读同一份 `doc/vectors/emoji-v3.json`）：
 * 表情来源是管理员配置的**一组** OwO 格式地址（`emoji_cdn_urls`，最多 5 个），
 * 由访客浏览器**按数组顺序并发拉取后拼接合并**成一个面板；本站既不代理也不存储。
 * 旧的单地址 `emoji_cdn_url` 只在数组为空时作为回落（调用方归一化成数组后传进来）。
 * v1 的「自定义表情包」与本站公开表情接口已整体删除，这里不再有任何指向本站的表情请求。
 *
 * 多来源合并口径（doc/emoji.md 第 3.3 节）：
 *  - 顶层标签按「首次出现」的顺序排列；
 *  - 后面的来源出现同名标签时，把它的 `container` **追加**进已有标签（不新建标签页）；
 *  - `sanitizePacks` 逐个来源执行（脏数据在合并前就丢掉）；
 *  - 某个来源失败只丢这一个来源（`partial: true`），全部失败才回退本地缓存（`stale: true`）。
 *
 * 这里只做**渲染侧**的两件事：
 *  1. 把「标签名 → { type, container }」的 owo 形状转成标签页数据；
 *  2. 为 `image` 项推导短代码 `:name:`，并把「短代码 → 图片 URL」交给水合器。
 *
 * 短代码推导（与 doc/emoji.md 第 5 节一致）：
 *  1. `text` 归一化后合法就用它（`tv_doge` → `tv-doge`）；
 *  2. 否则用 `src` 的 FNV-1a 32 位哈希 → `e-<8 位十六进制>`；
 *  3. 同标签内重名、或与**标签栏靠前的标签**重名时追加 `-2`/`-3`……，
 *     保证每个条目都能水合回**它自己**那张图（否则 QQ 的动图会被 Bilibili 的同名静态图顶掉）。
 *     水合侧仍是「先到先得」，因此老评论里已有的 `:doge:` 不会图裂，只是继续指向靠前标签的图。
 *
 * 哈希刻意用同步的 FNV-1a 而不是 WebCrypto 的 SHA-1：水合发生在渲染路径上，
 * 需要一个同步可用的稳定哈希；而且非安全上下文（http 站点）里 `crypto.subtle` 根本不存在。
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
	/** 悬停提示 */
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
 * 从 `image` 项的 icon 里取出安全的图片地址。
 *
 * 这是渲染侧的安全边界：只有 `data:image/{png,jpeg,gif,webp};base64,…`
 * 与 `https://…` 会返回，其余（含 svg data URI、http、任意标签）一律丢弃 —— 水合器
 * 只会用这个返回值去 `createElement('img').src`。
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
 * 扫描文本里的短代码。
 *
 * 边界规则（两处都要满足）：
 *  - 名称前一个字符不能是字母/数字（否则 `12:30:45` 会被当成短代码）；
 *  - 名称后一个字符不能是数字（同上）。
 * 刻意不用正则 lookbehind：Safari 16.4 之前不支持，而本组件要覆盖 iOS 15+。
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

/** 文本里是否出现了短代码 */
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

/**
 * 归一化表情地址列表：只保留非空字符串，顺序原样保留。
 *
 * 兼容传进来单个字符串（旧调用方/旧测试）的情况；空值一律得到空数组。
 */
export function normalizeCdnUrls(cdnUrls: string | string[] | null | undefined): string[] {
	const list = Array.isArray(cdnUrls) ? cdnUrls : typeof cdnUrls === 'string' ? [cdnUrls] : [];
	return list.filter((url): url is string => typeof url === 'string' && url !== '');
}

/**
 * 合并两个来源的 owo 形状：顶层标签保持**首次出现**的顺序，
 * 后面的来源遇到同名标签时把 `container` 追加进已有标签（不新建标签页）。
 *
 * 标签自身的元数据（`type` / `enabled`）以**首次出现**的来源为准：标签的顺序与身份
 * 都按数组顺序确定，与 doc/emoji.md 第 3.3 节一致。`sanitizePacks` 已在合并前
 * 逐个来源执行过，因此这里的 container 里只会有结构正确的项。
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
	packs: OwoShape;
}

/**
 * 读取 owo.json 的本地缓存（同步、不发请求）。
 *
 * 第一个参数是**整个地址列表**的 JSON（`JSON.stringify(cdnUrls)`，见 doc/emoji.md 第 6 节），
 * 不是单个地址 —— 参数名保留 `cdnUrl` 只是为了少改调用点。
 */
export function readEmojiCache(cdnUrl: string, storage: Storage | null = safeStorage()): EmojiCacheEntry | null {
	if (!cdnUrl || !storage) return null;
	try {
		const raw = storage.getItem(cacheKey(cdnUrl));
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return null;
		if (!Number.isFinite(parsed.savedAt) || !isPlainObject(parsed.packs)) return null;
		return { savedAt: parsed.savedAt, packs: sanitizePacks(parsed.packs) };
	} catch {
		return null;
	}
}

/** 写入 owo.json 缓存（存储被禁用时静默失败）；`cdnUrl` 同样是地址列表的 JSON */
export function writeEmojiCache(
	cdnUrl: string,
	packs: OwoShape,
	storage: Storage | null = safeStorage(),
	now = Date.now()
): boolean {
	if (!cdnUrl || !storage) return false;
	try {
		storage.setItem(cacheKey(cdnUrl), JSON.stringify({ savedAt: now, packs }));
		return true;
	} catch {
		return false;
	}
}

export function isEmojiCacheFresh(entry: EmojiCacheEntry | null, now = Date.now()): boolean {
	if (!entry) return false;
	const age = now - entry.savedAt;
	return age >= 0 && age < EMOJI_CACHE_TTL_MS;
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

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
	const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
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
async function fetchPack(url: string, fetchImpl: typeof fetch): Promise<OwoShape> {
	const raw = await fetchJson(url, fetchImpl);
	const packs = sanitizePacks(raw);
	if (Object.keys(packs).length === 0) throw new Error('owo.json 结构不正确');
	return packs;
}

/**
 * 拉取配置的 owo.json（可多个来源，按数组顺序并发拉取后合并）。
 *
 * - 命中 7 天内的缓存（键 = 整个地址列表的 JSON）不发请求；
 * - 全部来源成功 → 合并结果（`partial: false`）；部分成功 → 合并成功的那几个并标 `partial: true`；
 * - 全部失败 → 回退旧缓存（标 `stale: true`）；连缓存都没有则抛错（由面板显示错误态）。
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

	// 并发拉取：一个来源失败不影响其他来源（Promise.allSettled 不会短路）
	const settled = await Promise.allSettled(urls.map((url) => fetchPack(url, fetchImpl)));
	const merged: OwoShape = {};
	const errors: unknown[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') {
			mergePacks(merged, result.value);
		} else {
			errors.push(result.reason);
		}
	}

	// 全部失败：回退旧缓存（哪怕已过期），没有缓存才抛错
	if (errors.length === settled.length) {
		if (cached) return { packs: cached.packs, fromCache: true, stale: true, partial: false };
		const first = errors[0];
		throw first instanceof Error ? first : new Error('owo.json 加载失败');
	}

	writeEmojiCache(cdnUrlsKey, merged, storage, now);
	return { packs: merged, fromCache: false, stale: false, partial: errors.length > 0 };
}

/**
 * 把一份 owo 形状的数据转成标签页 + 短代码映射。
 * 标签顺序 = owo.json 里键的顺序（多来源合并后 = 各来源首次出现的顺序）。
 *
 * 短代码跨标签/跨来源去重：靠前的标签先占名，后来的追加 `-2`/`-3`……，
 * 因此**不同来源的同名表情**也能各自水合回它自己那张图。
 *
 * `type` 口径（doc/emoji.md 第 2 节）：只有显式声明 `emoji` / `emoticon` 的标签走文本分支；
 * 缺省与**无法识别**的值一律按 `image` 处理（面板的在线校验会挡未知 type，
 * 能走到这里的未知值基本来自第三方文件里的图片包，按 image 处理才不会整包消失）。
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
				// 名字被同包前面的项占用，或已被**靠前的包**占用时，追加 -2/-3……
				//
				// 跨包重名不能沿用「先到先得」（后来的项继续指向靠前包的那张图）：
				// 默认源里 Bilibili 与 QQ 有 33 个同名表情（doge / sob / heart-eyes…），
				// QQ 是动图、Bilibili 是静态 PNG，先到先得会让用户从 QQ 面板点的动图
				// 在评论正文里变成 Bilibili 的静图——看起来就是「GIF 不动了」。
				// 给后来的项一个自己的名字，水合才会回到它自己的那张图。
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

			const text = String(raw.icon ?? '');
			if (!text) continue;
			if (codePointLength(text) > EMOJI_MAX_TEXT_LENGTH) continue;
			if (/[<>]/.test(text)) continue;
			items.push({ insert: text, preview: text, title: raw.text || text });
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
 * 只读本地缓存构建的表情集合（同步、零请求；用于首屏已有缓存时直接水合）。
 * `cdnUrls` 是完整地址列表（缓存键就是它的 JSON）。
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

let moduleCache: { key: string; set: EmojiSet } | null = null;
let inflight: { key: string; promise: Promise<EmojiSet> } | null = null;

/** 测试用：清掉模块级缓存 */
export function resetEmojiSetCache(): void {
	moduleCache = null;
	inflight = null;
}

/**
 * 加载表情集合（来源 = 配置的一组 owo.json 地址，按数组顺序合并）。
 *
 * - 命中 7 天缓存不发请求，否则并发拉取全部地址（可 force）；
 *   部分来源失败 → 成功的那几个照常渲染并标 `partial`；全部失败 → 回退旧缓存并标 `stale`。
 * - 同一个地址列表的并发调用共享一次加载；结果缓存在模块级，
 *   因此评论区里每个回复框的 picker 不会各拉一份。
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
