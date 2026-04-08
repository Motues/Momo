<script lang="ts">
  import i18nit from '../../i18n/translation.ts';

  export let dateFormatted = "";
  export let words = 0;
  export let minutes = 0;
  export let language: string = 'zh-cn';

  const t = i18nit(language);

  let isExpanded = false;
  let contentHeight = 0;
  
  // 设定的最大高度阈值 (px)，超过此高度将默认折叠
  const MAX_HEIGHT = 200; 

  // 根据内容高度动态判断是否需要展示“展开/收起”按钮
  $: needsCollapse = contentHeight > MAX_HEIGHT;

  function toggleExpand() {
    isExpanded = !isExpanded;
  }
</script>

<div class="memo-card rounded-lg p-6 mb-6 shadow-sm border border-[var(--button-border-color)]" >
  <div class="flex items-center justify-between mb-4">
    <span class="text-base font-bold text-[var(--text-color)]">
      {dateFormatted}
    </span>
    <span class="text-sm text-[var(--text-color-70)]">
      {words} {t('memoCard.words')} · {minutes} {t('memoCard.minutes')}
    </span>
  </div>

  <div class="relative">
    <div
      class="markdown-content onload-animation overflow-hidden"
      style="max-height: {needsCollapse && !isExpanded ? MAX_HEIGHT + 'px' : 'none'};"
    >
      <div bind:clientHeight={contentHeight}>
        <slot /> </div>
    </div>

    {#if needsCollapse && !isExpanded}
      <div 
        class="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-[var(--bg-color,#fff)] to-transparent pointer-events-none"
      ></div>
    {/if}
  </div>

  {#if needsCollapse}
    <div class="mt-2 flex justify-center">
      <button
        class="text-sm hover:text-[var(--link-color)] transition-colors font-bold py-1 px-4 cursor-pointer"
        on:click={toggleExpand}
      >
        {isExpanded ? t('memoCard.collapsed') : t('memoCard.expanded')}
      </button>
    </div>
  {/if}
</div>