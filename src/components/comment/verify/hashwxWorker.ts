/// <reference lib="webworker" />

/**
 * HashWX 求解 Worker
 *
 * 协议（主线程 → Worker）:
 *   { type: 'solve', wasm: <base64>, c, d, n, indexes: number[] }
 * （Worker → 主线程）:
 *   { type: 'solved', index, nonce }   每个子挑战解出后立即回传
 *   { type: 'progress', attempts }     可选进度（当前未使用，保留扩展位）
 *   { type: 'done' } / { type: 'error', message }
 *
 * base64 由主线程下发而不是在此 import：否则 Worker bundle 会把 16.7KB 的内联数据再复制一份。
 * 每个子挑战独立求解，因此 4 个子挑战可以分散到多个 Worker 上并行。
 */

import {
	getHashwxModule,
	hashwxTarget,
	parseChallenge,
	HashwxSolver,
	SubChallengeSolver,
} from './hashwxCore';

/** 单个时间片长度：既保证推进效率，又让取消消息有机会被处理 */
const SLICE_MS = 16;

interface SolveMessage {
	type: 'solve';
	wasm: string;
	c: string;
	d: number;
	n: number;
	indexes: number[];
}

type IncomingMessage = SolveMessage | { type: 'cancel' };

let cancelled = false;

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
	const data = event.data;
	if (data?.type === 'cancel') {
		cancelled = true;
		return;
	}
	if (data?.type !== 'solve') return;

	cancelled = false;

	try {
		const challenge = parseChallenge(data.c);
		const target = hashwxTarget(data.d);
		const n = BigInt(data.n);
		const module = getHashwxModule(data.wasm);
		const solver = new HashwxSolver(module, true);

		for (const index of data.indexes) {
			if (cancelled) break;
			const task = new SubChallengeSolver(solver, challenge, index, n, target);

			let nonce: bigint | null = null;
			while (nonce === null) {
				if (cancelled) break;
				nonce = task.solveWithin(SLICE_MS);
				// 让出 Worker 事件循环，使 cancel 消息能被及时处理
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			if (nonce !== null) {
				self.postMessage({ type: 'solved', index, nonce: nonce.toString() });
			}
		}

		solver.free();
		self.postMessage({ type: 'done' });
	} catch (e) {
		self.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
	}
};
