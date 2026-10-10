/**
 * HashWX 客户端核心（compiled 模式）
 *
 * 算法来自 tevador/hashwx v1.0.0（LGPL-3.0，见 vendor/hashwx/README.md）。
 *
 * 为什么不是「把 wasm 塞进去直接调 hashwx_exec」：
 * 解释模式实测只有约 48 KH/s，compiled 模式约 278 KH/s（Node/V8，单线程）。
 * compiled 模式的真实机制（依据作者公开的浏览器 glue，该文件声明为公有领域）：
 *   1. hashwx_alloc(HASHWX_COMPILED)
 *   2. hashwx_make(ctx, seed) 之后，用 hashwx_module / hashwx_module_size
 *      取出为本函数生成的内层 WASM 模块，运行时 new WebAssembly.Module 编译，
 *      以 { env: { memory: 主模块内存 } } 实例化
 *   3. 执行时 hashwx_exec_begin(ctx, nonce) -> 内层 exports.exec(reg, mem)
 *      -> hashwx_exec_final(ctx)
 *
 * 本模块不依赖 Worker，便于在主线程与 Worker 中复用，也便于单元测试。
 */

import { sha256 } from './sha256';

export const HASHWX_SEED_SIZE = 32;
export const HASHWX_CHALLENGE_SIZE = 32;

const U64_MAX = (1n << 64n) - 1n;

const HASHWX_INTERPRETED = 0;
const HASHWX_COMPILED = 1;

interface HashwxExports {
	memory: WebAssembly.Memory;
	_initialize?: () => void;
	hashwx_alloc: (type: number) => number;
	hashwx_free: (ctx: number) => void;
	hashwx_seed: (ctx: number) => number;
	hashwx_registers: (ctx: number) => number;
	hashwx_memory: (ctx: number) => number;
	hashwx_make: (ctx: number, seedPtr: number) => void;
	hashwx_exec: (ctx: number, nonce: bigint) => bigint;
	hashwx_module: (ctx: number) => number;
	hashwx_module_size: (ctx: number) => number;
	hashwx_exec_begin: (ctx: number, nonce: bigint) => void;
	hashwx_exec_final: (ctx: number) => bigint;
}

/** base64 → 字节；浏览器用 atob，Node（测试/构建期）退回 Buffer */
function decodeBase64(base64: string): Uint8Array {
	if (typeof atob === 'function') {
		const binary = atob(base64);
		const out = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
		return out;
	}
	// eslint-disable-next-line no-undef
	return new Uint8Array(Buffer.from(base64, 'base64'));
}

/** 当前环境是否具备解题所需的 WebAssembly 能力 */
export function isHashwxSupported(): boolean {
	try {
		return (
			typeof WebAssembly === 'object' &&
			typeof WebAssembly.Module === 'function' &&
			typeof WebAssembly.Instance === 'function'
		);
	} catch {
		return false;
	}
}

let cachedModule: WebAssembly.Module | null = null;

/**
 * 编译主模块（每个执行环境只做一次）。
 *
 * base64 由调用方注入而不是在本模块内 import：本模块要同时被 Worker 与主线程使用，
 * 若在这里 import 内联数据，Worker bundle 会再复制一份 16.7KB 的 base64。
 */
export function getHashwxModule(base64: string): WebAssembly.Module {
	if (cachedModule) return cachedModule;
	cachedModule = new WebAssembly.Module(decodeBase64(base64));
	return cachedModule;
}

/** 测试用：清掉主模块缓存 */
export function __resetHashwxModuleCache(): void {
	cachedModule = null;
}

/**
 * 第 index 个子挑战、第 block 个函数的种子：SHA256(c ‖ u8le(index) ‖ u64le(block))
 * 必须与三端后端逐字节一致。
 */
export function hashwxBlockSeed(challenge: Uint8Array, index: number, block: bigint): Uint8Array {
	if (challenge.length !== HASHWX_CHALLENGE_SIZE) {
		throw new Error(`挑战必须为 ${HASHWX_CHALLENGE_SIZE} 字节`);
	}
	const buf = new Uint8Array(HASHWX_CHALLENGE_SIZE + 1 + 8);
	buf.set(challenge, 0);
	buf[HASHWX_CHALLENGE_SIZE] = index & 0xff;
	let rest = block;
	for (let i = 0; i < 8; i++) {
		buf[HASHWX_CHALLENGE_SIZE + 1 + i] = Number(rest & 0xffn);
		rest >>= 8n;
	}
	return sha256(buf);
}

/** hex → 32 字节挑战 */
export function parseChallenge(hex: string): Uint8Array {
	if (typeof hex !== 'string' || hex.length !== HASHWX_CHALLENGE_SIZE * 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
		throw new Error('挑战参数非法');
	}
	const out = new Uint8Array(HASHWX_CHALLENGE_SIZE);
	for (let i = 0; i < HASHWX_CHALLENGE_SIZE; i++) {
		out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

/** 目标阈值：U64_MAX / d */
export function hashwxTarget(d: number): bigint {
	if (!Number.isInteger(d) || d < 1) throw new Error(`难度非法: ${d}`);
	return U64_MAX / BigInt(d);
}

/**
 * 一个 HashWX 上下文，负责「生成函数 → 编译内层模块 → 执行」。
 * 注意内层模块每个 block 都要重新编译，这是编译开销的来源；
 * 协议里的 n（每个函数覆盖的 nonce 数）就是用来摊薄这笔开销的。
 */
export class HashwxSolver {
	private imports: HashwxExports;
	private ctx: number;
	private seedPtr: number;
	private reg: number;
	private mem: number;
	private compiled: boolean;
	private side: WebAssembly.Instance | null = null;
	private currentKey = '';

	constructor(wasmModule: WebAssembly.Module, compiled = true) {
		const instance = new WebAssembly.Instance(wasmModule, {});
		this.imports = instance.exports as unknown as HashwxExports;
		if (typeof this.imports._initialize === 'function') this.imports._initialize();

		this.compiled = compiled;
		this.ctx = this.imports.hashwx_alloc(compiled ? HASHWX_COMPILED : HASHWX_INTERPRETED);
		if (this.ctx <= 0) throw new Error(`hashwx_alloc 失败: ${this.ctx}`);
		this.seedPtr = this.imports.hashwx_seed(this.ctx);
		this.reg = this.imports.hashwx_registers(this.ctx);
		this.mem = this.imports.hashwx_memory(this.ctx);
	}

	/** 用种子生成函数；compiled 模式下同时编译内层模块 */
	make(seed: Uint8Array, cacheKey = ''): void {
		if (cacheKey && cacheKey === this.currentKey) return;
		if (seed.length !== HASHWX_SEED_SIZE) throw new Error('种子长度非法');

		new Uint8Array(this.imports.memory.buffer, this.seedPtr, HASHWX_SEED_SIZE).set(seed);
		this.imports.hashwx_make(this.ctx, this.seedPtr);

		if (this.compiled) {
			const ptr = this.imports.hashwx_module(this.ctx);
			const size = this.imports.hashwx_module_size(this.ctx);
			// 必须 copy：内层模块字节与主模块共享内存，实例化过程中内存可能增长导致视图失效
			const bytes = new Uint8Array(this.imports.memory.buffer, ptr, size).slice();
			const sideModule = new WebAssembly.Module(bytes);
			this.side = new WebAssembly.Instance(sideModule, { env: { memory: this.imports.memory } });
		}
		this.currentKey = cacheKey;
	}

	/** 对单个 nonce 求值 */
	exec(nonce: bigint): bigint {
		if (!this.compiled) return BigInt.asUintN(64, this.imports.hashwx_exec(this.ctx, nonce));
		if (!this.side) throw new Error('尚未生成函数');
		this.imports.hashwx_exec_begin(this.ctx, nonce);
		(this.side.exports as { exec: (reg: number, mem: number) => void }).exec(this.reg, this.mem);
		return BigInt.asUintN(64, this.imports.hashwx_exec_final(this.ctx));
	}

	free(): void {
		this.imports.hashwx_free(this.ctx);
	}
}

/** 单个子挑战的解题状态机，支持按时间片推进（便于让出主线程/配合 Worker） */
export class SubChallengeSolver {
	private nonce = 0n;
	private block = -1n;

	constructor(
		private solver: HashwxSolver,
		private challenge: Uint8Array,
		private index: number,
		private n: bigint,
		private target: bigint
	) {}

	get attempts(): bigint {
		return this.nonce;
	}

	/**
	 * 在 budgetMs 时间预算内推进求解；解出则返回 nonce，否则返回 null。
	 * 调用方反复调用直到拿到 nonce，从而可以按帧让出主线程。
	 */
	solveWithin(budgetMs: number): bigint | null {
		const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
		const deadline = now() + budgetMs;

		for (;;) {
			const block = this.nonce / this.n;
			if (block !== this.block) {
				this.solver.make(hashwxBlockSeed(this.challenge, this.index, block), `${this.index}:${block}`);
				this.block = block;
			}
			if (this.solver.exec(this.nonce) <= this.target) return this.nonce;
			this.nonce++;
			if (now() >= deadline) return null;
		}
	}
}

export interface PowChallenge {
	/** 32 字节挑战，hex */
	c: string;
	/** 每个子挑战的期望哈希次数 */
	d: number;
	/** 每个生成函数覆盖的 nonce 数 */
	n: number;
	/** 子挑战个数 */
	count: number;
}

/** 让出主线程 */
export function yieldToMain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
