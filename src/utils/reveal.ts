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
/** 元素顶部越过视口底部 120px 才入场，和旧 AOS 的 offset 保持一致 */
const OFFSET = 120;
/** 等换页结束的兜底帧数（≈4s）：swup 的状态类万一卡住，也不能让内容永远不显现 */
const WAIT_LIMIT = 240;

let observer: IntersectionObserver | null = null;
let watched = new Set<HTMLElement>();
let started = false;
let firstPage = true;
let pageToken = 0;

/** 加类即落位；类留在 DOM 上，所以这一页不会再被隐藏（含 resize / 再观察） */
function reveal(el: HTMLElement): void {
  if (!el.isConnected || el.classList.contains(REVEALED_CLASS)) return;
  el.classList.add(REVEALED_CLASS);
  observer?.unobserve(el);
  watched.delete(el);
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
  for (const el of pending()) {
    const delay = Number(el.dataset.revealDelay);
    if (delay > 0) el.style.setProperty('--reveal-delay', `${delay}ms`);

    const { top } = el.getBoundingClientRect();
    // 顶部已经越过触发线的直接显现：首屏可见的元素、滚动位置恢复后位于视口
    // 上方的元素都属于这一类 —— 后者不会再和视口相交，等观察器只会永远不显示。
    if (!observer || top < line) {
      reveal(el);
      continue;
    }
    if (!watched.has(el)) {
      watched.add(el);
      observer.observe(el);
    }
  }

  revealAtPageEnd();
}

/**
 * 滚到页面最底部（或页面根本滚不动）时，末尾的元素再也无法「再往视口里进 120px」，
 * 只靠带 -120px 底边的观察器会一直停在 opacity: 0 —— 首页底部的分页栏、文章最后一个
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
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }
      },
      // 底部内收 120px：元素要再进视口一点才入场，和 AOS 的 offset 一个意思
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
