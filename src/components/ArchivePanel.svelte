<script>
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import HashtagIcon from './misc/HashtagIcon.svelte';
  import i18nit from '@i18n/translation';
  import { formatMonthDay } from '@/utils/time'
  import { blogPostUrl } from '@utils/urlUtils';

  export let sortedPosts = [];
  export let currentLang = "zh-cn";
  export let defaultLocale = "zh-cn";

  let selectedCategories = [];
  // 首次渲染参与入场动画；筛选后由 Svelte 的 fade / flip 接管，不再打 data-reveal
  let interacted = false;
  const t = i18nit(currentLang);

  $: categories = [...new Set(sortedPosts.map(post => post.data.category || 'undefined'))].sort();

  $: filteredPosts = selectedCategories.length > 0
    ? sortedPosts.filter(post => {
        const postCat = post.data.category || 'undefined';
        return selectedCategories.includes(postCat);
      })
    : sortedPosts;

  $: postsByYear = filteredPosts.reduce((acc, post) => {
    const year = new Date(post.data.pubDate).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(post);
    return acc;
  }, {});

  $: years = Object.keys(postsByYear).sort((a, b) => b - a);

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    
    // category=undefined 表示只看未分类文章
    if (categoryParam === 'undefined') {
      selectedCategories = ['undefined'];
    } else if (categoryParam && categoryParam !== 'null') {
      selectedCategories = categoryParam.split(',');
    }

    const handlePopState = () => {
      interacted = true;
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

    // 等 DOM 渲染完再量高度（含异步加载的内容）
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
        childList: true,
        subtree: true,
        attributes: false,
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

  function toggleCategory(cat) {
    interacted = true;
    if (cat === null) {
      selectedCategories = []; // cat 为 null 表示「全部」
    } else {
      if (selectedCategories.includes(cat)) {
        selectedCategories = selectedCategories.filter(c => c !== cat);
      } else {
        selectedCategories = [...selectedCategories, cat];
      }
    }

    // 同步地址栏参数，便于分享与刷新
    const url = new URL(window.location);
    if (selectedCategories.length > 0) {
      url.searchParams.set('category', selectedCategories.join(','));
    } else {
      url.searchParams.delete('category');
    }
    window.history.replaceState({ ...window.history.state, url: url.pathname + url.search }, '', url);
  }

</script>

<div class="archives mx-auto w-full max-w-[var(--page-width)]">
    <div class="text-center pt-5 pb-10 max-w-[var(--page-width)] mx-auto md:mt-0 mt-28">
        <h1 class="text-[var(--text-color)] text-3xl py-5 font-bold">{t("header.archive")}</h1>
        <p class="text-[var(--text-color-70)] font-bold">{t("cover.subTitle.archive", {count: filteredPosts.length})}</p>
    </div>

    <div class="py-6 mx-auto text-[var(--text-color)]" id="archive-content">
        {#each years as year (year)}
            <div class="mb-8">
                <h2 data-reveal={interacted ? undefined : 'pop'} class="text-2xl font-bold my-4 text-[var(--text-color)] flex items-center gap-3">
                    <span class="w-1 h-6 bg-[var(--link-color)] rounded-full"></span>
                    {year}
                </h2>
                <div class="space-y-2">
                    {#each postsByYear[year] as post, index (post.id)}
                        <div
                            data-reveal={interacted ? undefined : 'pop'}
                            data-reveal-delay={interacted ? undefined : String(Math.min(index, 5) * 50)}
                            animate:flip={{ duration: 380, easing: cubicOut }}
                            in:fade={{ duration: 180, easing: cubicOut }}
                            out:fade={{ duration: 150 }}
                        >
                            <a 
                                href={blogPostUrl(currentLang, post.id)} 
                                class="momo-row group"
                            >
                                <span class="text-[var(--text-color-70)] min-w-[80px] md:min-w-[120px]">
                                    {formatMonthDay(post.data.pubDate, currentLang)}
                                </span>
                                
                                <span class="text-lg group-hover:pl-2 group-hover:text-[var(--link-color)] group-hover:font-bold transition-[padding-left,color,font-weight] duration-200 flex-1 group-active:text-[var(--link-color)]">
                                    {post.data.title}
                                    {#if post.isFallback}
                                        <span class="inline-block px-1 ml-2 text-xs font-mono uppercase bg-[var(--button-hover-color)] rounded border border-[var(--button-border-color)]">
                                            {defaultLocale}
                                        </span>
                                    {/if}
                                </span>

                                <span class="hidden md:flex items-center font-mono text-sm text-[var(--text-color-70)]">
                                    <HashtagIcon class="mr-1" />
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
                <HashtagIcon class="text-xs" />
                <span>{t("category")}</span>
            </div>

            <div class="flex flex-wrap gap-2">
                
                {#each categories as cat}
                    <button 
                        on:click={() => toggleCategory(cat)}
                        aria-current={selectedCategories.includes(cat) ? 'true' : 'false'}
                        class="momo-chip"
                    >
                        {cat === 'undefined' ? t("pagecard.uncategorized") : cat}
                    </button>
                {/each}
            </div>
        </div>
    </aside>