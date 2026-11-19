/**
 * 表情面板的数据层：拉取 owo.json、短代码推导与标签构建。
 *
 * 契约 v3（见 `doc/emoji.md`，三端读同一份 `doc/vectors/emoji-v3.json`）：
 * 表情来源是管理员配置的**一组** OwO 格式地址（`emoji_cdn_urls`，最多 5 个），
 * 由访客浏览器**按数组顺序并发拉取后拼接合并**成一个面板；本站既不代理也不存储。
 * 旧的单地址 `emoji_cdn_url` 只在数组为空时作为回落（调用方归一化成数组后传进来）。
 * v1 的「自定义表情包」与本站公开表情接口已整体删除，这里不再有任何指向本站的表情请求。
 *
 * 缓存策略（stale-while-revalidate，见 doc/emoji.md 第 6 节）：
 *  - `EMOJI_CACHE_TTL_MS`（7 天）是**可用期**：期内首屏可以直接用缓存同步水合；
 *  - `EMOJI_REVALIDATE_MS`（6 小时）是**校验间隔**：到点后由 `revalidateEmojiSet` 静默拉一次，
 *    内容变了才替换界面，没变/失败都保留缓存（源站没有 ETag，校验只能整份重下）。
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
/**
 * 后台校验（stale-while-revalidate）的间隔：缓存照常用，但超过这个时间就静默拉一次来源。
 *
 * 7 天的 `EMOJI_CACHE_TTL_MS` 是「离线可用期」，不是「新鲜期」——只靠它的话，管理员换了
 * owo.json 内容，老访客最多要等 7 天。默认 6 小时与源站 `cache-control: max-age=3600`
 * 同一量级（见 doc/emoji.md 第 6 节）；源站没有 ETag/Last-Modified，校验只能整份重下，
 * 所以间隔不能压到几分钟，否则纯阅读成本会高到失去「懒加载」的意义。
 */
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
 * 把文本表情里的 HTML 实体还原成字符。
 *
 * 官方表情源（`open.motues.top/emoji/owo.json`）的「颜文字」标签里有 `&quot;`，
 * 例如 `ヾ(´･ ･｀｡)ノ&quot;` —— 来源本身是从网页里抄出来的文本。原样插入评论后，
 * 服务端 Markdown 会把 `&` 再转义一次，正文里就会显示成字面量 `&quot;`；
 * 所以在构建面板数据时先解一层实体。
 *
 * 只处理最小的具名实体集 + 数字实体，且只解一层；不用 DOMParser / textarea，
 * 因为水合路径与单元测试环境里不保证有 DOM。无法识别的实体原样保留。
 * 解码后仍会经过上面的长度与尖括号过滤（`&lt;` 还原出的 `<` 不会被放行）。
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
	/**
	 * 最近一次向来源校验成功（或尝试过）的时间。
	 * 旧缓存没有这个字段时回落到 `savedAt`，因此不需要换 `EMOJI_CACHE_PREFIX` 版本。
	 */
	revalidatedAt?: number;
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
		const entry: EmojiCacheEntry = { savedAt: parsed.savedAt, packs: sanitizePacks(parsed.packs) };
		if (Number.isFinite(parsed.revalidatedAt)) entry.revalidatedAt = parsed.revalidatedAt;
		return entry;
	} catch {
		return null;
	}
}

/**
 * 写入 owo.json 缓存（存储被禁用时静默失败）；`cdnUrl` 同样是地址列表的 JSON。
 *
 * `revalidatedAt` 默认等于写入时间：写入的语义就是「刚从来源拿到了内容」。
 * 只更新时间、不改内容时请用 `touchEmojiCache`。
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

/**
 * 只把「最近校验时间」推到 `revalidatedAt`（内容与 `savedAt` 都不动）。
 *
 * 用于后台校验拿到「内容没变」或「校验失败」的情况：既不重写 40KB 的包体语义，
 * 又让下一次校验落在 `EMOJI_REVALIDATE_MS` 之后，避免同一个访客每个页面都重试一次。
 */
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
 * 缓存是否「到点该向来源校验了」。
 *
 * 与 `isEmojiCacheFresh` 是两件事：后者决定**首屏还能不能同步水合**（7 天可用期），
 * 这里决定**要不要在后台再拉一次**（6 小时间隔）。没有缓存时返回 true ——
 * 但调用方应当走正常加载（`loadEmojiSet`），而不是后台校验。
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
	// 只有「强制重拉 / 后台校验」才指定 cache：'no-cache' 表示绕过浏览器 HTTP 缓存
	// （源站没有 ETag/Last-Modified，校验只能整份重下，光靠 max-age=3600 会拿到旧内容）
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
	// Promise.allSettled 不会短路：一个来源失败不影响其他来源
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
 * 拉取配置的 owo.json（可多个来源，按数组顺序并发拉取后合并）。
 *
 * - 命中 7 天内的缓存（键 = 整个地址列表的 JSON）不发请求；
 * - `force` 时绕过缓存，并且用 `cache: 'no-cache'` 绕开浏览器 HTTP 缓存（手动刷新要拿到真正的最新内容）；
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

	const { packs: merged, errors } = await fetchAllPacks(urls, fetchImpl, force ? 'no-cache' : undefined);

	// 全部失败：回退旧缓存（哪怕已过期），没有缓存才抛错
	if (errors.length === urls.length) {
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

			const text = decodeHtmlEntities(String(raw.icon ?? ''));
			if (!text) continue;
			if (codePointLength(text) > EMOJI_MAX_TEXT_LENGTH) continue;
			// 解码后再过滤尖括号：`&lt;` 会还原成 `<`，不能让它以文本表情的身份绕过这条限制
			if (/[<>]/.test(text)) continue;
			// 悬停提示同样解实体（老源里 title 也可能带 `&quot;` 之类）
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

/**
 * 同步判断「本地缓存是否到点该后台校验了」。
 *
 * **没有缓存时返回 false**：那种情况应当走正常加载（`loadEmojiSet`），而不是后台校验 ——
 * 校验的语义是「手上已经有一份可用的，去确认一下有没有变」。
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

/**
 * 后台校验（stale-while-revalidate）：手上已有缓存时，静默向来源确认一次。
 *
 * 返回值就是「要不要换界面」：
 *  - `null` —— 内容没变 / 有来源失败 / 没有缓存可作为基线：调用方**保持现有界面不动**；
 *  - `EmojiSet` —— 内容确实变了：调用方直接替换，无需再判空。
 *
 * 规则：
 *  - 没有缓存时返回 `null`（没基线可比，交给 `loadEmojiSet` 正常首载）；
 *  - 用 `cache: 'no-cache'` 请求：源站只有 `max-age=3600` 且没有 ETag，不加这个会直接吃
 *    浏览器 HTTP 缓存，白刷一遍还拿到旧内容；
 *  - **任一来源失败就不换界面**：合并结果缺标签，换上去会让面板「少了一整包」；
 *    失败同样把 `revalidatedAt` 推到当前时间，让重试节奏回到 `EMOJI_REVALIDATE_MS`（避免每页重试风暴）；
 *  - 内容变化用 `JSON.stringify` 比较（两侧都经过 `sanitizePacks`，键序稳定，40KB 量级的比较成本可忽略），
 *    没变时只 `touchEmojiCache`，不重写包体、不触发无意义的重新水合。
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
