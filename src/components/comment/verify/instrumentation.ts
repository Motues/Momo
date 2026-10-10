/**
 * Instrumentation 质询的客户端执行（第二层验证）
 *
 * 服务端下发一段随机程序（整数运算 + DOM 元素树操作），这里在浏览器里真实执行它，
 * 并额外采集环境向量与布局探针，一起回传由服务端判定。
 *
 * ## 与 Cap 的有意偏离（重要）
 *
 * Cap 的做法是在 iframe 里跑一段**内联脚本**，用 postMessage 把结果传回来。
 * 但内联脚本会被绝大多数博客的 CSP（`script-src` 没有 `unsafe-inline`）拦下，
 * 那会让验证在这些站点上直接不可用 —— 而我们这个组件正是跑在别人的博客上。
 *
 * 所以这里改为：创建一个 `sandbox="allow-same-origin"`（**不含 allow-scripts**）的 iframe，
 * 由父页面直接操作该 iframe 的文档来执行程序。收益保留：
 * - 独立的文档与层叠样式上下文：宿主页面的 `* { font-size: 0 }`、`display:none` 之类
 *   不会破坏布局探针；
 * - 不向宿主页面插入任何节点，执行完即销毁；
 * - 不需要执行内联脚本，因此不受宿主页面 CSP 的 script-src 限制。
 * 代价：程序不在 iframe 的独立 JS realm 中执行，因此拿不到「主 realm 被打了补丁」这个信号。
 * 该信号本身也不可靠（CDP 的 addScriptToEvaluateOnNewDocument 会作用于所有新文档）。
 *
 * ## 环境向量从哪里采集
 *
 * navigator / screen / 窗口几何一律从**顶层 window** 读取：
 * iframe 里的 `outerWidth/outerHeight` 是框架自身的尺寸，不是浏览器窗口尺寸，
 * 从 iframe 读会让「窗口高于屏幕」这条规则彻底失真。
 * 只有需要隔离 CSS 的 DOM/文字度量走 iframe 文档。
 */

/** 操作码表：必须与 nodejs/src/utils/instrumentation.ts 的 InstrOp 完全一致 */
const enum InstrOp {
	CONST = 0,
	MOV = 1,
	AND = 2,
	OR = 3,
	XOR = 4,
	NAND = 5,
	ADD = 6,
	SUB = 7,
	MUL = 8,
	ROTL = 9,
	ROTR = 10,
	SHL = 11,
	SHR = 12,
	NOT = 13,
	DOM_CREATE = 14,
	DOM_APPEND = 15,
	DOM_SET_TEXT = 16,
	DOM_SET_ATTR = 17,
	DOM_READ_TEXT = 18,
	DOM_READ_ATTR = 19,
	DOM_WALK_UP = 20,
	DOM_REMOVE = 21,
	PROTO_JOIN = 22,
	PROTO_CHARCODE = 23,
}

const INSTR_OP_STRIDE = 3;
const INSTR_REG_COUNT = 4;

/** 元素标签候选：与服务端一致 */
const INSTR_TAGS = ['div', 'span', 'p', 'section', 'b', 'i', 'em', 'u'] as const;

/** 程序读写的属性名：与服务端一致 */
const INSTR_ATTR = 'data-v';

/** 布局探针的探测串：与服务端一致 */
export const PROBE_TEXT = 'MomoVerify1234';

/** 字体栈：必须与 nodejs/src/utils/instrumentation.ts 的 FONT_STACKS 逐项一致 */
export const FONT_STACKS = [
	'monospace',
	'sans-serif',
	'serif',
	'cursive',
	'fantasy',
	'system-ui',
	'"Arial"',
	'"Helvetica"',
	'"Times New Roman"',
	'"Courier New"',
	'"Georgia"',
	'"Verdana"',
	'"Tahoma"',
	'"Trebuchet MS"',
	'"Segoe UI"',
	'"PingFang SC"',
	'"Microsoft YaHei"',
] as const;

/** 环境向量：字段名与服务端 EnvVector 一一对应 */
export interface EnvVector {
	cd: number;
	ua: string;
	br: string;
	ge: number;
	dm: number;
	tm: number[];
	lw: number;
	lh: number;
	iw: number;
	ih: number;
	ow: number;
	oh: number;
	sw: number;
	sh: number;
	ex: number;
	mob: number;
	nt: number;
}

export interface InstrumentationAnswer {
	regs: number[];
	env: EnvVector;
	lw: number;
	lh: number;
	tm: number[];
}

export class InstrumentationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InstrumentationError';
	}
}

interface IsolatedContext {
	doc: Document;
	container: HTMLElement;
	cleanup: () => void;
}

/**
 * 创建隔离的执行上下文。
 *
 * 优先用 iframe（独立样式上下文）；任何失败都退化为宿主页面里的隐藏容器，
 * 宁可在不理想的上下文里完成验证，也不要让真人无法评论。
 */
function createIsolatedContext(): IsolatedContext {
	try {
		const iframe = document.createElement('iframe');
		// 只给 allow-same-origin：父页面需要能操作它的文档，但其中不执行任何脚本
		iframe.setAttribute('sandbox', 'allow-same-origin');
		iframe.setAttribute('aria-hidden', 'true');
		iframe.tabIndex = -1;
		// 必须真正参与布局（不能用 display:none），否则几何尺寸恒为 0。
		// 这里刻意**不加 visibility:hidden**：离屏定位已经足够隐藏，
		// 而加可见性隐藏会引入「某些浏览器跳过该 iframe 布局」的风险 ——
		// 一旦布局探针因此返回 0，开了 blockAutomated 的站点会把所有真人都拦掉。
		iframe.style.cssText =
			'position:absolute;left:-10000px;top:0;width:600px;height:400px;border:0';
		document.body.appendChild(iframe);

		const doc = iframe.contentDocument;
		if (doc) {
			const container = doc.createElement('div');
			container.setAttribute('data-momo-verify-root', '');
			container.style.cssText = 'position:relative;width:400px;min-height:100px';
			doc.body.appendChild(container);
			return {
				doc,
				container,
				cleanup: () => {
					try {
						iframe.remove();
					} catch {
						/* 已被宿主页面移除 */
					}
				},
			};
		}
		iframe.remove();
	} catch {
		/* 落到下面的降级路径 */
	}

	const container = document.createElement('div');
	container.setAttribute('data-momo-verify-root', '');
	container.style.cssText =
		'position:absolute;left:-10000px;top:0;width:400px;min-height:100px;visibility:hidden';
	document.body.appendChild(container);
	return {
		doc: document,
		container,
		cleanup: () => {
			try {
				container.remove();
			} catch {
				/* 已被宿主页面移除 */
			}
		},
	};
}

/**
 * 在给定文档里执行程序，返回最终寄存器。
 *
 * 整数语义必须与服务端影子模型逐位一致：全部按 32 位有符号整数运算，
 * 乘法用 Math.imul，移位/旋转按 JS 的 32 位语义。
 */
export function runProgram(doc: Document, container: HTMLElement, ops: number[]): number[] {
	if (!Array.isArray(ops) || ops.length === 0 || ops.length % INSTR_OP_STRIDE !== 0) {
		throw new InstrumentationError('程序格式非法');
	}

	const regs = [0, 0, 0, 0];
	const stack: HTMLElement[] = [];

	for (let i = 0; i < ops.length; i += INSTR_OP_STRIDE) {
		const op = ops[i];
		const a = ops[i + 1] | 0;
		const b = ops[i + 2] | 0;
		const top = stack.length > 0 ? stack[stack.length - 1] : null;

		switch (op) {
			case InstrOp.CONST:
				regs[a] = b | 0;
				break;
			case InstrOp.MOV:
				regs[a] = regs[b];
				break;
			case InstrOp.AND:
				regs[a] = regs[a] & regs[b];
				break;
			case InstrOp.OR:
				regs[a] = regs[a] | regs[b];
				break;
			case InstrOp.XOR:
				regs[a] = regs[a] ^ regs[b];
				break;
			case InstrOp.NAND:
				regs[a] = ~(regs[a] & regs[b]);
				break;
			case InstrOp.ADD:
				regs[a] = (regs[a] + regs[b]) | 0;
				break;
			case InstrOp.SUB:
				regs[a] = (regs[a] - regs[b]) | 0;
				break;
			case InstrOp.MUL:
				regs[a] = Math.imul(regs[a], regs[b]);
				break;
			case InstrOp.ROTL:
				regs[a] = ((regs[a] << (b & 31)) | (regs[a] >>> ((32 - b) & 31))) | 0;
				break;
			case InstrOp.ROTR:
				regs[a] = ((regs[a] >>> (b & 31)) | (regs[a] << ((32 - b) & 31))) | 0;
				break;
			case InstrOp.SHL:
				regs[a] = regs[a] << (b & 31);
				break;
			case InstrOp.SHR:
				regs[a] = regs[a] >> (b & 31);
				break;
			case InstrOp.NOT:
				regs[a] = ~regs[a];
				break;

			case InstrOp.DOM_CREATE: {
				const tag = INSTR_TAGS[a] ?? 'div';
				const node = doc.createElement(tag);
				stack.push(node);
				break;
			}
			case InstrOp.DOM_APPEND: {
				if (!top) throw new InstrumentationError('DOM_APPEND 时栈为空');
				const parent = stack.length >= 2 ? stack[stack.length - 2] : container;
				parent.appendChild(top);
				break;
			}
			case InstrOp.DOM_SET_ATTR:
				if (!top) throw new InstrumentationError('DOM_SET_ATTR 时栈为空');
				top.setAttribute(INSTR_ATTR, String(regs[a]));
				break;
			case InstrOp.DOM_SET_TEXT:
				if (!top) throw new InstrumentationError('DOM_SET_TEXT 时栈为空');
				top.textContent = String(regs[a]);
				break;
			case InstrOp.DOM_READ_TEXT:
				if (!top) throw new InstrumentationError('DOM_READ_TEXT 时栈为空');
				regs[a] = Number(top.textContent) | 0;
				break;
			case InstrOp.DOM_READ_ATTR:
				if (!top) throw new InstrumentationError('DOM_READ_ATTR 时栈为空');
				regs[a] = Number(top.getAttribute(INSTR_ATTR)) | 0;
				break;
			case InstrOp.DOM_WALK_UP: {
				if (!top) throw new InstrumentationError('DOM_WALK_UP 时栈为空');
				// 必须与服务端一致：从栈顶开始累加最多 b+1 个节点，
				// 到我们自己的容器为止（容器之外属于宿主页面，不能算进来）
				let node: Element | null = top;
				let acc = 0;
				for (let k = 0; k <= b && node && node !== container; k++) {
					acc = (acc + (Number(node.getAttribute(INSTR_ATTR)) | 0)) | 0;
					node = node.parentElement;
				}
				regs[a] = (regs[a] + acc) | 0;
				break;
			}
			case InstrOp.DOM_REMOVE: {
				if (!top) throw new InstrumentationError('DOM_REMOVE 时栈为空');
				top.remove();
				stack.pop();
				break;
			}

			case InstrOp.PROTO_JOIN: {
				// 走真实的原型链：Array.prototype.join.call([...], "-").length
				const joined = Array.prototype.join.call([regs[0], regs[1], regs[2], regs[3]], '-') as string;
				regs[a] = joined.length | 0;
				break;
			}
			case InstrOp.PROTO_CHARCODE: {
				const text = String(regs[a]);
				regs[a] = text.length > 0 ? String.prototype.charCodeAt.call(text, 0) : -1;
				break;
			}

			default:
				throw new InstrumentationError(`未知操作码 ${op}`);
		}
	}

	return regs;
}

/** 字体度量：每项都是同一探测串在不同字体栈下的宽度 */
export function measureFonts(doc: Document): number[] {
	const metrics: number[] = [];
	try {
		const canvas = doc.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) return metrics;
		for (const stack of FONT_STACKS) {
			ctx.font = `16px ${stack}`;
			const width = ctx.measureText(PROBE_TEXT).width;
			// 刻意**不做小数位取整**：把 159.9999999 吸附成 160 会让服务端的
			// 「字宽被整数量化」判定虚增计数，可能误伤真实浏览器。
			// 这里的原始浮点数本身就足够短（JSON 只输出可往返的最短表示）。
			metrics.push(Number.isFinite(width) ? width : 0);
		}
	} catch {
		/* 返回已采集到的部分 */
	}
	return metrics;
}

/**
 * 布局探针：必须由真实渲染引擎给出正的几何尺寸。
 *
 * jsdom / happy-dom 之类没有布局引擎，`getBoundingClientRect()` 恒为 0，
 * 因此这是「计算是否真的发生在浏览器里」最便宜也最可靠的一条判据。
 *
 * 同时读 `getBoundingClientRect()` 与 `offsetWidth/Height` 并取较大值：
 * 两条独立路径都返回 0 才判定为「没有布局引擎」，避免某一套 API 被实现成桩
 * 就误判真人（开 blockAutomated 时这个误判的代价是把所有访客拦在门外）。
 */
export function measureLayout(doc: Document, container: HTMLElement): { lw: number; lh: number } {
	try {
		const probe = doc.createElement('div');
		probe.textContent = PROBE_TEXT;
		// 离屏但参与布局（绝不能用 display:none，那样没有几何尺寸）
		probe.style.cssText =
			'position:absolute;left:-10000px;top:0;font-size:32px;line-height:1.5;white-space:nowrap;width:auto;height:auto';
		container.appendChild(probe);

		const rect = probe.getBoundingClientRect();
		const candidates = [
			[rect.width, rect.height],
			[probe.offsetWidth, probe.offsetHeight],
		];
		probe.remove();

		let lw = 0;
		let lh = 0;
		for (const [w, h] of candidates) {
			if (Number.isFinite(w) && w > lw) lw = Number(w);
			if (Number.isFinite(h) && h > lh) lh = Number(h);
		}
		return { lw, lh };
	} catch {
		return { lw: 0, lh: 0 };
	}
}

/** 引擎标记：1=Blink，2=Gecko，3=WebKit，0=未知 */
function detectEngine(win: Window): number {
	try {
		if ('mozInnerScreenX' in win) return 2;
		// Chrome / Edge / Opera 都暴露 window.chrome
		if (typeof (win as any).chrome === 'object' && (win as any).chrome !== null) return 1;
		if (navigator.vendor === 'Apple Computer, Inc.') return 3;
	} catch {
		/* 取不到就返回未知 */
	}
	return 0;
}

/**
 * 原生方法被改写的位掩码：1=canvas，2=webgl，4=permissions。
 *
 * 这条只作为风险标记，**永不拦截**：隐私扩展（Canvas Blocker / Chameleon / Trace 等）
 * 会改写同一批方法，把它们拦掉会误伤大量真实用户。
 */
function detectNativeTamper(): number {
	let flags = 0;
	const isPatched = (target: any, method: string): boolean => {
		try {
			if (!target || typeof target[method] !== 'function') return false;
			const source = Function.prototype.toString.call(target[method]);
			return !source.includes('[native code]');
		} catch {
			return false;
		}
	};

	try {
		const canvasCtor = (window as any).CanvasRenderingContext2D;
		if (isPatched(canvasCtor?.prototype, 'measureText')) flags |= 1;
	} catch {
		/* 忽略 */
	}
	try {
		const webglCtor = (window as any).WebGLRenderingContext;
		const webgl2Ctor = (window as any).WebGL2RenderingContext;
		if (isPatched(webglCtor?.prototype, 'getParameter') || isPatched(webgl2Ctor?.prototype, 'getParameter')) {
			flags |= 2;
		}
	} catch {
		/* 忽略 */
	}
	try {
		const permissions = (window as any).Permissions;
		if (isPatched(permissions?.prototype, 'query')) flags |= 4;
	} catch {
		/* 忽略 */
	}

	return flags;
}

/**
 * 采集环境向量。
 *
 * navigator / screen / 窗口几何从**顶层 window** 读取（理由见文件头注释）；
 * 字体度量传入隔离文档，避免宿主页面样式干扰。
 */
export function collectEnv(win: Window, isolatedDoc: Document): EnvVector {
	const nav = win.navigator ?? navigator;
	const scr = win.screen ?? screen;
	const uaData = (nav as any).userAgentData;

	let brands = '';
	try {
		if (uaData && Array.isArray(uaData.brands)) {
			brands = uaData.brands.map((item: any) => `${item?.brand ?? ''}/${item?.version ?? ''}`).join(',');
		}
	} catch {
		/* 忽略 */
	}

	const deviceMemory = typeof (nav as any).deviceMemory === 'number' ? (nav as any).deviceMemory : -1;

	return {
		cd: nav.webdriver === undefined ? -1 : nav.webdriver ? 1 : 0,
		ua: String(nav.userAgent ?? '').slice(0, 300),
		br: brands.slice(0, 300),
		ge: detectEngine(win),
		dm: deviceMemory,
		tm: measureFonts(isolatedDoc),
		// 布局探针的宽度会在 runInstrumentation 里用真实容器覆盖
		lw: 0,
		lh: 0,
		iw: Number(win.innerWidth) || 0,
		ih: Number(win.innerHeight) || 0,
		ow: Number(win.outerWidth) || 0,
		oh: Number(win.outerHeight) || 0,
		sw: Number(scr?.width) || 0,
		sh: Number(scr?.height) || 0,
		ex: (scr as any)?.isExtended ? 1 : 0,
		mob: /Mobi|Android|iPhone|iPad|iPod/i.test(String(nav.userAgent ?? '')) ? 1 : 0,
		nt: detectNativeTamper(),
	};
}

/**
 * 执行一次完整的第二层质询：跑程序 + 采环境 + 量布局。
 *
 * 无论成功失败都会销毁隔离上下文，绝不在宿主页面留下节点。
 */
export function runInstrumentation(ops: number[]): InstrumentationAnswer {
	const context = createIsolatedContext();
	try {
		const regs = runProgram(context.doc, context.container, ops);
		const { lw, lh } = measureLayout(context.doc, context.container);
		const env = collectEnv(window, context.doc);
		env.lw = lw;
		env.lh = lh;
		return { regs, env, lw, lh, tm: env.tm };
	} finally {
		context.cleanup();
	}
}
