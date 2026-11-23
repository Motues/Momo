/** 自研入场动画：状态全部落在 DOM 上（.is-revealed），不依赖库实例 */
import { registerPageInit } from '@utils/pageInit';

const REVEAL_ATTR = 'data-reveal';
const REVEALED_CLASS = 'is-revealed';
const PROSE_SELECTOR = '.markdown-content:not([data-no-reveal])';
/** 触发线：元素顶边越过「视口底部往上 40px」。值越大，视口底部留白越多 */
const OFFSET = 40;
/** 等换页结束的兜底帧数（约 4s），防止 swup 状态类卡住时内容永不显现 */
const WAIT_LIMIT = 240;
/** 同一批列表行的错峰步长 */
const ROW_STEP = 80;
/** 一批列表行错峰的总跨度上限：行多时压缩步长，不要给后段封顶 */
const ROW_SPAN = 600;

let observer: IntersectionObserver | null = null;
let watched = new Set<HTMLElement>();
let started = false;
let firstPage = true;
let pageToken = 0;

/** 加类即落位；类留在 DOM 上，这一页不会再被隐藏（含 resize / 再观察） */
function reveal(el: HTMLElement, delay = 0): void {
  if (!el.isConnected || el.classList.contains(REVEALED_CLASS)) return;
  if (delay > 0) el.style.setProperty('--reveal-delay', `${delay}ms`);
  el.classList.add(REVEALED_CLASS);
  observer?.unobserve(el);
  watched.delete(el);
}

/**
 * 点亮一批元素：列表行按视觉顺序错峰，其它元素（卡片、正文块）保持原有延迟。
 * 步长按「这一批里同一列表有多少行」压缩，每一行都有自己的起点；不同批各自从 0 开始。
 */
function revealBatch(list: HTMLElement[]): void {
  const targets = list.filter(
    (el) => el.isConnected && !el.classList.contains(REVEALED_CLASS),
  );

  const totals = new Map<Element, number>();
  for (const el of targets) {
    const parent = el.tagName === 'LI' ? el.parentElement : null;
    if (parent) totals.set(parent, (totals.get(parent) ?? 0) + 1);
  }

  const seen = new Map<Element, number>();
  for (const el of targets) {
    const parent = el.tagName === 'LI' ? el.parentElement : null;
    if (!parent) {
      reveal(el);
      continue;
    }
    const count = totals.get(parent) ?? 1;
    const index = seen.get(parent) ?? 0;
    seen.set(parent, index + 1);
    const step = Math.min(ROW_STEP, ROW_SPAN / Math.max(count - 1, 1));
    reveal(el, Math.round(index * step));
  }
}

/** 正文里按行入场的块：列表拆到顶层 li、图片拼图拆到 .collage-item */
const ITEMIZED_LISTS = new Set(['UL', 'OL']);

/** 收集尚未入场的元素：带属性的 + 正文块的直接子元素（列表 / 拼图拆到行） */
function pending(): HTMLElement[] {
  const targets = new Set<HTMLElement>(
    document.querySelectorAll<HTMLElement>(`[${REVEAL_ATTR}]`),
  );
  const prose = document.querySelector(PROSE_SELECTOR);
  if (prose) {
    for (const child of Array.from(prose.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (ITEMIZED_LISTS.has(child.tagName)) {
        for (const item of Array.from(child.children)) {
          if (item instanceof HTMLElement && item.tagName === 'LI') {
            targets.add(item);
          }
        }
        continue;
      }
      if (child.classList.contains('image-collage')) {
        for (const item of Array.from(child.children)) {
          if (item instanceof HTMLElement && item.classList.contains('collage-item')) {
            targets.add(item);
          }
        }
        continue;
      }
      targets.add(child);
    }
  }
  return [...targets].filter((el) => !el.classList.contains(REVEALED_CLASS));
}

function sync(options: { flush?: boolean } = {}): void {
  // ⚠️ 首屏同一帧直接加 .is-revealed 会跳过过渡（样式还没算过），先强制读一次布局
  if (options.flush) void document.body.offsetHeight;

  const line = window.innerHeight - OFFSET;
  const ready: HTMLElement[] = [];
  for (const el of pending()) {
    const delay = Number(el.dataset.revealDelay);
    if (delay > 0) el.style.setProperty('--reveal-delay', `${delay}ms`);

    const { top } = el.getBoundingClientRect();
    // 顶部已越过触发线的直接点亮；其余交给观察器
    if (!observer || top < line) {
      ready.push(el);
      continue;
    }
    if (!watched.has(el)) {
      watched.add(el);
      observer.observe(el);
    }
  }
  revealBatch(ready);

  revealAtPageEnd();
}

/** 滚到底时末尾元素无法再越过触发线，补一次「露出即落位」 */
function revealAtPageEnd(): void {
  const scrolledToEnd =
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  if (!scrolledToEnd) return;

  const viewport = window.innerHeight;
  for (const el of [...watched]) {
    if (el.getBoundingClientRect().top < viewport) reveal(el);
  }
}

let scrollFrame = 0;
/** 到底时补一次落位（rAF 去抖，滚动本身不碰 DOM） */
function onScroll(): void {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    revealAtPageEnd();
  });
}

let timer = 0;
/** 异步内容（评论渲染、懒加载）用一次 60ms 去抖就够 */
function scheduleSync(): void {
  if (timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    if (document.documentElement.classList.contains('is-changing')) return;
    sync();
  }, 60);
}

/**
 * 等 swup 播完这一页再动：is-changing / is-animating 期间 ScrollPlugin 还没 scrollTo(0)，
 * 且整页淡入会吃掉大半上浮位移。
 */
function whenSettled(run: () => void): void {
  const token = ++pageToken;
  const html = document.documentElement;
  let frames = 0;

  const step = () => {
    if (token !== pageToken) return;
    const busy =
      html.classList.contains('is-changing') || html.classList.contains('is-animating');
    if (busy && frames++ < WAIT_LIMIT) {
      requestAnimationFrame(step);
      return;
    }
    // 再让出两帧，等滚动归零与布局稳定后再量位置
    requestAnimationFrame(() => {
      if (token !== pageToken) return;
      requestAnimationFrame(() => {
        if (token === pageToken) run();
      });
    });
  };

  requestAnimationFrame(step);
}

/** 换页：清掉上一页的观察记录，再按是否需要等动画分别对齐 */
function onPage(): void {
  if (observer) for (const el of watched) observer.unobserve(el);
  watched.clear();

  const isFirst = firstPage;
  firstPage = false;

  // 首屏没有换页动画：同步对齐，赶在首帧之前
  if (isFirst && !document.documentElement.classList.contains('is-changing')) {
    sync({ flush: true });
    ready();
    return;
  }
  whenSettled(() => {
    sync();
    ready();
  });
}

/** 供 <head> 里的兜底脚本判断：首次对账成功后置位，否则由兜底把内容放出来 */
function ready(): void {
  (window as Window & { __momoReveal?: boolean }).__momoReveal = true;
}

export function initReveal(): void {
  if (started) return;
  started = true;

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        // 一轮回调可能同时点亮多行，先按视觉顺序排好再错峰
        const hits = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        revealBatch(hits.map((entry) => entry.target as HTMLElement));
      },
      // 底部内收 OFFSET：元素要越过触发线才入场
      { rootMargin: `0px 0px -${OFFSET}px 0px` },
    );
  }

  new MutationObserver(scheduleSync).observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 底部兜底：滚动 / 视口变化都可能在到底时把最后一批元素露出来
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  registerPageInit(onPage);
}
