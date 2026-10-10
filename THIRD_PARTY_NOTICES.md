# 第三方组件声明

本项目（`@motues/momo`）以 MIT 许可证发布，但下列第三方组件以其它许可证分发。

## HashWX

| 项目 | 值 |
|---|---|
| 组件 | HashWX（`hashwx.wasm`） |
| 上游 | https://github.com/tevador/hashwx |
| 版本 | v1.0.0（commit `74b567a31276a4c5d7cb232a5b7639467f49f961`） |
| 许可证 | **LGPL-3.0** |
| 许可证全文 | [`vendor/hashwx/hashwx-LICENSE.txt`](./src/components/comment/verify/vendor/hashwx/hashwx-LICENSE.txt) |
| 构件 sha256 | `b1a0dbb3ef444d3c7069e0a5e0a0273ffa4cf8fef62cbbe43761c02f7cd6aff5` |
| 用途 | 评论人机验证的第一层工作量证明（Proof of Work） |

选材与验证细节见 [`vendor/hashwx/README.md`](./src/components/comment/verify/vendor/hashwx/README.md)。

本站是 Astro 构建，wasm 由同级 ../hashwxWasm.ts base64 内联，本目录仅作来源与合规存档；并说明替换流程（在 Momo-Backend 侧重新生成后整块拷贝）
