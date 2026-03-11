<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  // 👇 自引用，递归必须这样导入
  import CommentItem from './CommentItem.svelte';
  import i18nit from '../../i18n/translation.ts';
  import { siteConfig } from '@/config.ts';
  import { formatFullDate } from '@/utils/time'

  export let c: any;
  export let postSlug: string;
  export let replyingToId: number | null = null;
  export let author: string = '';
  export let email: string = '';
  export let url: string = '';
  export let language: string = 'zh-cn';

  const t = i18nit(language);

  let replyAuthor = '';
  let replyEmail = '';
  let replyUrl = '';
  let replyContent = '';
  
  // 防止重复提交 - 每个回复表单独立的状态
  let replySubmitting = false;
  
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

  // API 地址，与 Comments.svelte 中保持一致
  const apiUrl = siteConfig.comments.backendUrl;

  // 检测字符串是否包含有效的HTML标签（成对的开始和结束标签）
  function isValidHtml(str: string): boolean {
    if (!str.includes('<') || !str.includes('>')) return false;
    
    // 检查是否包含成对的HTML标签（如 <p>...</p>, <div>...</div> 等）
    const tagRegex = /<([a-z][a-z0-9]*)\b[^>]*>(.*?)<\/\1>/i;
    return tagRegex.test(str);
  }
</script>



<div data-aos="fade-up" class="flex gap-3 w-full max-w-full">
  {#if c.url}
  <a href={c.url} target="_blank" class="w-10 h-10">
    <img src={avatarUrl} alt="avatar" class="w-10 h-10"/>
  </a>
  {:else}
  <img src={avatarUrl} alt="avatar" class="w-10 h-10"/>
  {/if}

  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-2">
      <span class="font-semibold text-[var(--text-color)]">{c.author}</span>
      <span class="text-sm text-[var(--text-color-70)]">{formatFullDate(new Date(c.pubDate), language)}</span>
    </div>

    <div class="text-[var(--text-color)] mt-1 leading-relaxed w-full max-w-full min-w-0">
      {#if c.contentHtml && typeof c.contentHtml === 'string' && isValidHtml(c.contentHtml)}
        <div innerHTML={c.contentHtml} class="break-words w-full max-w-full"></div>
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

    <div class="mt-1 flex items-center gap-4 text-sm text-[var(--text-color)]">
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
      <div class="mt-4 pl-4 border-l-2 border-gray-200">
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
            post_url: window.location.href, // 添加当前页面的URL
          });
          replyContent = '';
        }} class="space-y-3">
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label for="reply-author-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.name')}<span class="text-red-500">*</span></label>
              <input id="reply-author-{c.id}" type="text" placeholder={t('comments.required')} bind:value={replyAuthor}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-1" />
            </div>
            <div>
              <label for="reply-email-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.email')}<span class="text-red-500">*</span></label>
              <input id="reply-email-{c.id}" type="email" placeholder={t('comments.required')} bind:value={replyEmail}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-1" />
            </div>
            <div>
              <label for="reply-url-{c.id}" class="block text-xs text-[var(--text-color)] mb-1">{t('comments.site')}</label>
              <input id="reply-url-{c.id}" type="url" placeholder={t('comments.optional')} bind:value={replyUrl}
                class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-1" />
            </div>
          </div>

          <div>
            <textarea placeholder={t('comments.replyPlaceholder') || "写下你的回复..."} 
              class="rounded w-full border text-[var(--text-color)] border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-2 min-h-[80px]"
              bind:value={replyContent}></textarea>
            <div class="text-right text-xs text-[var(--text-color-70)] mt-1">
              <!-- {getWordCount(replyContent).chars} {t('comments.characters')} / {getWordCount(replyContent).words} {t('comments.words')} -->
              {#if !isContentWithinLimit(replyContent)}
                <span class="text-red-500 ml-2">{t('comments.contentTooLong') || '内容超出限制'}</span>
              {/if}
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button type="button" on:click={() => {
              dispatch('cancel');
              replySubmitting = false; // 取消时重置提交状态
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

{#if c.replies && c.replies.length}
  <div class="pl-6 mt-4 border-l border-[var(--text-color)]/50 space-y-4 w-full">
    {#each c.replies as reply}
      <div class="w-full max-w-full overflow-hidden">
        <CommentItem c={reply} {postSlug} {author} {email} {url} {language}
          on:reply={(e) => dispatch('reply', e.detail)} 
          on:cancel={() => dispatch('cancel')}
          on:submit={(e) => dispatch('submit', e.detail)}
          on:delete={(e) => dispatch('delete', e.detail)}
          replyingToId={replyingToId} />
      </div>
    {/each}
  </div>
{/if}
  </div>
</div>