/**
 * Instrumentation 质询的客户端执行（第二层验证）：跑服务端下发的随机程序，并采集环境向量与布局探针。
 * 隔离 iframe 只给 allow-same-origin、不执行内联脚本，因此不受宿主页面 CSP 的 script-src 限制。
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
	/**
	 * screen.isExtended：1=是，0=否，-1=浏览器不支持该 API。
	 * 服务端只在 Blink 上按「窗口超出屏幕」拦截，其余只记风险标记。
	 */
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

/** 创建隔离的执行上下文；失败时退化为宿主页面里的隐藏容器 */
function createIsolatedContext(): IsolatedContext {
	try {
		const iframe = document.createElement('iframe');
		// 只给 allow-same-origin：父页面需要能操作它的文档，但其中不执行任何脚本
		iframe.setAttribute('sandbox', 'allow-same-origin');
		iframe.setAttribute('aria-hidden', 'true');
		iframe.tabIndex = -1;
		// ⚠️ 必须真正参与布局（不能 display:none，也不要加 visibility:hidden），
		// 否则几何尺寸恒为 0，开 blockAutomated 的站点会把所有真人拦掉
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
 * 整数语义必须与服务端影子模型逐位一致：32 位有符号运算，乘法用 Math.imul。
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
				// 必须与服务端一致：从栈顶累加最多 b+1 个节点，到自己容器为止
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
			// ⚠️ 不做小数位取整：把 159.9999999 吸附成 160 会让服务端的「字宽被整数量化」判定虚增
			metrics.push(Number.isFinite(width) ? width : 0);
		}
	} catch {
		/* 返回已采集到的部分 */
	}
	return metrics;
}

/**
 * 布局探针：必须由真实渲染引擎给出正的几何尺寸（jsdom 之类 `getBoundingClientRect()` 恒为 0）。
 * 同时读 getBoundingClientRect 与 offsetWidth/Height 取较大值，两条路径都为 0 才判定没有布局引擎。
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

/** 原生方法被改写的位掩码：1=canvas，2=webgl，4=permissions。只作风险标记，永不拦截 */
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

/** 采集环境向量：navigator / screen / 窗口几何从顶层 window 读，字体度量用隔离文档 */
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
		// 三态：undefined = 浏览器没实现 screen.isExtended，服务端只能记风险、不能拦截
		ex: (scr as any)?.isExtended === undefined ? -1 : (scr as any)?.isExtended ? 1 : 0,
		mob: /Mobi|Android|iPhone|iPad|iPod/i.test(String(nav.userAgent ?? '')) ? 1 : 0,
		nt: detectNativeTamper(),
	};
}

/** 执行一次完整的第二层质询：跑程序 + 采环境 + 量布局。无论成败都会销毁隔离上下文 */
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
