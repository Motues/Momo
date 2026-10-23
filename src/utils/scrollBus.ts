/**
 * 全局滚动调度器。
 *
 * 站内原本有 6 处各自 `addEventListener('scroll')` + 各自 `requestAnimationFrame`
 * 的回调（Header 吸顶、Header 隐藏、FabMenu 进度条、TOC 显示、PhotoCover、spoiler）。
 * 每个都要在自己的 rAF 里读一次 `window.scrollY`，同一帧里被切碎成好几次回调。
 *
 * 这里统一成「一个 passive 监听 + 一帧一次分发」：谁需要跟着滚动做事就 subscribe，
 * 回调直接拿到这一帧的 scrollY，不用再自己读、也不用自己包 rAF。
 *
 * ⚠️ 订阅方必须在换页 / 卸载时调用返回的 unsubscribe：
 * 这些回调大多由 registerPageInit 在每次换页重建闭包，忘了解绑就会成倍累积
 * （这也是仓库里反复踩过的坑，见 AGENTS.md 的「客户端换页」一节）。
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
  // 第一个订阅者负责挂上真正的监听；最后一个退订时摘掉，避免空转
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
