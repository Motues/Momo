<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { siteConfig } from '@/config.ts';
  import CommentItem from './CommentItem.svelte';
  import EmojiPicker from './emoji/EmojiPicker.svelte';
  import { getCachedEmojiSet, loadEmojiSet, revalidateEmojiSet, emojiCacheNeedsRevalidation, containsShortcode, type EmojiSet } from './emoji/owo';
  import { emojify } from './emoji/render';
  import SilentVerify from './verify/SilentVerify.svelte';
  import i18nit from '../../i18n/translation.ts';
  import { parseMarkdown, validateMarkdown } from '@utils/markdown';
  import DOMPurify from 'dompurify';
  import { notify } from '@utils/notify';

  export let postSlug: string;
  export let language: string = 'zh-cn';
  export let postTitle: string;

  const t = i18nit(language);

  const apiUrl = siteConfig.comments.backendUrl;

  let comments: any[] = [];
  let loading = true;
  let loadingMore = false;
  let error = '';
  let page = 1;
  let limit = 20;
  let hasMore = false;

  let bloggerBadgeEnabled = false;
  let bloggerBadgeText = '';
  let placeholderName = '';
  let placeholderEmail = '';
  let placeholderContent = '';
  let placeholderUrl = '';
  let adminCommentKeyConfigured = false;
  let adminEmailHashes: string[] = [];
  let emojiEnabled = true;
  let emojiCdnUrls: string[] = [];
  let emojiSet: EmojiSet | null = null;
  let adminKey = '';
  let isAdminEmail = false;

  // 无感验证（Turnstile 风格）：由后端 verify_enabled 决定是否渲染
  let verifyEnabled = false;
  let verifyHoneypot = '';
  let verifyTicket: string | null = null;
  let verifyComponent: SilentVerify;

  /** 把后端下发的字符串开关解析为布尔值 */
  function parseBool(value: any): boolean {
    return value === true || value === 'true';
  }

  $: if (email && adminEmailHashes.length > 0) {
    sha256(email).then(hash => { isAdminEmail = adminEmailHashes.includes(hash); });
  } else {
    isAdminEmail = false;
  }

  /** 管理员邮箱哈希列表：优先 `admin_email_hashes`，缺失/为空时回落旧字段 `admin_email_hash` */
  function resolveAdminEmailHashes(data: any): string[] {
    const list = data?.admin_email_hashes;
    if (Array.isArray(list)) {
      const hashes = list.filter((hash) => typeof hash === 'string' && hash !== '');
      if (hashes.length > 0) return hashes;
    }
    const legacy = data?.admin_email_hash;
    return typeof legacy === 'string' && legacy !== '' ? [legacy] : [];
  }

  /** 表情来源地址列表：优先 `emoji_cdn_urls`，缺失/为空时回落旧字段 `emoji_cdn_url` */
  function resolveEmojiCdnUrls(data: any): string[] {
    const list = data?.emoji_cdn_urls;
    if (Array.isArray(list)) {
      const urls = list
        .filter((url) => typeof url === 'string')
        .map((url) => url.trim())
        .filter((url) => url !== '');
      if (urls.length > 0) return urls;
    }
    const legacy = data?.emoji_cdn_url;
    return typeof legacy === 'string' && legacy.trim() !== '' ? [legacy.trim()] : [];
  }

  let author = '';
  let email = '';
  let url = '';
  let content = '';

  let submitting = false;
  let contentEl: HTMLTextAreaElement | undefined;

  let replyingToId: number | null = null;
  let replySubmittingId: number | null = null;

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

  async function sha256(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str.toLowerCase().trim());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const STORAGE_KEY = 'comment_user_info';
  const STORAGE_KEY_DRAFT = 'momo_comment_draft';
  let loaded = false;

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

  function saveUserInfoToStorage() {
    try {
      const userInfo = { author, email, url };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    } catch (e) {
      console.warn('Failed to save user info to localStorage:', e);
    }
  }

  /** 清除草稿：存储被禁用时忽略异常 */
  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY_DRAFT);
    } catch (e) {
      console.warn('Failed to clear draft from localStorage:', e);
    }
  }

  $: if (loaded) {
    // ⚠️ 存储被禁用时 setItem 会抛错，必须吞掉，否则异常会中断本次渲染
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ author, email, url }));
      if (content) {
        localStorage.setItem(STORAGE_KEY_DRAFT, content);
      } else {
        localStorage.removeItem(STORAGE_KEY_DRAFT);
      }
    } catch (e) {
      console.warn('Failed to persist comment draft:', e);
    }
  }

  function getWordCount(text: string): { chars: number; words: number } {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { chars, words };
  }

  function isContentWithinLimit(text: string): boolean {
    const { chars, words } = getWordCount(text);
    return chars <= 2000 && words <= 1000;
  }

   /** 表情是否可用：后端关闭表情或地址列表为空都算不可用；必须用普通函数读取（`$:` 批量刷新） */
  function emojiUsable(enabled: boolean, cdnUrls: string[]): boolean {
    return enabled && cdnUrls.length > 0;
  }

  $: emojiAvailable = emojiUsable(emojiEnabled, emojiCdnUrls);

  /** 短代码 → 图片地址；表情不可用时为 null */
  $: emojiImages = emojiAvailable ? emojiSet?.images ?? null : null;

   /** 首屏水合（第一层）：同步、零请求，只读本地缓存（7 天可用期，键为整个地址列表的 JSON） */
  function refreshEmojiHydration() {
    emojiSet = emojiUsable(emojiEnabled, emojiCdnUrls) ? getCachedEmojiSet({ cdnUrls: emojiCdnUrls }) : null;
  }

  /** 本页已经安排过刷新的地址列表（JSON）：翻页/加载更多时不重复触发 */
  let emojiRefreshKey = '';

  /** 评论树里是否真的出现了 `:name:` 短代码：没有就不为首屏拉第三方 owo.json */
  function commentsUseShortcode(list: any[]): boolean {
    for (const item of list || []) {
      if (
        containsShortcode(String(item?.contentHtml ?? '')) ||
        containsShortcode(String(item?.contentText ?? ''))
      ) {
        return true;
      }
      if (Array.isArray(item?.replies) && item.replies.length > 0 && commentsUseShortcode(item.replies)) {
        return true;
      }
    }
    return false;
  }

   /** 首屏水合（第二层）：缓存缺失时空闲拉取，命中缓存但到点（6 小时）时静默校验；正文没有短代码时什么都不做。
    * 与表情面板共用 loadEmojiSet / revalidateEmojiSet 的缓存与并发去重。 */
  function scheduleEmojiPrefetch() {
    if (!emojiUsable(emojiEnabled, emojiCdnUrls)) return;
    if (!commentsUseShortcode(comments)) return;

    const key = JSON.stringify(emojiCdnUrls);
    if (emojiRefreshKey === key) return;

    const mode: 'load' | 'revalidate' | null =
      (emojiSet?.images.size ?? 0) > 0
        ? emojiCacheNeedsRevalidation({ cdnUrls: emojiCdnUrls })
          ? 'revalidate'
          : null
        : 'load';
    if (!mode) return;
    emojiRefreshKey = key;

    const run = () => {
      if (!emojiUsable(emojiEnabled, emojiCdnUrls)) return;
      if (mode === 'load') {
        loadEmojiSet({ cdnUrls: emojiCdnUrls })
          .then((set) => {
            // 面板可能已打开：只接受图片数不少于当前的结果
            if (set.images.size >= (emojiSet?.images.size ?? 0)) emojiSet = set;
          })
          .catch(() => {
            /* 静默失败：面板打开时会重试 */
          });
        return;
      }
      revalidateEmojiSet({ cdnUrls: emojiCdnUrls })
        .then((next) => {
          // null = 内容没变或部分来源失败：保持当前界面
          if (next) emojiSet = next;
        })
        .catch(() => {
          /* 静默失败：下次到点或打开面板时再试 */
        });
    };

    // 放到首屏空闲时段，避免和评论首屏 / LCP 抢带宽
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      window.setTimeout(run, 200);
    }
  }

  function countComments(comments: any[]): number {
    let count = 0;
    for (const c of comments) {
      count += 1;
      if (c.replies && c.replies.length > 0) {
        count += countComments(c.replies);
      }
    }
    return count;
  }

  /** 把加载异常翻译成单一语言的提示文案 */
  function describeLoadError(err: any): string {
    const status = typeof err?.status === 'number' ? err.status : null;
    // 状态码是协议标识（各语言都原样保留），文案部分始终取自当前语言
    if (status !== null) return `${t('comments.loadFailed')} (HTTP ${status})`;
    return t('comments.networkError');
  }

  /** 拉取评论：成功后推进 page（失败可重试）；silent 时不切换 loading 状态，仅在成功后替换列表 */
  async function loadComments(loadMore = false, targetPage: number = page, silent = false): Promise<boolean> {
    const showLoading = !silent;
    if (loadMore) {
      loadingMore = true;
    } else if (showLoading) {
      loading = true;
    }
    try {
      const res = await fetch(
        `${apiUrl}/api/comments?post_slug=${encodeURIComponent(postSlug)}&nested=true&page=${targetPage}&limit=${limit}`
      );
      // 只抛出 HTTP 状态，文案交给 describeLoadError
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const data = await res.json();
      const newComments = data?.data?.comments || [];
      if (targetPage === 1) {
        comments = newComments;
      } else {
        comments = [...comments, ...newComments];
      }
      hasMore = (data?.data?.pagination?.totalPage || 0) > targetPage;
      bloggerBadgeEnabled = data?.data?.blogger_badge_enabled === 'true';
      bloggerBadgeText = data?.data?.blogger_badge_text || '';
      placeholderName = data?.data?.placeholder_name || '';
      placeholderEmail = data?.data?.placeholder_email || '';
      placeholderContent = data?.data?.placeholder_content || '';
      placeholderUrl = data?.data?.placeholder_url || '';
      adminCommentKeyConfigured = data?.data?.admin_comment_key_configured === 'true';
      adminEmailHashes = resolveAdminEmailHashes(data?.data);
      emojiEnabled = data?.data?.emoji_enabled !== 'false';
      emojiCdnUrls = resolveEmojiCdnUrls(data?.data);
      if (!adminCommentKeyConfigured) adminKey = '';
      verifyEnabled = parseBool(data?.data?.verify_enabled);
      verifyHoneypot = data?.data?.verify_honeypot || '';
      // ⚠️ 成功后必须重置错误态，否则一次失败后评论区本次会话内不再显示
      error = '';
      page = targetPage;
      refreshEmojiHydration();
      scheduleEmojiPrefetch();
      return true;
    } catch (err: any) {
      // 静默刷新失败时保留列表与错误态；文案只取当前语言，不拼浏览器英文原文
      if (!silent) error = describeLoadError(err);
      return false;
    } finally {
      if (loadMore) {
        loadingMore = false;
      } else if (showLoading) {
        loading = false;
      }
    }
  }

  /** 加载下一页：只有请求成功才推进页码 */
  async function loadMoreComments() {
    if (loadingMore) return;
    await loadComments(true, page + 1);
  }

  async function submitComment(parentId: number | null = null, replyData: any = null) {
    if (submitting) return;
    
    let submitAuthor, submitEmail, submitUrl, submitContent, submitAdminKey;
    
    if (replyData) {
      submitAuthor = replyData.author;
      submitEmail = replyData.email;
      submitUrl = replyData.url;
      submitContent = replyData.content;
      submitAdminKey = replyData.admin_key;
    } else {
      submitAuthor = author;
      submitEmail = email;
      submitUrl = url;
      submitContent = content;
      submitAdminKey = adminKey;
    }

    if (!submitAuthor || !submitEmail || !submitContent) {
      notify(t('comments.fillRequired') || '请填写昵称、邮箱和评论内容');
      return;
    }

    if (!isContentWithinLimit(submitContent)) {
      notify(t('comments.contentTooLong') || '评论内容超出限制：不超过2000汉字或1000单词');
      return;
    }

    // 顶层评论用 submitting，回复用 replySubmittingId（由父组件统一管理，避免按钮永久禁用）
    if (!parentId) {
      submitting = true;
    } else {
      replySubmittingId = parentId;
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
          post_url: window.location.href,
          post_title: postTitle,
          admin_key: submitAdminKey || undefined,
          verify_ticket: verifyTicket || undefined,
        }),
      });
      const data = await res.json().catch(() => null);

      // 验证票据失效：重置状态并让验证框重新验证（不清空输入）
      if (res.status === 403 && (data?.reason === 'VERIFY_REQUIRED' || data?.code === 'VERIFY_REQUIRED')) {
        verifyTicket = null;
        verifyComponent?.retry();
        notify(t('comments.verifyFailed') + '，' + t('comments.verifyRetry'));
        return;
      }

      // 只有真正提交成功才清空输入框；失败时保留已输入内容
      const succeeded = res.ok && (data?.code === undefined || data.code === 200);
      if (!succeeded) {
        notify(data?.message || t('comments.submitFailed'));
        return;
      }

      if (!replyData) {
        content = '';
        previewHtml = '';
        markdownWarnings = [];
        showPreview = false;
        clearDraft();
        saveUserInfoToStorage();
      }
      replyingToId = null;

      if (data?.message && data.message.includes('Verification email sent')) {
        notify(t('comments.submitSuccess') + ' ' + t('comments.verificationRequired'));
      } else {
        notify(data?.message || t('comments.submitSuccess'));
      }
      
      await loadComments(false, 1, true);
    } catch (err) {
      notify(t('comments.submitFailed') || '提交失败，请稍后再试');
    } finally {
      if (!parentId) {
        submitting = false;
      } else if (replySubmittingId === parentId) {
        replySubmittingId = null;
      }
    }
  }

  /** 在光标处插入表情（没有输入框时追加到末尾），并保持焦点与光标位置 */
  async function insertEmoji(text: string) {
    const el = contentEl;
    if (!el) {
      content += text;
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? start;
    content = `${content.slice(0, start)}${text}${content.slice(end)}`;
    await tick();
    const position = start + text.length;
    el.focus();
    el.setSelectionRange(position, position);
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

<div class="comment-container mt-4 max-w-3xl mx-auto border-t border-[var(--button-border-color)]" id="comments">
  <div data-reveal="rise" class="mt-4">
    <form on:submit|preventDefault={() => submitComment()} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="">
          <label for="author" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.name')}<span class="text-red-500">*</span></label>
          <input id="author" type="text" placeholder={placeholderName || t('comments.required')} bind:value={author}
            class="rounded-[var(--momo-radius-sm)] w-full text-[var(--text-color)] border border-[var(--button-border-color)]  focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
        </div>
        <div class="">
          <label for="email" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.email')}<span class="text-red-500">*</span></label>
          <input id="email" type="email" placeholder={placeholderEmail || t('comments.required')} bind:value={email}
            class="rounded-[var(--momo-radius-sm)] w-full text-[var(--text-color)] border border-[var(--button-border-color)]  focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
        </div>
        <div class="">
          <label for="url" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.site')}</label>
          <input id="url" type="url" placeholder={placeholderUrl || t('comments.optional')} bind:value={url}
            class="rounded-[var(--momo-radius-sm)] w-full text-[var(--text-color)] border border-[var(--button-border-color)]  focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
        </div>

        {#if adminCommentKeyConfigured && isAdminEmail}
          <div>
            <label for="admin-key" class="block text-sm text-[var(--text-color)] mb-1">{t('comments.adminKey')}<span class="text-red-500">*</span></label>
            <input id="admin-key" type="password" placeholder={t('comments.adminKeyPlaceholder')} bind:value={adminKey}
              class="rounded-[var(--momo-radius-sm)] w-full text-[var(--text-color)] border border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-2" />
          </div>
        {/if}
      </div>

       <div class="mb-2">
        {#if showPreview}
          <div
            class="rounded-[var(--momo-radius-sm)] border text-[var(--text-color)] border-[var(--button-border-color)] p-3 min-h-[100px] text-sm leading-relaxed comment-preview"
            use:emojify={{ images: emojiImages, html: content }}>
            {#if content.trim() === ''}
              <p>{t('comments.preview') || '预览'}</p>
            {:else}
              <div>{@html DOMPurify.sanitize(previewHtml)}</div>
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
          <textarea placeholder={placeholderContent || t('comments.welcome')}
            class="rounded-[var(--momo-radius-sm)] w-full border text-[var(--text-color)] border-[var(--button-border-color)] focus:outline-none focus:border-[var(--link-color)] text-sm p-3 min-h-[100px]"
            bind:this={contentEl}
            bind:value={content}></textarea>
        {/if}

        <div class="text-right text-sm text-[var(--text-color)]/70 mt-1">
          {#if !isContentWithinLimit(content)}
            <span class="text-red-500 ml-2">{t('comments.contentTooLong') || '内容超出限制'}</span>
          {/if}
        </div>
      </div>

      <div class="relative flex flex-wrap justify-between items-center gap-3">
        <!-- 表情按钮：后端关闭表情或地址列表为空时不渲染 -->
        {#if emojiAvailable}
          <EmojiPicker {language} cdnUrls={emojiCdnUrls} disabled={showPreview}
            bind:emojiSet onPick={insertEmoji} />
        {/if}

        <div class="ml-auto flex flex-wrap items-center justify-end gap-3">
          {#if verifyEnabled}
            <SilentVerify
              bind:this={verifyComponent}
              {apiUrl}
              {postSlug}
              {language}
              honeypotField={verifyHoneypot}
              onTicket={(ticket) => (verifyTicket = ticket)}
            />
          {/if}
          <button
            type="button"
            on:click={togglePreview}
            disabled={!showPreview && !content.trim()}
            class="rounded-[var(--momo-radius-sm)] px-4 py-2 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-bg-color)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showPreview ? t('comments.write') : t('comments.preview')}
          </button>
          <button type="submit" disabled={submitting || !isContentWithinLimit(content) || (verifyEnabled && verifyTicket === null)}
            class="rounded-[var(--momo-radius-sm)] px-4 py-2 text-sm font-medium text-[var(--text-color)] border border-[var(--button-border-color)] hover:bg-[var(--button-hover-bg-color)] disabled:opacity-50">
            {submitting ? t('comments.sending') : t('comments.send')}
          </button>
        </div>
      </div>
    </form>
  </div>

  <div class="" id="comments-content">
    {#if !loadingMore && loading}
      <div data-reveal="rise" data-test="comments-loading"
        class="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <svg class="animate-spin h-6 w-6 text-[var(--text-color)]/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-sm text-[var(--text-color)]/80">{t('comments.loading') || '正在加载评论...'}</p>
      </div>
    {:else if error}
      <div data-reveal="rise" data-test="comments-error"
        class="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <p class="text-sm text-red-500" data-test="comments-error-text">{error}</p>
      </div>
    {:else}
      <h4 data-reveal="rise" class="text-[var(--text-color)] text-base font-semibold mt-6 mb-4">{countComments(comments)} {t('comments.comments')}</h4>

      <div class="space-y-6">
        {#each comments as c}
          <!-- 入场交给 CommentItem 自己的 data-reveal，这里不要再套 in:fly（两段动画会叠加） -->
          <CommentItem {c} {postSlug} {author} {email} {url} {language} {apiUrl}
            {bloggerBadgeEnabled} {bloggerBadgeText} {adminCommentKeyConfigured} {adminEmailHashes}
            emojiImages={emojiImages} {emojiCdnUrls} {emojiEnabled}
            on:emojiSetChange={(e) => (emojiSet = e.detail)}
            on:reply={(e) => setReplyingTo(e.detail)}
            on:cancel={() => setReplyingTo(null)}
            on:submit={async (e) => {
              await submitComment(e.detail.parentId, e.detail);
            }}
            replyingToId={replyingToId}
            replySubmittingId={replySubmittingId}
            on:userInfoChange={(e) => {
              author = e.detail.author;
              email = e.detail.email;
              url = e.detail.url;
            }} />
        {/each}
      </div>

      {#if hasMore}
        <div class="flex justify-center mt-8">
          <button on:click={loadMoreComments}
            disabled={loadingMore}
            class="rounded-[var(--momo-radius-sm)] px-6 py-2.5 w-full text-sm font-medium text-[var(--text-color)] bg-transparent hover:bg-[var(--button-hover-color)] active:bg-[var(--button-hover-color)] transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {#if loadingMore}
              <svg class="animate-spin h-4 w-4 text-[var(--text-color)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            {loadingMore ? (t('comments.loading') || '加载中...') : (t('comments.loadMore') || '加载更多')}
          </button>
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
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
    border-radius: 4px;
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
    font-size: 0.85rem;
  }
  .comment-preview :global(code) {
    background: color-mix(in srgb, var(--text-color) 6%, transparent);
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
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
  }
  .comment-preview :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }
</style>