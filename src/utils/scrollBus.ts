/**
 * 全局滚动调度器：一个 passive 监听 + 一帧一次分发，回调直接拿到当帧 `scrollY`。
 * ⚠️ 订阅方必须在换页 / 卸载时调用返回的 unsubscribe，否则回调会成倍累积。
 */

type ScrollHandler = (scrollY: number) => void;

const handlers = new Set<ScrollHandler>();
let ticking = false;

function flush() {
  ticking = false;
  const y = window.scrollY;
  for (const fn of handlers) {
    try {
      fn(y);
    } catch (error) {
      console.error('[scroll-bus]', error);
    }
  }
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(flush);
}

/** 订阅滚动：回调每帧最多被调用一次，参数是当帧的 window.scrollY */
export function subscribeScroll(handler: ScrollHandler): () => void {
  handlers.add(handler);
  if (handlers.size === 1) {
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  return () => {
    if (!handlers.delete(handler)) return;
    if (handlers.size === 0) {
      window.removeEventListener('scroll', onScroll);
    }
  };
}
