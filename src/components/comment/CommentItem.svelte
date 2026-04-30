<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  // 👇 自引用，递归必须这样导入
  import CommentItem from './CommentItem.svelte';
  import i18nit from '../../i18n/translation.ts';
  import { parseMarkdown, validateMarkdown } from '@utils/markdown';
  import { siteConfig } from '@/config.ts';
  import { formatFullDate } from '@/utils/time';

  export let c: any;
  export let postSlug: string;
  export let replyingToId: number | null = null;
  export let author: string = '';
  export let email: string = '';
  export let url: string = '';
  export let language: string = 'zh-cn';

  export let depth: number = 0; // 记录评论的层级，顶层为 0
  export let isFlattened: boolean = false; // 是否处于移动端被“拍平”的状态
  export let parentAuthorName: string = ''; // 记录它在回复谁（移动端拍平后使用）
  export let parentCommentId: string | number | null = null; // 用于锚点跳转的父评论 ID

  let isMobile = false;
 
  onMount(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    
    // 初始化
    isMobile = mql.matches;

    // 监听变化
    const listener = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
    };

    // 使用较新的 addEventListener API
    mql.addEventListener('change', listener);
    
    // 组件销毁时自动清理
    return () => mql.removeEventListener('change', listener);
  });

  const t = i18nit(language);

  let replyAuthor = '';
  let replyEmail = '';
  let replyUrl = '';
  let replyContent = '';
  
  // 防止重复提交 - 每个回复表单独立的状态
  let replySubmitting = false;
  let replyShowPreview = false;
  let replyPreviewHtml = '';
  let replyMarkdownWarnings: string[] = [];

  function toggleReplyPreview() {
    if (!replyShowPreview) {
      replyPreviewHtml = parseMarkdown(replyContent);
      replyMarkdownWarnings = validateMarkdown(replyContent);
    }
    replyShowPreview = !replyShowPreview;
  }
  
  const dispatch = createEventDispatcher();
  
  const avatarUrl = c.avatar;

  // 计算内容字数
  function getWordCount(text: string): { chars: number; words: number } {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { chars, words };
  }

  // 检查字数是否超出限制
  function isContentWithinLimit(text: string): boolean {
    const { chars, words } = getWordCount(text);
    return chars <= 2000 && words <= 1000;
  }

  const apiUrl = siteConfig.comments.backendUrl;

   function isValidHtml(str: string): boolean {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/html');
    
    // 检查解析过程中是否产生了 parsererror 节点
    // 或者检查 body 中是否有子节点
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) return false;

    // 只要 body 里面有元素，说明解析出了 HTML 结构
    // console.log('result', doc.body.childNodes);
    return doc.body.childNodes.length > 0;
  }

  // --- 新增：将嵌套的回复树拍平为一维数组，用于移动端展示 ---
  function flattenRepliesWithParent(replies: any[], pName: string, pId: any): any[] {
    if (!replies || !replies.length) return [];
    let res: any[] = [];
    for (const r of replies) {
      // 保存它所回复的父节点信息
      res.push({
        ...r,
        _parentName: pName,
        _parentId: pId
      });
      // 递归寻找更深层的回复
      if (r.replies && r.replies.length > 0) {
        res = res.concat(flattenRepliesWithParent(r.replies, r.author, r.id));
      }
    }
    return res;
  }

  // 响应式变量：只有在顶层评论 (depth === 0) 才会去计算拍平的数组，按时间正序排列
  $: mobileFlattenedReplies = (depth === 0 && c.replies) 
    ? flattenRepliesWithParent(c.replies, c.author, c.id).sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime())
    : [];

</script>

<div id="comment-{c.id}" data-aos="fade-up" class="flex gap-2 md:gap-3 w-full max-w-full">
  {#if c.url}
  <a href={c.url} target="_blank" class="w-10 h-10 shrink-0">
    <img src={avatarUrl} alt="avatar" class="w-10 h-10 rounded-full object-cover"/>
  </a>
  {:else}
  <img src={avatarUrl} alt="avatar" class="w-10 h-10 rounded-full object-cover shrink-0"/>
  {/if}

  <div class="flex-1 min-w-0">
    <div class="flex items-center flex-wrap gap-x-2 gap-y-1">
      {#if c.url}
        <a href={c.url} target="_blank" class="font-semibold text-[var(--text-color)] hover:text-[var(--link-color)] transition-colors">
          {c.author}
        </a>
      {:else}
        <span class="font-semibold text-[var(--text-color)]">{c.author}</span>
      {/if}

      {#if isFlattened && parentAuthorName}
        <span class="text-sm text-[var(--text-color-70)]">{t('comments.replyTo') || '回复'}</span>
        <a 
          href="#comment-{parentCommentId}" 
          class="text-sm font-semibold text-[var(--link-color)] hover:underline transition-colors"
          on:click|preventDefault={(e) => {
          const target = document.getElementById(`comment-${parentCommentId}`);
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth', // 平滑滚动
              block: 'start'      // 对齐到顶部
            });

            // 添加高亮动画
            target.classList.add('highlight-flash');
            setTimeout(() => target.classList.remove('highlight-flash'), 2000);
          }
        }}>
          {parentAuthorName}
        </a>
      {/if}

      <span class="text-sm text-[var(--text-color-70)]">{formatFullDate(new Date(c.pubDate), language)}</span>
    </div>

    <div class="text-[var(--text-color)] mt-1 leading-relaxed w-full max-w-full min-w-0 text-sm comment-markdown">
      {#if c.contentHtml && typeof c.contentHtml === 'string' && isValidHtml(c.contentHtml)}
        <div class="break-words w-full max-w-full">{@html c.contentHtml}</div>
      {:else if c.contentText && typeof c.contentText === 'string' && c.contentText.trim() !== ''}
        <p class="break-words whitespace-pre-wrap overflow-hidden w-full max-w-full min-w-0">
          {c.contentText}
        </p>
      {:else if c.contentHtml && typeof c.contentHtml === 'string' && c.contentHtml.trim() !== ''}
        <p class="break-words whitespace-pre-wrap overflow-hidden w-full max-w-full min-w-0">
          {c.contentHtml}
        </p>
      {:else}
        <p class="break-words whitespace-pre-wrap overflow-hidden w-full max-w-full min-w-0 text-gray-500">
          {t('comments.noContent') || '评论内容为空'}
        </p>
      {/if}
    </div>

    <div class="mt-1 flex items-center gap-4 text-sm text-[var(--text-color-70)]">
      <button on:click={() => {
        dispatch('reply', c.id);
        replyAuthor = author;
        replyEmail = email;
        replyUrl = url;
      }} class="hover:text-[var(--link-color)]">
        {t('comments.reply')}
      </button>
    </div>

    <!-- 回复表单 -->
    {#if replyingToId === c.id}
      <div transition:slide={{ duration: 300 }} class="mt-4 pl-4 border-l-2 border-gray-200">
        <form on:submit|preventDefault={() => {
          if (replySubmitting) return;
          
          if (!replyAuthor || !replyEmail || !replyContent) {
            alert(t('comments.fillRequired') || '请填写昵称、邮箱和评论内容');
            return;
          }

          // 检查字数限制
          if (!isContentWithinLimit(replyContent)) {
            alert(t('comments.contentTooLong') || '评论内容超出限制：不超过2000汉字或1000单词');
            return;
          }
          
          replySubmitting = true;
          dispatch('submit', {
            parentId: c.id,
            author: replyAuthor,
            email: replyEmail,
            url: replyUrl,
            content: replyContent,
            post_url: window.location.href,
          });
          replyContent = '';
        }} class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label for="reply-author-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.name')}<span class="text-red-500">*</span></label>
              <input id="reply-author-{c.id}" type="text" placeholder={t('comments.required')} bind:value={replyAuthor}
                on:input={() => dispatch('userInfoChange', { author: replyAuthor, email: replyEmail, url: replyUrl })}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm py-1 px-2" />
            </div>
            <div>
              <label for="reply-email-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.email')}<span class="text-red-500">*</span></label>
              <input id="reply-email-{c.id}" type="email" placeholder={t('comments.required')} bind:value={replyEmail}
                on:input={() => dispatch('userInfoChange', { author: replyAuthor, email: replyEmail, url: replyUrl })}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm py-1 px-2" />
            </div>
            <div>
              <label for="reply-url-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.site')}</label>
              <input id="reply-url-{c.id}" type="url" placeholder={t('comments.optional')} bind:value={replyUrl}
                on:input={() => dispatch('userInfoChange', { author: replyAuthor, email: replyEmail, url: replyUrl })}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm py-1 px-2" />
            </div>
          </div>

          <div>
            {#if replyShowPreview}
              <div class="rounded border text-[var(--text-color)] border-[var(--button-border-color)] p-2 min-h-[80px] text-sm leading-relaxed comment-markdown">
                {#if replyContent.trim() === ''}
                  <p>{t('comments.preview') || '预览'}</p>
                {:else}
                  <div>{@html replyPreviewHtml}</div>
                {/if}
              </div>
              {#if replyMarkdownWarnings.length > 0}
                <div class="mt-1 text-xs text-amber-500">
                  {#each replyMarkdownWarnings as warning}
                    <p>{warning === 'codeFence' ? (t('comments.codeFence') || '代码块标记 ``` 未闭合') : (t('comments.inlineCode') || '行内代码标记 ` 未闭合')}</p>
                  {/each}
                </div>
              {/if}
            {:else}
              <textarea placeholder={t('comments.replyPlaceholder') || "写下你的回复..."}
                class="rounded w-full border text-[var(--text-color)] border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-2 min-h-[80px]"
                bind:value={replyContent}></textarea>
            {/if}
            <div class="text-right text-xs text-[var(--text-color)]/70 mt-1">
              {#if !isContentWithinLimit(replyContent)}
                <span class="text-red-500 ml-2">{t('comments.contentTooLong') || '内容超出限制'}</span>
              {/if}
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button type="button" on:click={toggleReplyPreview}
              class="rounded px-3 py-1 text-sm text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-bg-color)]">
              {replyShowPreview ? (t('comments.write') || '撰写') : (t('comments.preview') || '预览')}
            </button>
            <button type="button" on:click={() => {
              dispatch('cancel');
              replySubmitting = false;
            }} class="rounded px-3 py-1 text-sm text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)]">
              {t('comments.cancel')}
            </button>
            <button type="submit" disabled={replySubmitting || !isContentWithinLimit(replyContent)} class="rounded px-3 py-1 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)] disabled:opacity-50">
              {replySubmitting ? t('comments.sending') : t('comments.reply')}
            </button>
          </div>
        </form>
      </div>
    {/if}

    <div class="border-l border-[var(--text-color)]/50 space-y-3 w-full pl-2 md:pl-3">
    {#if !isMobile}
      {#if c.replies && c.replies.length}
        {#each c.replies as reply}
          <div class="w-full max-w-full overflow-hidden mt-4 ">
            <CommentItem 
              c={reply} 
              {postSlug} 
              {author} 
              {email} 
              {url} 
              {language} 
              depth={depth + 1}
              isFlattened={false}
              on:reply={(e) => dispatch('reply', e.detail)} 
              on:submit={(e) => dispatch('submit', e.detail)}
              on:cancel={() => dispatch('cancel')}
              replyingToId={replyingToId}
              on:userInfoChange={(e) => dispatch('userInfoChange', e.detail)} 
            />
          </div>
        {/each}
      {/if}
    {:else}
      {#if depth === 0 && mobileFlattenedReplies.length > 0}
        {#each mobileFlattenedReplies as flatReply}
          <div class="w-full max-w-full overflow-hidden mt-4 ">
            <CommentItem 
              c={flatReply} 
              {postSlug} 
              {author} 
              {email} 
              {url} 
              {language}
              depth={1}
              isFlattened={true}
              parentAuthorName={flatReply._parentName}
              parentCommentId={flatReply._parentId}
              on:reply={(e) => dispatch('reply', e.detail)} 
              on:submit={(e) => dispatch('submit', e.detail)}
              on:cancel={() => dispatch('cancel')}
              replyingToId={replyingToId} on:userInfoChange={(e) => dispatch('userInfoChange', e.detail)}
            />
          </div>
        {/each}
      {/if}
    {/if}
  </div>

  </div>
</div>

<style>
  .comment-markdown :global(h1),
  .comment-markdown :global(h2),
  .comment-markdown :global(h3),
  .comment-markdown :global(h4) {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .comment-markdown :global(h1) { font-size: 1.5rem; }
  .comment-markdown :global(h2) { font-size: 1.25rem; }
  .comment-markdown :global(h3) { font-size: 1.1rem; }
  .comment-markdown :global(p) { margin-bottom: 0.5rem; }
  .comment-markdown :global(ul),
  .comment-markdown :global(ol) {
    margin-bottom: 0.5rem;
    padding-left: 1.5rem;
  }
  .comment-markdown :global(ul) { list-style-type: disc; }
  .comment-markdown :global(ol) { list-style-type: decimal; }
  .comment-markdown :global(li) { margin-bottom: 0.25rem; }
  .comment-markdown :global(blockquote) {
    border-left: 3px solid var(--link-color, #6366f1);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    opacity: 0.85;
  }
  .comment-markdown :global(pre) {
    background: rgba(0,0,0,0.08);
    border-radius: 4px;
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
    font-size: 0.85rem;
  }
  .comment-markdown :global(code) {
    background: rgba(0,0,0,0.06);
    border-radius: 3px;
    padding: 0.15rem 0.3rem;
    font-size: 0.85rem;
    font-family: monospace;
  }
  .comment-markdown :global(pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
  }
  .comment-markdown :global(a) {
    color: var(--link-color, #6366f1);
    text-decoration: underline;
  }
  .comment-markdown :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.5rem 0;
  }
  .comment-markdown :global(hr) {
    border: none;
    border-top: 1px solid var(--button-border-color, #ddd);
    margin: 1rem 0;
  }
  .comment-markdown :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  .comment-markdown :global(th),
  .comment-markdown :global(td) {
    border: 1px solid var(--button-border-color, #ddd);
    padding: 0.4rem 0.6rem;
    text-align: left;
  }
  .comment-markdown :global(th) {
    font-weight: 600;
    background: rgba(0,0,0,0.04);
  }
  .comment-markdown :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }
</style>