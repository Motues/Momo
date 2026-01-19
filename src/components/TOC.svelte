<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { spring } from 'svelte/motion';
	import { siteConfig } from "@/config";
	import i18nit from '@i18n/translation'

	let { headings = [], language,} = $props();
	const t = i18nit(language);

	// 内部状态
	let tocVisible = $state(false);
	let activeIndex = $state(-1);
	let tocListElement = $state(null);

	// 弹簧动画：处理索引位置的连续过渡
	const focusSpring = spring(-1, {
		stiffness: 0.12,
		damping: 0.7
	});

	// 基础逻辑计算
	let minDepth = $derived(headings.length > 0 ? Math.min(...headings.map(h => h.depth)) : 0);
	let maxDepth = $derived(minDepth + (siteConfig?.toc?.depth || 2));
	let filteredHeadings = $derived(headings.filter(h => h.depth < maxDepth));

	// 同步动画索引
	$effect(() => {
		focusSpring.set(activeIndex);
	});

	// 滚动监听逻辑
	function handleScroll() {
		const headerCoverHeight = 200;
		const scrollY = window.scrollY || window.pageYOffset;
		tocVisible = scrollY > headerCoverHeight;
	}

	// 交叉观察器：检测当前阅读章节
	function initObserver() {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const idx = filteredHeadings.findIndex(h => h.slug === entry.target.id);
					if (idx !== -1) {
						activeIndex = idx;
						autoScrollTOC(idx);
					}
				}
			});
		}, { rootMargin: '-10% 0px -70% 0px', threshold: 0.1 });

		filteredHeadings.forEach(h => {
			const el = document.getElementById(h.slug);
			if (el) observer.observe(el);
		});
		return observer;
	}

	// 目录内部自动滚动 
	function autoScrollTOC(index) {
		if (tocListElement) {
			const items = tocListElement.querySelectorAll('a');
			const activeItem = items[index];
			if (activeItem) {
				const containerHeight = tocListElement.clientHeight;
				const targetScroll = activeItem.offsetTop - containerHeight / 2 + (activeItem.clientHeight / 2);
				tocListElement.scrollTo({ top: targetScroll, behavior: 'smooth' });
			}
		}
	}

	// 动态样式算法：基于弹簧数值计算透明度与字重
	function getSpringStyle(index, currentSpring) {
		const distance = Math.abs(index - currentSpring);
		// 距离当前激活项越近，越明显
		const opacity = Math.max(0.2, 1 - distance * 0.2);
		// 只有距离非常近时才加粗
		const fontWeight = distance < 0.5 ? '700' : '400';
		
		return `opacity: ${opacity}; font-weight: ${fontWeight};`;
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll();
		const observer = initObserver();

		return () => {
			window.removeEventListener('scroll', handleScroll);
			observer.disconnect();
		};
	});
</script>

{#if tocVisible}
	<aside 
		transition:fade={{ duration: 300 }}
		class="fixed top-20 w-[var(--toc-width)] left-[var(--toc-offset-left)] z-10 hidden lg:block text-[var(--text-color)]"
	>
		<div class="flex flex-col h-[50vh] bg-transparent">
			<h2 id="toc-heading" class="text-lg font-bold mb-2 uppercase tracking-widest">
				{t("toc")}
			</h2>

			<ul 
				bind:this={tocListElement}
				class="overflow-y-auto space-y-2 pr-4 no-scrollbar"
				style="scrollbar-width: none; scroll-behavior: smooth;"
			>
				{#each filteredHeadings as heading, i}
					<li>
						<a
							href={`#${heading.slug}`}
							class="block py-1 text-sm transition-colors duration-300 hover:text-[var(--link-color)]"
							style:padding-left="{(heading.depth - minDepth) * 1.2}rem" 
							style={getSpringStyle(i, $focusSpring)}
							onclick={(e) => {
								e.preventDefault();
								document.getElementById(heading.slug)?.scrollIntoView({ behavior: 'smooth' });
							}}
						>
							{heading.text}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</aside>
{/if}

<style>
	/* 隐藏滚动条但保留功能  */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	
	/* 确保文字不会因为加粗而产生剧烈的布局抖动 */
	a {
		will-change: opacity, font-weight;
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>