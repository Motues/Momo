/// <reference lib="webworker" />

/**
 * HashWX 求解 Worker。协议 —— 主线程 → `{ type: 'solve', wasm, c, d, n, indexes }`；
 * Worker → `{ type: 'solved', index, nonce }`（每个子挑战解出后立即回传）/ `{ type: 'done' }` / `{ type: 'error', message }`。
 * wasm 以 base64 由主线程下发：在此 import 会让 Worker bundle 再复制一份 16.7KB 内联数据。
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
				// 让出事件循环，使 cancel 消息能被及时处理
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
