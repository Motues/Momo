<script lang="ts">
  import { onMount } from 'svelte';
  import { siteConfig } from '@/config.ts';
  import CommentItem from './CommentItem.svelte';
  import i18nit from '../../i18n/translation.ts';
  import { parseMarkdown, validateMarkdown } from '@utils/markdown';


  export let postSlug: string;
  export let language: string = 'zh-cn';
  export let postTitle: string;

  const t = i18nit(language);

  const apiUrl = siteConfig.comments.backendUrl;

  let comments: any[] = [];
  let loading = true;
  let error = '';
  let page = 1;
  let limit = 20;
  let hasMore = false;

  // 顶层评论表单数据
  let author = '';
  let email = '';
  let url = '';
  let content = '';

  // 防止重复提交
  let submitting = false;

  // 当前正在回复的评论ID
  let replyingToId: number | null = null;

  let showPreview = false;
  let previewHtml = '';
  let markdownWarnings: string[] = [];

  function togglePreview() {
    if (!showPreview) {
      previewHtml = parseMarkdown(content);
      markdownWarnings = validateMarkdown(content);
    }
    showPreview = !showPreview;
  }

  // 本地存储键名
  const STORAGE_KEY = 'comment_user_info';
  const STORAGE_KEY_DRAFT = 'momo_comment_draft';
  let loaded = false;

  // 从本地存储加载用户信息
  function loadUserInfoFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userInfo = JSON.parse(stored);
        author = userInfo.author || '';
        email = userInfo.email || '';
        url = userInfo.url || '';
      }
    } catch (e) {
      console.warn('Failed to load user info from localStorage:', e);
    }
  }

  // 保存用户信息到本地存储
  function saveUserInfoToStorage() {
    try {
      const userInfo = { author, email, url };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    } catch (e) {
      console.warn('Failed to save user info to localStorage:', e);
    }
  }

  // Auto-save user info and content draft on every change
  $: if (loaded) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ author, email, url }));
    if (content) {
      localStorage.setItem(STORAGE_KEY_DRAFT, content);
    } else {
      localStorage.removeItem(STORAGE_KEY_DRAFT);
    }
  }

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

  async function loadComments() {
    loading = true;
    try {
      const res = await fetch(
        `${apiUrl}/api/comments?post_slug=${encodeURIComponent(postSlug)}&nested=true&page=${page}&limit=${limit}`
      );
      if (!res.ok) throw new Error(t('comments.loadFailed') || '加载失败');
      const data = await res.json();
      comments = data.data.comments;
      hasMore = data.data.pagination.totalPage > page;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function submitComment(parentId: number | null = null, replyData: any = null) {
    // 防止重复提交
    if (submitting) return;
    
    let submitAuthor, submitEmail, submitUrl, submitContent;
    
    if (replyData) {
      // 处理回复评论
      submitAuthor = replyData.author;
      submitEmail = replyData.email;
      submitUrl = replyData.url;
      submitContent = replyData.content;
    } else {
      // 处理顶层评论
      submitAuthor = author;
      submitEmail = email;
      submitUrl = url;
      submitContent = content;
    }

    if (!submitAuthor || !submitEmail || !submitContent) {
      alert(t('comments.fillRequired') || '请填写昵称、邮箱和评论内容');
      return;
    }

    // 检查字数限制
    if (!isContentWithinLimit(submitContent)) {
      alert(t('comments.contentTooLong') || '评论内容超出限制：不超过2000汉字或1000单词');
      return;
    }

    // 只有在提交顶层评论时才设置 submitting 状态
    if (!parentId) {
      submitting = true;
    }
    
    try {
      const res = await fetch(`${apiUrl}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_slug: postSlug,
          author: submitAuthor,
          email: submitEmail,
          url: submitUrl || null,
          content: submitContent,
          parent_id: parentId,
          post_url: window.location.href, // 添加当前页面的URL
          post_title: postTitle,
        }),
      });
      const data = await res.json();
      alert(data.message || t('comments.submitSuccess') || '提交成功');
      
      // 重置表单
      if (!replyData) {
        content = '';
        // 保存用户信息到本地存储
        localStorage.removeItem(STORAGE_KEY_DRAFT);
        saveUserInfoToStorage();
      }
      replyingToId = null;
      
      // 重新加载评论
      await loadComments();
    } catch (err) {
      alert(t('comments.submitFailed') || '提交失败，请稍后再试');
    } finally {
      // 只有在提交顶层评论时才重置 submitting 状态
      if (!parentId) {
        submitting = false;
      }
    }
  }

  // 删除评论后的处理函数
  async function handleCommentDelete(e: CustomEvent) {
    // 重新加载评论以反映删除
    await loadComments();
  }

  function setReplyingTo(id: number | null) {
    replyingToId = id;
  }

  onMount(() => {
    loadUserInfoFromStorage();
    const draft = localStorage.getItem(STORAGE_KEY_DRAFT);
    if (draft) content = draft;
    loaded = true;
    loadComments();
  });
</script>

<div class="mt-4 max-w-3xl mx-auto border-t border-[var(--button-border-color)]" id="comments">
  <!-- <div class="my-6 border border-[var(--text-color)]/70"></div> -->
  <!-- 评论输入 -->
  <div data-aos="fade-up" class="mt-4">
    <form on:submit|preventDefault={() => submitComment()} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="">
          <label for="author" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.name')}<span class="text-red-500">*</span></label>
          <input id="author" type="text" placeholder={t('comments.required')} bind:value={author}
            class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)]  focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
        </div>
        <div class="">
          <label for="email" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.email')}<span class="text-red-500">*</span></label>
          <input id="email" type="email" placeholder={t('comments.required')} bind:value={email}
            class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)]  focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
        </div>
        <div class="">
          <label for="url" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.site')}</label>
          <input id="url" type="url" placeholder={t('comments.optional')} bind:value={url}
            class="rounded w-full text-[var(--text-color)] border border-[var(--button-border-color)]  focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
        </div>
      </div>

       <div>
        {#if showPreview}
          <div class="rounded border text-[var(--text-color)] border-[var(--button-border-color)] p-3 min-h-[100px] text-sm leading-relaxed comment-preview">
            {#if content.trim() === ''}
              <p>{t('comments.preview') || '预览'}</p>
            {:else}
              <div>{@html previewHtml}</div>
            {/if}
          </div>
          {#if markdownWarnings.length > 0}
            <div class="mt-1 text-xs text-amber-500">
              {#each markdownWarnings as warning}
                <p>{warning === 'codeFence' ? (t('comments.codeFence') || '代码块标记 ``` 未闭合') : (t('comments.inlineCode') || '行内代码标记 ` 未闭合')}</p>
              {/each}
            </div>
          {/if}
        {:else}
          <textarea placeholder={t('comments.welcome')}
            class="rounded w-full border text-[var(--text-color)] border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-3 min-h-[100px]"
            bind:value={content}></textarea>
        {/if}

        <div class="text-right text-sm text-[var(--text-color)]/70 mt-1">
          {#if !isContentWithinLimit(content)}
            <span class="text-red-500 ml-2">{t('comments.contentTooLong') || '内容超出限制'}</span>
          {/if}
        </div>
      </div>

      <div class="flex justify-end gap-3">
      <button type="button" on:click={togglePreview}
          class="rounded px-4 py-2 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-bg-color)]">
          {showPreview ? t('comments.write') : t('comments.preview')}
        </button>
        <button type="submit" disabled={submitting || !isContentWithinLimit(content)}
          class="rounded px-4 py-2 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-color)] disabled:opacity-50">
          {submitting ? t('comments.sending') : t('comments.send')}
        </button>
      </div>
    </form>
  </div>

  <!-- 评论区 -->
  <div class="" id="comments-content">
    {#if loading}
      <p data-aos="fade-up" class="text-[var(--text-color)] text-center">{t('comments.loading') || '正在加载评论...'}</p>
    {:else if error}
      <p data-aos="fade-up" class="text-red-500 text-center">{t('comments.loadFailed') || '加载失败：'}{error}</p>
    {:else}
      <h4 data-aos="fade-up" class="text-[var(--text-color)] text-base font-semibold mb-4">{comments.length} {t('comments.comments')}</h4>

      <div class="space-y-6">
        {#each comments as c}
          <CommentItem {c} {postSlug} {author} {email} {url} {language}
            on:reply={(e) => setReplyingTo(e.detail)} 
            on:cancel={() => setReplyingTo(null)}
            on:submit={async (e) => {
              await submitComment(e.detail.parentId, e.detail);
            }}
            on:delete={handleCommentDelete}
            replyingToId={replyingToId}
            on:userInfoChange={(e) => {
              author = e.detail.author;
              email = e.detail.email;
              url = e.detail.url;
            }} />
        {/each}
      </div>

      {#if hasMore}
        <div data-aos="fade-up" class="flex justify-center mt-6">
          <button on:click={() => { page++; loadComments(); }}
            class="text-indigo-600 hover:underline text-sm">{t('comments.loadMore') || '加载更多'}</button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .comment-preview :global(h1),
  .comment-preview :global(h2),
  .comment-preview :global(h3),
  .comment-preview :global(h4) {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .comment-preview :global(h1) { font-size: 1.5rem; }
  .comment-preview :global(h2) { font-size: 1.25rem; }
  .comment-preview :global(h3) { font-size: 1.1rem; }
  .comment-preview :global(p) { margin-bottom: 0.5rem; }
  .comment-preview :global(ul),
  .comment-preview :global(ol) {
    margin-bottom: 0.5rem;
    padding-left: 1.5rem;
  }
  .comment-preview :global(ul) { list-style-type: disc; }
  .comment-preview :global(ol) { list-style-type: decimal; }
  .comment-preview :global(li) { margin-bottom: 0.25rem; }
  .comment-preview :global(blockquote) {
    border-left: 3px solid var(--link-color, #6366f1);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    opacity: 0.85;
  }
  .comment-preview :global(pre) {
    background: rgba(0,0,0,0.08);
    border-radius: 4px;
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
    font-size: 0.85rem;
  }
  .comment-preview :global(code) {
    background: rgba(0,0,0,0.06);
    border-radius: 3px;
    padding: 0.15rem 0.3rem;
    font-size: 0.85rem;
    font-family: monospace;
  }
  .comment-preview :global(pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
  }
  .comment-preview :global(a) {
    color: var(--link-color, #6366f1);
    text-decoration: underline;
  }
  .comment-preview :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.5rem 0;
  }
  .comment-preview :global(hr) {
    border: none;
    border-top: 1px solid var(--button-border-color, #ddd);
    margin: 1rem 0;
  }
  .comment-preview :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  .comment-preview :global(th),
  .comment-preview :global(td) {
    border: 1px solid var(--button-border-color, #ddd);
    padding: 0.4rem 0.6rem;
    text-align: left;
  }
  .comment-preview :global(th) {
    font-weight: 600;
    background: rgba(0,0,0,0.04);
  }
  .comment-preview :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }
</style>