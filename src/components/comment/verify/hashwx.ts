/**
 * 第一层工作量证明（HashWX）的编排层
 *
 * 职责：
 * 1. 决定用几个 Worker、如何把子挑战分给它们；
 * 2. Worker 不可用时（宿主页面 CSP 未放行 blob: worker、老浏览器）降级到主线程分片求解。
 *    这一步必须存在——评论区组件跑在别人的博客上，CSP 不由我们掌控；
 * 3. 对外只暴露「给挑战 → 拿到 nonces 数组」。
 *
 * 并行度为什么重要：实测 compiled 单线程约 278 KH/s（Node/V8，与 Chrome 同引擎），
 * 默认总难度 1,000,000 意味着单线程约 3.6s、4 线程约 0.9s。
 */

import HashwxWorker from './hashwxWorker?worker&inline';
import {
	HashwxSolver,
	SubChallengeSolver,
	getHashwxModule,
	hashwxTarget,
	isHashwxSupported,
	parseChallenge,
	yieldToMain,
	type PowChallenge,
} from './hashwxCore';
import { HASHWX_WASM_BASE64 } from './hashwxWasm';

/** 主线程降级路径的时间片长度：留出渲染余量，避免输入框卡顿 */
const MAIN_THREAD_SLICE_MS = 8;

/** Worker 数量上限：再多收益递减，还会抢占用户其它标签页的 CPU */
const MAX_WORKERS = 4;

export class PowUnsupportedError extends Error {
	constructor() {
		super('当前浏览器不支持 WebAssembly，无法完成验证');
		this.name = 'PowUnsupportedError';
	}
}

export class PowCancelledError extends Error {
	constructor() {
		super('verification cancelled');
		this.name = 'PowCancelledError';
	}
}

export interface SolveOptions {
	/** 返回 true 则中止（组件卸载或切换文章） */
	isCancelled?: () => boolean;
	/** 测试注入点：返回 null 表示强制走主线程降级路径 */
	createWorker?: () => Worker | null;
}

/** 默认 Worker 工厂：Vite 的 ?worker&inline 会把 Worker 代码内联为 Blob，无需额外资源文件 */
function defaultCreateWorker(): Worker | null {
	try {
		return new HashwxWorker();
	} catch {
		// 宿主页面的 CSP 可能不允许 blob: worker
		return null;
	}
}

/** 按硬件并发度与子挑战数决定 Worker 数量 */
export function planWorkerCount(count: number, hardwareConcurrency?: number): number {
	const cores = hardwareConcurrency && hardwareConcurrency > 0 ? hardwareConcurrency : 2;
	// 留一个核给主线程
	const usable = Math.max(1, cores - 1);
	return Math.max(1, Math.min(count, usable, MAX_WORKERS));
}

/** 把子挑战按下标轮转分给各 Worker，保证负载尽量均匀 */
export function distributeIndexes(count: number, workerCount: number): number[][] {
	const groups: number[][] = Array.from({ length: workerCount }, () => []);
	for (let i = 0; i < count; i++) groups[i % workerCount].push(i);
	return groups.filter((group) => group.length > 0);
}

interface WorkerJob {
	worker: Worker;
	indexes: number[];
}

/**
 * 用 Worker 并行求解。
 *
 * 返回 null 表示 Worker 路径不可用（或中途失败），由调用方降级到主线程。
 * 注意：这里刻意不抛出非取消类异常——任何 Worker 侧问题都不该让真人无法评论。
 */
async function solveWithWorkers(
	challenge: PowChallenge,
	groups: number[][],
	options: SolveOptions
): Promise<string[] | null> {
	const create = options.createWorker ?? defaultCreateWorker;

	const results: string[] = new Array(challenge.count).fill('');
	const jobs: WorkerJob[] = [];

	const cleanup = () => {
		for (const job of jobs) {
			try {
				job.worker.terminate();
			} catch {
				/* 已经被终止 */
			}
		}
	};

	try {
		for (const indexes of groups) {
			const worker = create();
			if (!worker) {
				cleanup();
				return null;
			}
			jobs.push({ worker, indexes });
		}

		const finished = jobs.map(
			(job) =>
				new Promise<void>((resolve, reject) => {
					job.worker.onmessage = (event: MessageEvent) => {
						const msg = event.data;
						if (msg?.type === 'solved') {
							const index = Number(msg.index);
							if (Number.isInteger(index) && index >= 0 && index < challenge.count) {
								results[index] = String(msg.nonce);
							}
							return;
						}
						if (msg?.type === 'done') {
							resolve();
							return;
						}
						if (msg?.type === 'error') {
							reject(new Error(msg.message || 'worker error'));
						}
					};
					job.worker.onerror = () => reject(new Error('worker error'));
					job.worker.postMessage({
						type: 'solve',
						wasm: HASHWX_WASM_BASE64,
						c: challenge.c,
						d: challenge.d,
						n: challenge.n,
						indexes: job.indexes,
					});
				})
		);

		// 取消轮询：组件卸载时通知 Worker 收手，避免后台空转
		const timer = setInterval(() => {
			if (options.isCancelled?.()) {
				for (const job of jobs) {
					try {
						job.worker.postMessage({ type: 'cancel' });
					} catch {
						/* 忽略 */
					}
				}
			}
		}, 200);

		try {
			await Promise.all(finished);
		} finally {
			clearInterval(timer);
		}

		if (options.isCancelled?.()) throw new PowCancelledError();

		// 任何子挑战没解出来都不算成功
		for (let i = 0; i < challenge.count; i++) {
			if (!results[i]) return null;
		}
		return results;
	} catch (e) {
		if (e instanceof PowCancelledError) throw e;
		return null;
	} finally {
		cleanup();
	}
}

/** 主线程分片求解：Worker 不可用时的降级路径，仍保证不长时间阻塞 UI */
async function solveOnMainThread(challenge: PowChallenge, options: SolveOptions): Promise<string[]> {
	const module = getHashwxModule(HASHWX_WASM_BASE64);
	const challengeBytes = parseChallenge(challenge.c);
	const target = hashwxTarget(challenge.d);
	const n = BigInt(challenge.n);

	const solver = new HashwxSolver(module, true);
	const results: string[] = [];

	try {
		for (let index = 0; index < challenge.count; index++) {
			const task = new SubChallengeSolver(solver, challengeBytes, index, n, target);
			let nonce: bigint | null = null;

			while (nonce === null) {
				if (options.isCancelled?.()) throw new PowCancelledError();
				nonce = task.solveWithin(MAIN_THREAD_SLICE_MS);
				// 让出主线程：输入框、滚动、动画不会被长时间阻塞
				await yieldToMain();
			}

			results.push(nonce.toString());
		}
	} finally {
		solver.free();
	}

	return results;
}

/**
 * 求解 HashWX 挑战，返回与子挑战一一对应的 nonces 数组。
 *
 * 优先并行 Worker；Worker 不可用或中途异常时降级到主线程分片求解。
 */
export async function solvePow(challenge: PowChallenge, options: SolveOptions = {}): Promise<string[]> {
	if (!isHashwxSupported()) throw new PowUnsupportedError();

	// 参数自检：服务端下发的参数必须自洽，否则直接报错而不是空转
	parseChallenge(challenge.c);
	hashwxTarget(challenge.d);
	if (!Number.isInteger(challenge.count) || challenge.count < 1) {
		throw new Error('挑战参数非法：count');
	}
	if (!Number.isInteger(challenge.n) || challenge.n < 1) {
		throw new Error('挑战参数非法：n');
	}

	const workerCount = planWorkerCount(
		challenge.count,
		typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
	);

	// 即使只有 1 个 Worker 也优先走 Worker：单核设备上没有并行收益，
	// 但能把主线程让出来，页面在解题期间不会卡顿。
	const viaWorkers = await solveWithWorkers(
		challenge,
		distributeIndexes(challenge.count, workerCount),
		options
	);
	if (viaWorkers) return viaWorkers;

	return solveOnMainThread(challenge, options);
}
