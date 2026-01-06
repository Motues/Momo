---
title: 测试 Alert
pubDate: 2025-09-18
description: 文章功能测试
image: ""
draft: false
slugId: momo/test/alert
---

## Alert 组件测试

### 单行内容测试

:::note
这是一个提示。
:::

:::tip
这是一个建议。
:::

:::important
这是一个重要事项。
:::

:::warning
这是一个警告。
:::

:::caution
这是一个危险事项。
:::


### 多行内容测试

:::tip
这是一个包含多行内容的提示框。

- 支持列表项
- 可以包含多个段落

**重点内容**：还可以包含粗体文字和其他 Markdown 元素。
:::

### 嵌套内容测试

:::warning
提示框内可以包含代码块等其他元素。

```javascript
console.log('Hello World');
```
:::

### 自定义标题测试

:::important[自定义标题]
这是一个带有自定义标题的提示框。标题会显示为"自定义标题"而不是默认的"IMPORTANT"。
:::