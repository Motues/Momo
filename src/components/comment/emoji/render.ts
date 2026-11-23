import { findShortcodes } from './owo';

/**
 * 评论正文里的表情水合：把 `:name:` 短代码替换成内联小图。
 * 所有 `<img>` 都用 `createElement` 构建、`src` 只取自 `EmojiSet.images`（构建时已按白名单校验），不拼接 HTML。
 */

/** 这些标签内部的文本不参与替换（代码块里的 `:name:` 应当保持原样） */
const SKIP_TAGS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA']);

export interface EmojifyOptions {
	/** 短代码 → 图片地址 */
	images?: Map<string, string>;
	/** 触发重新水合的键（通常传被渲染的 HTML 原文），内容变化时 Svelte 会重新调用 update() */
	html?: string;
}

const EMOJI_CLASS = 'momo-emoji';

/** 该节点是否位于需要跳过的标签内部（含自身） */
function isInsideSkippedNode(node: Node, root: HTMLElement): boolean {
	let current: Node | null = node.parentNode;
	while (current && current !== root) {
		if (current.nodeType === 1 && SKIP_TAGS.has((current as Element).tagName)) return true;
		current = current.parentNode;
	}
	return false;
}

function createEmojiImage(url: string, name: string, doc: Document): HTMLImageElement {
	const image = doc.createElement('img');
	image.className = EMOJI_CLASS;
	image.src = url;
	// 表情是正文的一部分：短代码本身作为 alt/title，便于无障碍与悬停查看
	image.alt = `:${name}:`;
	image.title = `:${name}:`;
	image.setAttribute('loading', 'lazy');
	image.setAttribute('decoding', 'async');
	// 不向第三方表情 CDN 泄露来源页面地址
	image.setAttribute('referrerpolicy', 'no-referrer');
	return image;
}

/** 把一段文本按短代码切成「文本片段 + 图片」并替换原文本节点 */
function hydrateTextNode(node: Text, images: Map<string, string>): void {
	const text = node.nodeValue ?? '';
	const matches = findShortcodes(text).filter((match) => images.has(match.name));
	if (matches.length === 0) return;

	const doc = node.ownerDocument;
	const fragment = doc.createDocumentFragment();
	let cursor = 0;

	for (const match of matches) {
		if (match.start > cursor) {
			fragment.appendChild(doc.createTextNode(text.slice(cursor, match.start)));
		}
		fragment.appendChild(createEmojiImage(images.get(match.name) as string, match.name, doc));
		cursor = match.end;
	}
	if (cursor < text.length) fragment.appendChild(doc.createTextNode(text.slice(cursor)));

	node.parentNode?.replaceChild(fragment, node);
}

/** 表情包更新后，按 `alt` 里的短代码同步已水合的 `<img>` 的 `src`（幂等） */
function refreshHydratedImages(root: HTMLElement, images: Map<string, string>): number {
	let updated = 0;
	for (const image of root.querySelectorAll<HTMLImageElement>('img.momo-emoji')) {
		const name = (image.alt || '').replace(/^:/, '').replace(/:$/, '');
		const url = images.get(name);
		if (url && image.getAttribute('src') !== url) {
			image.src = url;
			updated += 1;
		}
	}
	return updated;
}

/** 就地水合一个容器内的所有文本节点；幂等，重复调用不会重复插图片 */
export function hydrateEmojis(root: HTMLElement, images?: Map<string, string>): number {
	if (!root || !images || images.size === 0) return 0;
	const doc = root.ownerDocument;
	if (!doc) return 0;

	const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
	const targets: Text[] = [];
	let current = walker.nextNode();
	while (current) {
		const node = current as Text;
		if (!isInsideSkippedNode(node, root) && findShortcodes(node.nodeValue ?? '', 1).length > 0) {
			targets.push(node);
		}
		current = walker.nextNode();
	}

	let replaced = 0;
	for (const node of targets) {
		if (node.parentNode) {
			hydrateTextNode(node, images);
			replaced += 1;
		}
	}
	return replaced + refreshHydratedImages(root, images);
}

/**
 * Svelte action：`<div use:emojify={{ images, html }}>{@html ...}</div>`
 * 参数变化时重新水合（幂等），覆盖表情包异步到达与 `{@html}` 整体替换 innerHTML 两种情况。
 */
export function emojify(node: HTMLElement, options: EmojifyOptions = {}) {
	hydrateEmojis(node, options.images);

	return {
		update(next: EmojifyOptions = {}) {
			hydrateEmojis(node, next.images);
		},
		destroy() {
			/* 无需清理：只写了节点内容，没有挂事件或定时器 */
		},
	};
}
