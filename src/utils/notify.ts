/** 统一的提示输出：alert 可能被宿主页面拦截或抛错，包一层 try/catch 不影响调用方流程 */
export function notify(message: string): void {
  try {
    alert(message);
  } catch (e) {
    console.warn('[momo-comment] alert is unavailable:', message, e);
  }
}
