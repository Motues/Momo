<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import i18nit from '@i18n/translation';
  import { solvePow, PowCancelledError, PowUnsupportedError } from './hashwx';
  import { runInstrumentation } from './instrumentation';
  import type { PowChallenge } from './hashwxCore';

  export let apiUrl: string;
  export let postSlug: string;
  export let language: string = 'zh-cn';
  // 由后端按文章派生的蜜罐字段名；为空表示后端未开启验证
  export let honeypotField: string = '';
  // 票据变化时通知父组件（null 表示当前不可提交评论）
  export let onTicket: ((ticket: string | null) => void) | undefined = undefined;

  const t = i18nit(language);

  type Status = 'loading' | 'success' | 'error';
  /** 失败原因决定展示哪一句提示，便于用户自助排障 */
  type FailureKind = 'failed' | 'unsupported' | 'backendOutdated';

  let status: Status = 'loading';
  let failureKind: FailureKind = 'failed';

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

  function notify(ticket: string | null) {
    if (onTicket) onTicket(ticket);
  }

  /**
   * 挑战参数是否构成一个可解的 v2 挑战。
   *
   * 只有 c 合法而 d/n/count 缺失（或非正整数）时，说明后端下发的是不完整/旧协议数据，
   * 这类情况必须与「答案算错」区分开：前者重试无用，后者才值得让用户点重试。
   */
  function isValidPowChallenge(pow: any): boolean {
    if (!pow || typeof pow !== 'object') return false;
    if (typeof pow.c !== 'string' || !pow.c) return false;
    return (
      Number.isInteger(Number(pow.d)) &&
      Number(pow.d) >= 1 &&
      Number.isInteger(Number(pow.n)) &&
      Number(pow.n) >= 1 &&
      Number.isInteger(Number(pow.count)) &&
      Number(pow.count) >= 1
    );
  }

  function fail(kind: FailureKind) {
    failureKind = kind;
    status = 'error';
    notify(null);
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

      const pow = challenge.pow;
      // 协议 v2 的挑战参数在 data.pow 里。字段缺失或不合法说明后端不是 v2 实现，
      // 此时不能按「验证失败」笼统处理——真人再点也没用，必须提示升级。
      if (!isValidPowChallenge(pow)) {
        fail('backendOutdated');
        return;
      }

      const powChallenge: PowChallenge = {
        c: pow.c,
        d: Number(pow.d),
        n: Number(pow.n),
        count: Number(pow.count),
      };

      // 第二层（Instrumentation 质询）：先跑程序再挖矿。
      // 提前执行的理由是失败快 —— 程序执行只要几毫秒，没必要先烧掉几秒的算力再发现环境不可用。
      let instrAnswer: unknown = undefined;
      if (challenge.instr !== undefined && challenge.instr !== null) {
        const ops = challenge.instr?.ops;
        // 下发了 instr 但程序结构不合法，同样属于「前后端协议不配套」，
        // 不能当成普通失败让用户白点重试
        if (!Array.isArray(ops) || ops.length === 0 || ops.length % 3 !== 0) {
          fail('backendOutdated');
          return;
        }
        try {
          instrAnswer = runInstrumentation(ops);
        } catch (e) {
          // 拿不到第二层答案时提交也没有意义（服务端会判寄存器畸形），直接进入可重试的失败态
          console.warn('环境质询执行失败:', e);
          fail('failed');
          return;
        }
        if (isCancelled()) return;
      }

      // 静默解题：优先多 Worker 并行，宿主页面禁止 Worker 时自动降级到主线程分片
      const nonces = await solvePow(powChallenge, { isCancelled });
      if (isCancelled()) return;

      const body: Record<string, unknown> = {
        post_slug: slug,
        prefix: challenge.prefix,
        sig: challenge.sig,
        nonces,
        elapsed_ms: Date.now() - startedAt,
      };
      if (instrAnswer) body.instr = instrAnswer;
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

      // 前后端协议不配套（后端仍按 v1 校验）
      if (solutionData?.reason === 'PROTOCOL_OUTDATED') {
        fail('backendOutdated');
        return;
      }

      fail('failed');
    } catch (e) {
      if (e instanceof PowCancelledError || isCancelled()) return;
      if (e instanceof PowUnsupportedError) {
        fail('unsupported');
        return;
      }
      console.warn('人机验证失败:', e);
      fail('failed');
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
    // 只有「验证失败」值得重试；浏览器不支持、后端协议过旧这两类重试无用，
    // 按钮同时设为 disabled，避免用户点了没反应又反复点。
    if (status === 'error' && failureKind === 'failed') retry();
  }

  /** 错误态的提示文案 */
  $: errorText =
    failureKind === 'unsupported'
      ? t('comments.verifyUnsupported') || '浏览器版本过低，不支持验证'
      : failureKind === 'backendOutdated'
        ? t('comments.verifyBackendOutdated') || '验证服务版本过旧，请联系博主升级'
        : `${t('comments.verifyFailed') || '验证失败'} · ${t('comments.verifyRetry') || '点击重试'}`;

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
  });
</script>

{#if status === 'error'}
  <button
    type="button"
    class="verify-box relative flex items-center gap-1.5 rounded px-2.5 h-[38px] border text-sm select-none
      border-red-400 text-red-500
      {failureKind === 'failed' ? 'cursor-pointer hover:bg-red-500/5' : 'cursor-default'}"
    title={errorText}
    disabled={failureKind !== 'failed'}
    on:click={handleClick}
  >
    <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>
    {#if !isMobile}
      <span class="whitespace-nowrap">{errorText.split(' · ')[0]}</span>
      {#if failureKind === 'failed'}
        <span class="opacity-70">·</span>
        <span class="whitespace-nowrap underline">{t('comments.verifyRetry') || '点击重试'}</span>
      {/if}
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
