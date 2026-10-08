<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import i18nit from '@i18n/translation';
  import { mineNonce, CancelledError } from '@utils/pow';

  export let apiUrl: string;
  export let postSlug: string;
  export let language: string = 'zh-cn';
  // 由后端按文章派生的蜜罐字段名；为空表示后端未开启验证
  export let honeypotField: string = '';
  // 票据变化时通知父组件（null 表示当前不可提交评论）
  export let onTicket: ((ticket: string | null) => void) | undefined = undefined;

  const t = i18nit(language);

  type Status = 'loading' | 'success' | 'error';
  let status: Status = 'loading';

  // 是否处于移动端（与 CommentItem.svelte 保持同一个断点 767px）
  let isMobile = false;

  // 提交给后端的蜜罐值：真人始终为空，自动填表脚本往往会填入内容
  let honeypotValue = '';

  // 定位一次后不再重复验证
  const verifiedSlugs = new Set<string>();

  let currentSlug = '';
  let attempt = 0;
  let cancelled = false;
  let initialized = false;
  let sleepTimer: ReturnType<typeof setTimeout> | null = null;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      sleepTimer = setTimeout(resolve, ms);
    });
  }

  function notify(ticket: string | null) {
    if (onTicket) onTicket(ticket);
  }

  async function runVerification(slug: string, attemptId: number) {
    cancelled = false;
    status = 'loading';
    notify(null);

    const isCancelled = () => cancelled || attemptId !== attempt;

    try {
      const startedAt = Date.now();

      const challengeRes = await fetch(`${apiUrl}/api/verify/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_slug: slug }),
      });
      if (!challengeRes.ok) throw new Error('challenge failed');
      const challengeData = await challengeRes.json();
      if (isCancelled()) return;

      const challenge = challengeData?.data;
      if (!challenge?.enabled) {
        // 后端已关闭验证：直接通知父组件放行
        status = 'success';
        notify('');
        verifiedSlugs.add(slug);
        return;
      }

      const prefix = String(challenge.prefix || '');
      const sig = String(challenge.sig || '');
      const difficulty = Number(challenge.difficulty) || 16;

      // 静默解题：分批执行，不阻塞输入框
      const solution = await mineNonce(prefix, difficulty, isCancelled);

      // 后端要求总耗时高于最小阈值（300ms），太快会被判定为脚本
      const remain = 320 - (Date.now() - startedAt);
      if (remain > 0) await sleep(remain);
      if (isCancelled()) return;

      const body: Record<string, unknown> = {
        post_slug: slug,
        prefix,
        sig,
        nonce: solution.nonce,
        elapsed_ms: Date.now() - startedAt,
      };
      // 蜜罐字段名 + 值一起提交，由后端识别是否被脚本填写
      if (honeypotField) body.hp = honeypotValue;

      const solutionRes = await fetch(`${apiUrl}/api/verify/solution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (isCancelled()) return;

      const solutionData = await solutionRes.json().catch(() => null);

      if (solutionRes.ok && typeof solutionData?.data?.ticket === 'string') {
        status = 'success';
        notify(solutionData.data.ticket);
        verifiedSlugs.add(slug);
        return;
      }

      // 后端在本次挑战期间关掉了验证：按放行处理
      if (solutionData?.data?.enabled === false) {
        status = 'success';
        notify('');
        verifiedSlugs.add(slug);
        return;
      }

      status = 'error';
      notify(null);
    } catch (e) {
      if (e instanceof CancelledError || isCancelled()) return;
      console.warn('人机验证失败:', e);
      status = 'error';
      notify(null);
    }
  }

  function start(slug: string) {
    if (!slug) return;
    currentSlug = slug;
    attempt += 1;
    runVerification(slug, attempt);
  }

  /** 供父组件在提交被拒（VERIFY_REQUIRED）时调用 */
  export function retry() {
    if (currentSlug) start(currentSlug);
  }

  function handleClick() {
    if (status === 'error') retry();
  }

  onMount(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    isMobile = mql.matches;
    const listener = (e: MediaQueryListEvent) => { isMobile = e.matches; };
    mql.addEventListener('change', listener);

    // 首次验证在此触发，避免与下面的响应式语句重复启动
    initialized = true;
    start(postSlug);

    return () => mql.removeEventListener('change', listener);
  });

  // 切换文章时重新验证（同一文章的刷新不缓存，符合「每次刷新都重新验证」）
  $: if (initialized && postSlug && postSlug !== currentSlug) {
    start(postSlug);
  }

  onDestroy(() => {
    cancelled = true;
    if (sleepTimer) clearTimeout(sleepTimer);
  });
</script>

{#if status === 'error'}
  <button
    type="button"
    class="verify-box relative flex items-center gap-1.5 rounded px-2.5 h-[38px] border text-sm select-none
      border-red-400 text-red-500 cursor-pointer hover:bg-red-500/5"
    title={`${t('comments.verifyFailed')} · ${t('comments.verifyRetry')}`}
    on:click={handleClick}
  >
    <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>
    {#if !isMobile}
      <span class="whitespace-nowrap">{t('comments.verifyFailed') || '验证失败'}</span>
      <span class="opacity-70">·</span>
      <span class="whitespace-nowrap underline">{t('comments.verifyRetry') || '点击重试'}</span>
    {/if}
  </button>
{:else}
  <div
    class="verify-box relative flex items-center gap-1.5 rounded px-2.5 h-[38px] border text-sm select-none
      {status === 'success'
        ? 'border-green-500/60 text-green-600 dark:text-green-400'
        : 'border-[var(--button-border-color)] text-[var(--text-color)]/70'}"
    role="status"
    aria-live="polite"
  >
    {#if status === 'loading'}
      <svg class="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {:else}
      <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
    {/if}

    {#if !isMobile}
      <span class="whitespace-nowrap">
        {#if status === 'loading'}{t('comments.verifying') || '验证中...'}
        {:else}{t('comments.verifySuccess') || '验证成功'}{/if}
      </span>
    {/if}
  </div>
{/if}

{#if honeypotField}
  <input
    type="text"
    name={honeypotField}
    class="verify-honeypot"
    tabindex="-1"
    autocomplete="off"
    aria-hidden="true"
    bind:value={honeypotValue}
  />
{/if}

<style>
  /*
   * 蜜罐字段：对真人不可见，但不能用 display:none / visibility:hidden，
   * 否则简单的自动填表脚本可以直接识别并跳过。
   */
  .verify-honeypot {
    position: absolute;
    left: -9999px;
    top: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }
</style>
