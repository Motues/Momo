/**
 * 评论区头像相关的前端常量。
 *
 * 默认头像与三端后端实现、`doc/vectors/avatar-v1.json` 的 `defaultAvatarUrl` 逐字一致：
 * `avatar_enabled = false` 时服务端下发的就是它；这里只用于**图片加载失败**（自定义源挂掉、
 * Gravatar 不可达）时的兜底，避免评论区出现破图。
 */
export const DEFAULT_AVATAR_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIzMiIgZmlsbD0iI2U1ZTdlYiIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMjQiIHI9IjExIiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTEzIDU3YzAtMTAuNSA4LjUtMTkgMTktMTlzMTkgOC41IDE5IDE5IiBmaWxsPSIjOWNhM2FmIi8+PC9zdmc+';
