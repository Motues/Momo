<script lang="ts">
  import i18nit from '@i18n/translation';
  import {
    getCachedEmojiSet,
    loadEmojiSet,
    type EmojiSet,
  } from './owo';

  export let language: string = 'zh-cn';
  /** 表情包地址（由评论列表接口的 emoji_cdn_url 下发；空串表示没有可用地址，按钮不可用） */
  export let cdnUrl: string = '';
  export let disabled: boolean = false;
  /** 选中表情时回调，参数是要插入输入框的文本 */
  export let onPick: (text: string) => void = () => {};
  /** 表情集合就绪后回传（父组件用它水合已有评论；双向绑定） */
  export let emojiSet: EmojiSet | null = null;

  const t = i18nit(language);

  /** 面板最大高度：视口下方空间充足时的上限 */
  const PANEL_MAX_HEIGHT = 256;
  /** 面板最小高度：下方空间再小也要留出可用高度（宁可让页面滚动） */
  const PANEL_MIN_HEIGHT = 96;
  /** 面板与按钮之间的间距（对应 mt-2） */
  const PANEL_GAP = 8;
  /** 面板底边与视口底边之间保留的空白 */
  const VIEWPORT_MARGIN = 12;

  let open = false;
  let loading = false;
  let error = '';
  let stale = false;
  let activeTabId = '';
  let panelEl: HTMLDivElement;
  let buttonEl: HTMLButtonElement;
  /** 面板的 max-height（px）：面板开在按钮下方，按视口剩余空间自适应 */
  let panelMaxHeight = PANEL_MAX_HEIGHT;

  /** 没有可用地址（或调用方禁用）时按钮不可点：绝不请求空地址 */
  $: unavailable = disabled || !cdnUrl;

  $: activeTab = emojiSet?.tabs.find((tab) => tab.id === activeTabId) ?? emojiSet?.tabs[0] ?? null;
  $: activeTabItems = activeTab?.items ?? [];

  /**
   * 当前标签是不是颜文字（文本表情）包。
   *
   * 文本表情长短不一（`OωO` 与 `(๑•̀ㅂ•́)و✧` 宽度差好几倍），必须按内容自适应宽度，
   * 否则塞进固定列宽的网格里会互相挤压、重叠；图片表情尺寸一致，继续走等宽网格。
   * 一个包的项要么全是文本、要么全是图片（见 owo.ts 的 buildEmojiSet），
   * 所以用「所有项都没有短代码」判定即可。
   */
  $: activeTabIsText = activeTabItems.length > 0 && activeTabItems.every((item) => !item.shortcode);

  async function ensureLoaded(force = false) {
    if (unavailable) return;
    if (loading) return;
    loading = true;
    error = '';
    try {
      const set = await loadEmojiSet({ cdnUrl, force });
      emojiSet = set;
      stale = Boolean(set.stale);
      if (!activeTabId || !set.tabs.some((tab) => tab.id === activeTabId)) {
        activeTabId = set.tabs[0]?.id ?? '';
      }
    } catch (e) {
      error = t('comments.emojiLoadFailed');
    } finally {
      loading = false;
    }
  }

  /**
   * 面板始终开在按钮下方，高度用「按钮底边 → 视口底边」的剩余空间（减去间距与留白）自适应：
   * 底部空间小就压低面板（表情区改为纵向滚动），空间充足时用 PANEL_MAX_HEIGHT 封顶。
   */
  function adjustPanelHeight() {
    if (!open || !buttonEl) return;
    const rect = buttonEl.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    panelMaxHeight = Math.round(Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, below)));
  }

  function toggle() {
    if (unavailable) return;
    open = !open;
    if (open) {
      // 先用手上的缓存立刻渲染（可能是空集合），再按需拉取
      if (!emojiSet) emojiSet = getCachedEmojiSet({ cdnUrl });
      if (emojiSet.tabs.length > 0) activeTabId = activeTabId || emojiSet.tabs[0].id;
      // 打开瞬间量一次；面板尺寸与按钮位置变化时由 window 的 resize/scroll 继续修正
      adjustPanelHeight();
      void ensureLoaded(false);
    }
  }

  function close() {
    open = false;
  }

  function pick(item: { insert: string }) {
    onPick(item.insert);
  }

  function onWindowClick(event: MouseEvent) {
    if (!open) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (panelEl?.contains(target) || buttonEl?.contains(target)) return;
    close();
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) close();
  }
</script>

<svelte:window on:click={onWindowClick} on:keydown={onWindowKeydown}
  on:resize={adjustPanelHeight} on:scroll={adjustPanelHeight} />

<div class="relative inline-block">
  <button
    type="button"
    bind:this={buttonEl}
    class="emoji-trigger rounded p-2 leading-none text-[var(--text-color)]/60 transition-colors hover:text-[var(--link-color)] disabled:cursor-not-allowed"
    title={t('comments.emoji')}
    aria-label={t('comments.emoji')}
    aria-expanded={open}
    disabled={unavailable}
    data-test="emoji-trigger"
    on:click={toggle}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5" aria-hidden="true">
      <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M8.5 8c.83 0 1.5.67 1.5 1.5S9.33 11 8.5 11S7 10.33 7 9.5S7.67 8 8.5 8m8.21 6.72C15.8 16.67 14.04 18 12 18s-3.8-1.33-4.71-3.28c-.16-.33.08-.72.45-.72h8.52c.37 0 .61.39.45.72M15.5 11c-.83 0-1.5-.67-1.5-1.5S14.67 8 15.5 8s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5"/>
    </svg>
  </button>

  {#if open}
    <div
      bind:this={panelEl}
      class="emoji-panel absolute left-0 top-full z-50 mt-2 flex flex-col overflow-hidden rounded border border-[var(--button-border-color)] shadow-lg"
      style="max-height: {panelMaxHeight}px"
      role="dialog"
      aria-label={t('comments.emojiPanel')}
      data-test="emoji-panel"
    >
      <!-- 标签栏：宽度不够时换行，不做横向滚动（避免出现横向滚动条） -->
      {#if emojiSet && emojiSet.tabs.length > 0}
        <div class="flex flex-wrap items-center gap-1 border-b border-[var(--button-border-color)] px-1 pt-1"
          role="tablist">
          {#each emojiSet.tabs as tab}
            <button type="button" role="tab"
              aria-selected={activeTab?.id === tab.id}
              class="whitespace-nowrap rounded-t px-2.5 py-1.5 text-xs text-[var(--text-color)]/80"
              class:emoji-tab-active={activeTab?.id === tab.id}
              class:emoji-hoverable={activeTab?.id !== tab.id}
              data-test="emoji-tab"
              on:click={() => (activeTabId = tab.id)}>
              {tab.label}
            </button>
          {/each}
        </div>
      {/if}

      <!-- 表情区：占满面板剩余高度，只纵向滚动（横向一律不滚，宽度按面板自适应换行） -->
      <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2" data-test="emoji-list">
        {#if loading && (!emojiSet || emojiSet.tabs.length === 0)}
          <p class="py-6 text-center text-xs text-[var(--text-color)]/60">{t('comments.emojiLoading')}</p>
        {:else if activeTab && activeTab.items.length > 0}
          {#if activeTabIsText}
            <!-- 颜文字：按内容宽度自适应（长短不一，固定列宽会互相挤压） -->
            <div class="flex flex-wrap gap-1">
              {#each activeTab.items as item}
                <button type="button"
                  class="emoji-hoverable emoji-text-item flex min-h-[2rem] min-w-[2rem] max-w-full items-center justify-center rounded px-2 py-1 text-sm leading-none"
                  title={item.title}
                  data-test="emoji-item"
                  data-insert={item.insert}
                  on:click={() => pick(item)}>
                  <span class="break-all text-center">{item.preview}</span>
                </button>
              {/each}
            </div>
          {:else}
            <!-- 图片表情：等宽 2rem 列，列数随面板宽度自动增减（窄屏不会顶出横向滚动） -->
            <div class="grid grid-cols-[repeat(auto-fill,2rem)] justify-between gap-1">
              {#each activeTab.items as item}
                <button type="button"
                  class="emoji-hoverable flex h-8 w-8 items-center justify-center rounded"
                  title={item.title}
                  data-test="emoji-item"
                  data-insert={item.insert}
                  on:click={() => pick(item)}>
                  {#if item.shortcode}
                    <img src={item.preview} alt={item.insert} class="momo-emoji" loading="lazy" decoding="async"
                      referrerpolicy="no-referrer" />
                  {:else}
                    <span class="text-base leading-none">{item.preview}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        {:else if error}
          <div class="py-4 text-center">
            <p class="text-xs text-red-500">{error}</p>
            <button type="button" class="mt-2 text-xs underline text-[var(--link-color)]"
              data-test="emoji-retry" on:click={() => ensureLoaded(true)}>
              {t('comments.emojiRetry')}
            </button>
          </div>
        {:else}
          <p class="py-6 text-center text-xs text-[var(--text-color)]/60" data-test="emoji-empty">
            {t('comments.emojiEmpty')}
          </p>
        {/if}

        {#if stale && !loading}
          <button type="button" class="mt-1 w-full text-center text-[10px] text-amber-500 underline"
            data-test="emoji-stale" on:click={() => ensureLoaded(true)}>
            {t('comments.emojiStale')}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .emoji-tab-active {
    background: color-mix(in srgb, var(--link-color) 12%, transparent);
    color: var(--link-color);
  }
  .emoji-hoverable:hover {
    background-color: color-mix(in srgb, var(--text-color) 12%, transparent);
  }
  /* 面板底色默认跟随 hover 底色；宿主可用 --momo-panel-bg 覆盖 */
  .emoji-panel {
    background-color: var(--momo-panel-bg, var(--button-hover-bg-color));
    width: min(24rem, calc(100vw - 2rem));
  }
</style>
