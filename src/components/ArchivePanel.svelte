<script>
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import Icon from '@iconify/svelte';
  import i18nit from '@i18n/translation';
  import { formatMonthDay } from '@/utils/time'
  import { getRelativeLocaleUrl } from '@utils/url-utils';

  export let sortedPosts = [];
  export let currentLang = "zh-cn";
  export let defaultLocale = "zh-cn";

  let selectedCategories = [];
  const t = i18nit(currentLang);

  // 提取所有分类并去重
  $: categories = [...new Set(sortedPosts.map(post => post.data.category || 'undefined'))].sort();

  // 响应式过滤逻辑 - 特殊处理 undefined 情况
  $: filteredPosts = selectedCategories.length > 0
    ? sortedPosts.filter(post => {
        const postCat = post.data.category || 'undefined';
        return selectedCategories.includes(postCat);
      })
    : sortedPosts;

  // 按年份分组逻辑
  $: postsByYear = filteredPosts.reduce((acc, post) => {
    const year = new Date(post.data.pubDate).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(post);
    return acc;
  }, {});

  $: years = Object.keys(postsByYear).sort((a, b) => b - a);

  onMount(() => {
    // 获取初始 URL 参数 - 特殊处理 undefined
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    
    // 当参数为 'undefined' 时，专门用于显示未分类文章
    if (categoryParam === 'undefined') {
      selectedCategories = ['undefined'];
    } else if (categoryParam && categoryParam !== 'null') {
      selectedCategories = categoryParam.split(',');
    }

    // 处理浏览器前进/后退
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      selectedCategories = params.get('category')?.split(',') || [];
    };

    window.addEventListener('popstate', handlePopState);

    const syncAsideHeight = () => {
      const mainContent = document.getElementById('archive-content');
      const aside = document.getElementById('category-sidebar');
      
      if (mainContent && aside) {
        const mainHeight = mainContent.offsetHeight;
        aside.style.height = `${mainHeight}px`;
        
      }
    };

    // 使用 setTimeout 确保 DOM 已完全渲染（特别是异步加载内容时）
    setTimeout(syncAsideHeight, 0);

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncAsideHeight, 100);
    };
    window.addEventListener('resize', handleResize);

    const mainContent = document.getElementById('archive-content');
    let mutationObserver;
    if (mainContent) {
      mutationObserver = new MutationObserver(syncAsideHeight);
      mutationObserver.observe(mainContent, {
        childList: true,    // 监听子节点增删
        subtree: true,      // 监听后代节点
        attributes: false,  // 不需要监听属性变化（性能优化）
        characterData: false
      });
    }

    return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimer);
        
        if (mutationObserver) {
            mutationObserver.disconnect();
        }
    }
  });

  // 筛选点击逻辑
  function toggleCategory(cat) {
    if (cat === null) {
      selectedCategories = []; // 点击“全部”则清空
    } else {
      if (selectedCategories.includes(cat)) {
        // 如果已选中，则移除
        selectedCategories = selectedCategories.filter(c => c !== cat);
      } else {
        // 如果未选中，则添加
        selectedCategories = [...selectedCategories, cat];
      }
    }

    // 更新 URL，方便分享和刷新
    const url = new URL(window.location);
    if (selectedCategories.length > 0) {
      url.searchParams.set('category', selectedCategories.join(','));
    } else {
      url.searchParams.delete('category');
    }
    window.history.replaceState({}, '', url);
  }

</script>

<div class="archives mx-auto w-full max-w-[var(--page-width)]">
    <div class="text-center pt-5 pb-10 max-w-[var(--page-width)] mx-auto md:mt-0 mt-28">
        <p class="text-[var(--text-color)] text-3xl py-5 font-bold">{t("header.archive")}</p>
        <p class="text-[var(--text-color-70)] font-bold">{t("cover.subTitle.archive", {count: filteredPosts.length})}</p>
    </div>

    <div class="py-6 mx-auto text-[var(--text-color)]" id="archive-content">
        {#each years as year (year)}
            <div class="mb-8">
                <h2 class="text-2xl font-bold my-4 text-[var(--text-color)] flex items-center gap-3">
                    <span class="w-1 h-6 bg-[var(--link-color)] rounded-full"></span>
                    {year}
                </h2>
                <div class="space-y-2">
                    {#each postsByYear[year] as post (post.id)}
                        <div animate:flip={{ duration: 600 }} in:fade={{ duration: 150 }} out:fade={{ duration: 150 }} >
                            <a 
                                href={getRelativeLocaleUrl(currentLang, `/blog/${post.id}`)} 
                                class="flex items-center gap-4 active:bg-[var(--button-hover-color)] hover:bg-[var(--button-hover-color)] p-2 rounded transition-all duration-200 group"
                            >
                                <span class="text-[var(--text-color-70)] min-w-[80px] md:min-w-[120px]">
                                    {formatMonthDay(post.data.pubDate, currentLang)}
                                </span>
                                
                                <span class="text-lg group-hover:pl-2 group-hover:text-[var(--link-color)] group-hover:font-bold transition-all duration-200 flex-1 group-active:text-[var(--link-color)]">
                                    {post.data.title}
                                    {#if post.isFallback}
                                        <span class="inline-block px-1 ml-2 text-xs font-mono uppercase bg-[var(--button-hover-color)] rounded border border-[var(--button-border-color)]">
                                            {defaultLocale}
                                        </span>
                                    {/if}
                                </span>

                                <span class="hidden md:flex items-center font-mono text-sm text-[var(--text-color-70)]">
                                    <Icon icon="fa6-solid:hashtag" class="mr-1" />
                                    {post.data.category || t("pagecard.uncategorized")}
                                </span>
                            </a>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>

    <aside 
        id="category-sidebar"
        class="hidden lg:block absolute left-[var(--toc-offset-left)] top-70 bottom-0 w-[var(--category-width)]">
        <div class="sticky top-24">
            <div class="flex items-center gap-2 text-[var(--text-color)] font-bold mb-4 border-b border-[var(--button-border-color)] pb-2 uppercase tracking-wider">
                <Icon icon="fa6-solid:hashtag" class="text-xs" />
                <span>{t("category")}</span>
            </div>

            <div class="flex flex-wrap gap-2">
                
                {#each categories as cat}
                    <button 
                        on:click={() => toggleCategory(cat)}
                        class="px-3 py-1 text-xs rounded-md transition-all border
                        {selectedCategories.includes(cat) 
                            ? 'bg-[var(--link-color)] text-white border-[var(--link-color)]' 
                            : 'hover:border-[var(--link-color)] border-[var(--button-border-color)] text-[var(--text-color)]'}"
                    >
                        {cat === 'undefined' ? t("pagecard.uncategorized") : cat}
                    </button>
                {/each}
            </div>
        </div>
    </aside>