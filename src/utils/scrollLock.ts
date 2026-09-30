/**
 * 整页滚动锁定（移动端抽屉、图片灯箱共用）。
 *
 * 锁 <html> 而不是 <body>：开启 OverlayScrollbars 之后，OS 把 documentElement 当作
 * viewport、body 只作为内容容器，此时 body 上的 overflow 已经拦不住滚动；
 * 而根元素的 overflow 会被视口继承，所以锁 documentElement 在「开 / 没开 OS」
 * 两种情况下都成立，调用方不必关心当前用的是哪一种。
 */

/** 计数器式加锁：抽屉与灯箱可能先后叠加，后解锁的不能把先解锁的覆盖掉 */
let depth = 0
let savedOverflow: string | null = null

/** 由 OverlayScrollbars 组件注册：锁 / 解锁会让视口的滚动能力变化，OS 需要重新量一次 */
let notify: (() => void) | null = null

export function bindScrollLockNotifier(fn: () => void): void {
  notify = fn
}

export function lockPageScroll(): void {
  if (depth++ > 0) return
  const el = document.documentElement
  savedOverflow = el.style.overflow
  el.style.overflow = 'hidden'
  notify?.()
}

export function unlockPageScroll(): void {
  if (depth === 0) return
  if (--depth > 0) return
  const el = document.documentElement
  el.style.overflow = savedOverflow ?? ''
  savedOverflow = null
  notify?.()
}
