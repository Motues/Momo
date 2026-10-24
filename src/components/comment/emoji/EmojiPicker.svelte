<script lang="ts">
  import { onMount } from 'svelte';
  import i18nit from '@i18n/translation';
  import {
    getCachedEmojiSet,
    loadEmojiSet,
    type EmojiSet,
  } from './owo';

  export let language: string = 'zh-cn';
  /**
   * 表情来源地址列表（由评论列表接口的 `emoji_cdn_urls` 下发，旧后端的单地址
   * `emoji_cdn_url` 由调用方归一化成单元素数组）。空数组表示没有可用地址，按钮不可用。
   */
  export let cdnUrls: string[] = [];
  /** 兼容旧调用方：单个地址（列表为空时作为回落） */
  export let cdnUrl: string = '';
  export let disabled: boolean = false;
  /** 选中表情时回调，参数是要插入输入框的文本 */
  export let onPick: (text: string) => void = () => {};
  /** 表情集合就绪后回传（父组件用它水合已有评论；双向绑定） */
  export let emojiSet: EmojiSet | null = null;

  const t = i18nit(language);

  /** 面板最大高度：视口空间充足时的上限 */
  const PANEL_MAX_HEIGHT = 256;
  /** 面板最小高度：再小就没法点表情了（下方放不下时才考虑翻到按钮上方） */
  const PANEL_MIN_HEIGHT = 96;
  /** 面板最大宽度（24rem） */
  const PANEL_MAX_WIDTH = 384;
  /** 面板最小宽度（极窄视口的保护，避免算出负数宽度） */
  const PANEL_MIN_WIDTH = 200;
  /** 面板与按钮之间的间距（原来对应 mt-2） */
  const PANEL_GAP = 8;
  /** 面板与可视视口边缘保留的空白 */
  const VIEWPORT_MARGIN = 12;
  /**
   * 面板配色变量：它们定义在 `.comment-container`（style/main.css）而**不是** `:root`，
   * 面板 portal 到 body 之后不再继承这些变量，必须把按钮上的计算值复制到面板的内联样式里，
   * 否则面板会变成「无边框、默认文字色」的裸块（深色模式下尤其明显）。
   */
  const THEME_VARS = [
    '--text-color',
    '--text-color-70',
    '--link-color',
    '--button-border-color',
    '--button-hover-bg-color',
    '--momo-panel-bg',
  ];

  let open = false;
  let loading = false;
  let error = '';
  let stale = false;
  /** 部分来源加载失败（成功的那几个照常渲染，底部提示可重试） */
  let partial = false;
  let activeTabId = '';
  let panelEl: HTMLDivElement | undefined;
  let buttonEl: HTMLButtonElement | undefined;
  /** 面板的 fixed 定位串（left/top|bottom/width/max-height + 主题变量），打开时算好再渲染 */
  let panelStyle = '';
  /** 面板是否翻到了按钮上方（仅当下方连最小高度都放不下时） */
  let panelAbove = false;
  /** resize/scroll 重算的 rAF 句柄（高频事件合并到一帧） */
  let positionFrame = 0;

  /** 实际使用的地址列表：空数组时回落到旧的单地址（旧调用方兼容） */
  $: urlList = cdnUrls.length > 0 ? cdnUrls : (cdnUrl ? [cdnUrl] : []);

  /** 没有可用地址（或调用方禁用）时按钮不可点：绝不请求空地址 */
  $: unavailable = disabled || urlList.length === 0;

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
      const set = await loadEmojiSet({ cdnUrls: urlList, force });
      emojiSet = set;
      stale = Boolean(set.stale);
      partial = Boolean(set.partial);
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
   * 可视视口（移动端软键盘/缩放都只改 visualViewport，不改 window.innerWidth/innerHeight）。
   * 拿不到 visualViewport（或它给出 0 尺寸）时回落到窗口尺寸。
   */
  function visibleViewport() {
    const vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) {
      return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height };
    }
    return { left: 0, top: 0, width: window.innerWidth || 0, height: window.innerHeight || 0 };
  }

  /** 把按钮上已解析的配色变量复制成面板的内联声明（portal 后不继承 `.comment-container`） */
  function themeVarStyle(): string {
    if (!buttonEl) return '';
    let computed: CSSStyleDeclaration;
    try {
      computed = getComputedStyle(buttonEl);
    } catch {
      return '';
    }
    return THEME_VARS.map((name) => {
      const value = computed.getPropertyValue(name).trim().replace(/;/g, '');
      return value ? `${name}: ${value};` : '';
    })
      .filter(Boolean)
      .join(' ');
  }

  /**
   * 面板用 `position: fixed` + 实测坐标定位（而不是 `absolute` 挂在按钮外层）：
   *
   * - 二级/拍平回复外面套了 `overflow-hidden` 的容器（CommentItem.svelte 的回复列表），
   *   `absolute` 面板会被它裁掉；曲线救国改 z-index 没用 —— `z-index` 只在最近的
   *   层叠上下文里比较，`overflow-hidden` 照样裁。挂到 body 并改 `fixed` 才能同时摆脱
   *   裁剪与宿主的层叠上下文（`transform` / `filter` 祖先也会把 `fixed` 关在里面）。
   * - 宽度按可视视口算，并夹住左边缘：窄屏上按钮本身有缩进（头像 + 边框 + padding），
   *   再用 `left: 0` + `100vw` 估算就会从右边溢出。
   * - 高度按「按钮底边 → 可视视口底边」的剩余空间自适应；只有下方连最小高度都放不下、
   *   且上方更宽裕时才翻到按钮上方（移动端软键盘弹出后的兜底）。
   */
  function updatePanelPosition() {
    if (!buttonEl) return;
    const rect = buttonEl.getBoundingClientRect();
    const view = visibleViewport();
    const edge = VIEWPORT_MARGIN;

    const width = Math.round(
      Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, view.width - edge * 2))
    );
    const minLeft = view.left + edge;
    const maxLeft = Math.max(minLeft, view.left + view.width - width - edge);
    const left = Math.round(Math.min(Math.max(rect.left, minLeft), maxLeft));

    const belowTop = rect.bottom + PANEL_GAP;
    const belowSpace = view.top + view.height - belowTop - edge;
    const aboveBottom = rect.top - PANEL_GAP;
    const aboveSpace = aboveBottom - view.top - edge;

    const flipUp = belowSpace < PANEL_MIN_HEIGHT && aboveSpace > belowSpace;
    const available = flipUp ? aboveSpace : belowSpace;
    const maxHeight = Math.round(
      Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, available))
    );

    // 翻到上方时锚的是底边（bottom）：面板内容少也不会离按钮太远
    const vertical = flipUp
      ? `bottom: ${Math.round(Math.max(0, (window.innerHeight || 0) - aboveBottom))}px;`
      : `top: ${Math.round(belowTop)}px;`;

    panelAbove = flipUp;
    panelStyle = (
      `position: fixed; left: ${left}px; width: ${width}px; max-height: ${maxHeight}px; ` +
      `${vertical} ${themeVarStyle()}`
    ).trim();
  }

  /** 滚动/resize/键盘弹出都是高频事件，合并到一帧里重算 */
  function schedulePosition() {
    if (!open || positionFrame) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      if (open) updatePanelPosition();
    });
  }

  /**
   * 面板挂到 body：脱离所有 `overflow-hidden` 裁剪盒与祖先层叠上下文。
   *
   * Svelte 5 的 action 在 effect 里执行，正常情况下节点已插入 DOM 后再搬走；
   * 这里再加一个微任务兜底（节点被 Svelte 重新插回原位时再搬一次），
   * 两种执行顺序下最终都会落在 body 上。
   */
  function portal(node: HTMLElement) {
    const move = () => {
      // isConnected 为 false 时说明要么还没被 Svelte 插入（等下一次微任务），
      // 要么已经被销毁 —— 两种都不该再往 body 上挂。
      if (!node.isConnected) return;
      if (node.parentNode !== document.body) document.body.appendChild(node);
    };
    move();
    queueMicrotask(move);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function toggle() {
    if (unavailable) return;
    if (open) {
      close();
      return;
    }
    // 先用手上的缓存立刻渲染（可能是空集合），再按需拉取
    if (!emojiSet) emojiSet = getCachedEmojiSet({ cdnUrls: urlList });
    if (emojiSet.tabs.length > 0) activeTabId = activeTabId || emojiSet.tabs[0].id;
    // 先算好位置再渲染，面板不会先闪在错误位置再跳过去
    updatePanelPosition();
    open = true;
    void ensureLoaded(false);
  }

  function close() {
    open = false;
    if (positionFrame) {
      cancelAnimationFrame(positionFrame);
      positionFrame = 0;
    }
  }

  /** 窄屏（与 CommentItem 的移动端断点一致）：选完表情立刻收起，把屏幕还给输入区 */
  function isNarrowViewport() {
    try {
      return window.matchMedia('(max-width: 767px)').matches;
    } catch {
      return false;
    }
  }

  function pick(item: { insert: string }) {
    onPick(item.insert);
    if (isNarrowViewport()) close();
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

  onMount(() => {
    const onScroll = (event: Event) => {
      if (!open) return;
      const target = event.target;
      // 面板内部（表情列表）的滚动不需要重算；页面或任意祖先滚动时让面板跟着按钮走
      if (target instanceof Node && panelEl && (target === panelEl || panelEl.contains(target))) return;
      schedulePosition();
    };
    const onViewportChange = () => schedulePosition();

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onViewportChange);
    // 软键盘弹出/收起、移动端工具栏收起、双指缩放：只有 visualViewport 会变
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      if (positionFrame) cancelAnimationFrame(positionFrame);
    };
  });
</script>

<svelte:window on:click={onWindowClick} on:keydown={onWindowKeydown} />

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
      use:portal
      class="emoji-panel fixed flex flex-col overflow-hidden rounded border border-[var(--button-border-color)] shadow-lg"
      style={panelStyle}
      role="dialog"
      aria-label={t('comments.emojiPanel')}
      data-test="emoji-panel"
      data-placement={panelAbove ? 'top' : 'bottom'}
    >
      <!-- 标签栏：宽度不够时换行，不做横向滚动（避免出现横向滚动条） -->
      {#if emojiSet && emojiSet.tabs.length > 0}
        <div class="flex flex-wrap items-center gap-1 border-b border-[var(--button-border-color)] px-1 pt-1"
          role="tablist" data-test="emoji-tablist">
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

        {#if partial && !loading}
          <button type="button" class="mt-1 w-full text-center text-[10px] text-amber-500 underline"
            data-test="emoji-partial" on:click={() => ensureLoaded(true)}>
            {t('comments.emojiPartial')}
          </button>
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
  /*
   * 面板底色默认跟随 hover 底色；宿主可用 --momo-panel-bg 覆盖。
   * 面板被 portal 到 body 时是 body 的直接子节点，宿主的固定导航一般 z-index < 9999，
   * 所以这里给一个足够高的层级（面板已经是「弹窗」语义，不应被正文元素盖住）。
   */
  .emoji-panel {
    background-color: var(--momo-panel-bg, var(--button-hover-bg-color));
    z-index: 9999;
    /* JS 会写入精确的 px 宽度；这里只是定位脚本没有跑起来时的兜底 */
    max-width: calc(100vw - 1.5rem);
  }
</style>
