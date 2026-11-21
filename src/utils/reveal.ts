/**
 * 自研入场动画（替代 AOS）。
 *
 * 为什么不用 AOS 了：
 * 1. AOS 的整页状态全靠「一个实例 + refreshHard()」维持。swup 只替换 <main>，
 *    换页后新元素既不会自动被收集，也没有一个可靠时机 —— 早了用的是上一页的
 *    scrollY（元素被误标成已入场、动画在屏幕外播完），晚了动画又在整页半透明时
 *    就播完了，看起来就是「上浮没了，刷新一下才有」。
 * 2. AOS 的样式是随脚本 import 进来的：dev 下 Vite 注入成 <style data-vite-dev-id>，
 *    swup 换 head 时新文档里没有这个标签，插件会把它删掉，而模块不会重跑 ——
 *    换页后 AOS 的规则整份消失，元素连初始态都没有，自然没有动画（刷新才恢复）。
 *
 * 这里只做三件事，状态全部落在 DOM 上（不依赖任何库的实例）：
 * - 元素由 HTML 上的 data-reveal="pop" | "rise" 声明（正文块例外，见下），
 *   初始态 / 落位态 / 曲线全部在 global.css，HTML 一到就是隐藏态，不会闪；
 * - 换页后等 swup 的 is-changing / is-animating 结束（此时 scrollTo(0) 与淡入
 *   都已完成），再把视口内的元素显现，其余交给 IntersectionObserver；
 * - 异步长出来的内容（评论、client:visible）由 MutationObserver 兜住。
 *
 * ⚠️ 正文（.markdown-content 的直接子元素）不打属性：文章内容在首屏 HTML 里就
 * 已经可见，靠 JS 事后打标记会先闪一下再藏起来。改由 CSS 结构性隐藏
 * （.markdown-content:not([data-no-reveal]) > *），脚本只负责加 .is-revealed。
 * 列表与图片拼图是例外：它们按「行」隐藏 / 入场（顶层 li、.collage-item），
 * 这样一块长列表 / 多行拼图不会在块顶越过触发线时整块连看不见的部分一起浮完。
 */

import { registerPageInit } from '@utils/pageInit';

const REVEAL_ATTR = 'data-reveal';
const REVEALED_CLASS = 'is-revealed';
const PROSE_SELECTOR = '.markdown-content:not([data-no-reveal])';
/**
 * 触发线：元素顶边越过「视口底部往上 40px」就入场。
 *
 * 为什么不沿用 AOS 的 120px：正文块在流里首尾相接（加上折叠外边距也没多少），
 * 触发线以下那一段就是完全不可见的空白，**空白上限就是这个值**。120px 在矮视口
 * （笔记本带浏览器工具栏、移动端横屏、页面缩放 125% / 150%）上已经接近 1/4 屏，
 * 文章首屏看着就是「内容到 3/4 处断了，下面一片空」。40px 只剩贴着底边的一条，
 * 元素照样从屏幕下沿浮上来，看不出「先藏起来」。
 */
const OFFSET = 40;
/** 等换页结束的兜底帧数（≈4s）：swup 的状态类万一卡住，也不能让内容永远不显现 */
const WAIT_LIMIT = 240;
/**
 * 同一批里列表行的错峰步长。
 *
 * 光把 ul 拆到 li 还不够：首屏那一整块列表（换页后首屏就是列表时最明显）、或者快速
 * 滚动时一轮回调点亮的好几行，会在同一帧里加类 —— 过渡时长、延迟、行程全都一样，
 * 看上去就是「整块一起淡入」。
 * ⚠️ 不能写成「前 N 行各错一步、后面的封顶」：第 N+1 行之后会挤成一批，页面前几行
 * 正常、后面又一起出来。行多时改成压缩步长，让每一行仍然各有自己的起点。
 */
const ROW_STEP = 80;
/**
 * 一批列表行错峰的总跨度上限：行多时按行数压缩步长，而不是让后段一起落位。
 * 600ms ≈ 行自身 480ms 的过渡，最后一行落位时前面几行刚好收尾 —— 再长就明显「等」。
 */
const ROW_SPAN = 600;

let observer: IntersectionObserver | null = null;
let watched = new Set<HTMLElement>();
let started = false;
let firstPage = true;
let pageToken = 0;

/** 加类即落位；类留在 DOM 上，所以这一页不会再被隐藏（含 resize / 再观察） */
function reveal(el: HTMLElement, delay = 0): void {
  if (!el.isConnected || el.classList.contains(REVEALED_CLASS)) return;
  if (delay > 0) el.style.setProperty('--reveal-delay', `${delay}ms`);
  el.classList.add(REVEALED_CLASS);
  observer?.unobserve(el);
  watched.delete(el);
}

/**
 * 点亮一批元素：列表行按视觉顺序错峰，其它元素（卡片、正文块）保持原有延迟。
 * 步长按「这一批里同一个列表有多少行」算：行少时是干脆的 80ms 递进，行多时压缩到
 * 整批不超过 ROW_SPAN —— 每一行都有自己的起点，不会出现「前几行错开、后面挤成一批」。
 * 不同批各自从 0 开始：滚动时逐行跨过触发线本来就先后有序，给靠后的行加绝对延迟
 * 只会让它进视口之后还要干等。
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

/**
 * 正文里需要「逐行入场」的块：列表按顶层 li 拆、图片拼图按 collage-item 拆。
 * 不拆的话，一个长列表 / 多行拼图只要块顶越过触发线，整块（包括还看不见的后半截）
 * 会一次全部浮出；拆开后每一行各自等自己进入视口，滚动时才是「一行一行」浮上来。
 */
const ITEMIZED_LISTS = new Set(['UL', 'OL']);

/** 收集这一帧还没入场的元素：带属性的 + 正文块的直接子元素（列表 / 拼图拆到行） */
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
  // 首屏时浏览器可能还没为这些元素算过样式，同一帧里直接加 .is-revealed
  // 会没有过渡（直接跳到终态）。强制读一次布局，让「隐藏态」先落地。
  if (options.flush) void document.body.offsetHeight;

  const line = window.innerHeight - OFFSET;
  // 先判定哪些越过触发线、哪些交给观察器，再统一点亮：错峰步长要按「这一批有多少行」
  // 算，得先拿到整批，不能边扫边按「已经点亮了几行」拍脑袋。
  const ready: HTMLElement[] = [];
  for (const el of pending()) {
    const delay = Number(el.dataset.revealDelay);
    if (delay > 0) el.style.setProperty('--reveal-delay', `${delay}ms`);

    const { top } = el.getBoundingClientRect();
    // 顶部已经越过触发线的直接显现：首屏可见的元素、滚动位置恢复后位于视口
    // 上方的元素都属于这一类 —— 后者不会再和视口相交，等观察器只会永远不显示。
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

/**
 * 滚到页面最底部（或页面根本滚不动）时，末尾的元素再也无法「再往视口里进 OFFSET」，
 * 只靠带 -OFFSET 底边的观察器会一直停在 opacity: 0 —— 首页底部的分页栏、文章最后一个
 * 段落都会中招。这里补一次「只要露出来就落位」。
 */
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
/** 异步内容（评论渲染、懒加载）用一次 60ms 去抖就够，不必每来一个节点都重排 */
function scheduleSync(): void {
  if (timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    // 换页动画期间的节点交给 onPage 在动画结束后统一对账，这里不抢跑
    if (document.documentElement.classList.contains('is-changing')) return;
    sync();
  }, 60);
}

/**
 * 等 swup 把这一页播完再动。
 * - ① is-changing / is-animating 期间 ScrollPlugin 还没在 page:view 的 rAF 里
 *      scrollTo(0)，此时量位置会拿上一页的 scrollY 当基准；
 * - ② 整页淡入 180ms 与入场上浮 800ms 叠在一起时，八成位移发生在页面还半透明的
 *      时候，看上去就是「没有上浮」。等类名消失再显现，上浮才全落在可见画面上。
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
    // 再让出两帧：滚动归零与类名移除基本同帧，等布局稳定后再量位置
    requestAnimationFrame(() => {
      if (token !== pageToken) return;
      requestAnimationFrame(() => {
        if (token === pageToken) run();
      });
    });
  };

  requestAnimationFrame(step);
}

function onPage(): void {
  // 上一页的节点已随容器销毁：停掉观察，避免集合与回调越积越多
  if (observer) for (const el of watched) observer.unobserve(el);
  watched.clear();

  const isFirst = firstPage;
  firstPage = false;

  // 首屏没有换页动画：立刻对齐（同步执行，赶在首帧之前）
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

/** 给 <head> 里的兜底脚本用：第一次对账成功后置位，失败就让兜底把内容放出来 */
function ready(): void {
  (window as Window & { __momoReveal?: boolean }).__momoReveal = true;
}

export function initReveal(): void {
  if (started) return;
  started = true;

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        // 一轮回调里可能同时点亮好几行（首屏 / 快速滚动）：先按视觉顺序排好，
        // 再交给 revealBatch 错峰。boundingClientRect 是观察结果自带的，不额外读布局。
        const hits = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        revealBatch(hits.map((entry) => entry.target as HTMLElement));
      },
      // 底部内收 OFFSET：元素要越过触发线才入场，线以下留的那一小截就是极限空白
      { rootMargin: `0px 0px -${OFFSET}px 0px` },
    );
  }

  new MutationObserver(scheduleSync).observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 底部兜底：滚动 / 视口变化都可能在「已经到底」时把最后一批元素露出来
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  registerPageInit(onPage);
}
