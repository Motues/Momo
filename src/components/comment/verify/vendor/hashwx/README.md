# HashWX vendored 资产（前端）

本目录保存第一层工作量证明所用的 HashWX WebAssembly 模块。**该模块不是本项目编写的代码**，
其许可证（LGPL-3.0）与本项目（MIT）不同，请勿删除许可证文本。

## 上游来源

| 项目 | 值 |
|---|---|
| 上游仓库 | https://github.com/tevador/hashwx |
| 上游版本 | v1.0.0（tag 指向 commit `74b567a31276a4c5d7cb232a5b7639467f49f961`） |
| 许可证 | **LGPL-3.0**（完整文本见 `hashwx-LICENSE.txt`） |
| 构件体积 | 12,541 字节 |
| 构件 sha256 | `b1a0dbb3ef444d3c7069e0a5e0a0273ffa4cf8fef62cbbe43761c02f7cd6aff5` |
| 构建方式 | 上游 Emscripten 构建，WebAssembly 1.0（MVP） |

### 构件链说明

上游仓库与 v1.0.0 release **不提供预编译的 `hashwx.wasm`**，只提供 C 源码。
本目录的二进制取自同为 WebAssembly 用途的 Cap 项目（`tiagozip/cap`，Apache-2.0）的
`core/vendor/hashwx.wasm`，其 `core/vendor/hashwx-COMMIT.txt` 固定的上游 commit 与本目录一致，
即该二进制同样构建自 tevador/hashwx v1.0.0。

因为本仓库没有 Emscripten 工具链、无法独立重建，所以**二进制真实性由已知答案测试（KAT）保证**：
`tests/hashwx.test.js` 用上游 `src/tests.c` 的官方向量校验（4 个向量必须全部吻合），
并交叉校验 compiled 与 interpreted 两种模式结果一致。

## 许可证注意事项

- HashWX 的 wasm 二进制以 **LGPL-3.0** 分发，本项目通过 base64 内联进 JS 产物。
- tevador 官方提供的浏览器 glue `js/hashwx.js` 由作者声明为**公有领域**；
  本项目按其机制自行实现了 compiled 模式的驱动逻辑（`src/verify/hashwxCore.ts`），不引入额外许可义务。
- 本站是 Astro 构建，wasm 由同级 ../hashwxWasm.ts base64 内联，本目录仅作来源与合规存档
