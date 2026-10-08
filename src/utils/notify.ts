/**
 * 统一的提示输出。
 *
 * 评论组件常被嵌在第三方页面/沙箱 iframe 中，此时宿主页面可能拦截、覆盖
 * 甚至禁用 `alert`（部分环境下调用会直接抛错）。如果直接调用 alert，
 * 一次异常就会中断后续流程（例如提交成功后清空输入框、刷新列表）。
 * 这里统一包一层 try/catch，保证弹窗问题不会影响组件逻辑。
 */
export function notify(message: string): void {
  try {
    alert(message);
  } catch (e) {
    console.warn('[momo-comment] alert is unavailable:', message, e);
  }
}
