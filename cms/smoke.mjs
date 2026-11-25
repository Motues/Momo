// 冒烟测试：在 jsdom 中真实点击「新建文章」→ 创建 → 编辑 → 实时预览 → 保存 → 删除
// 覆盖：新建弹窗标题 / 自定义分类、空路径自动生成 yyyy/yyyy-mm-dd、el() 只读属性（input.list）、
//       列表批量模式的开关、媒体库图床弹窗 / 外链 Markdown / 大图详情（不执行上传与删除）
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost:5188/',
  pretendToBeVisual: true,
})

const { window } = dom
const setGlobal = (name, value) => {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}
setGlobal('window', window)
setGlobal('document', window.document)
setGlobal('location', window.location)
setGlobal('navigator', window.navigator)
setGlobal('HTMLElement', window.HTMLElement)
setGlobal('HTMLInputElement', window.HTMLInputElement)
setGlobal('HTMLIFrameElement', window.HTMLIFrameElement)
setGlobal('Node', window.Node)
setGlobal('Event', window.Event)
setGlobal('HashChangeEvent', window.HashChangeEvent)
setGlobal('KeyboardEvent', window.KeyboardEvent)
setGlobal('confirm', () => true)
setGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0))
window.confirm = () => true
window.requestAnimationFrame = (cb) => setTimeout(cb, 0)

// 浏览器里相对 URL 由页面 origin 解析；node fetch 需要绝对 URL，这里模拟浏览器行为
const realFetch = globalThis.fetch
setGlobal('fetch', (input, init) => {
  const url = typeof input === 'string' ? new URL(input, window.location.origin).href : input
  return realFetch(url, init)
})

// 在 window 上跑模块（模块内部使用全局 document/window/location）
const { renderList } = await import('./src/pages/ListPage.ts')
const { renderEditor } = await import('./src/pages/EditorPage.ts')

const app = document.getElementById('app')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 模拟 main.ts 的路由渲染：每次先清空 app 再渲染
const render = (fn, ...args) => {
  app.innerHTML = ''
  return fn(app, ...args)
}

async function waitFor(fn, timeout = 8000, interval = 100) {
  const start = Date.now()
  let result
  while (Date.now() - start < timeout) {
    result = await fn()
    if (result) return result
    await sleep(interval)
  }
  return false
}

// 轮询直到文章被删除（GET 返回 404）
async function waitDeleted(path, timeout = 10000) {
  return waitFor(async () => {
    const res = await realFetch('http://localhost:5188/api/articles/' + encodeURI(path))
    return res.status === 404
  }, timeout, 200)
}

// ---------- 1. 列表页渲染 ----------
await render(renderList)
const btnNew = document.getElementById('btn-new')
if (!btnNew) throw new Error('FAIL: 列表页未渲染出「新建文章」按钮')
console.log('PASS: 列表页渲染，新建按钮存在')

// ---------- 1.1 概览页渲染 ----------
const { renderOverview } = await import('./src/pages/OverviewPage.ts')
await render(renderOverview)
const statCards = await waitFor(() => app.querySelectorAll('.stat-card').length >= 4, 8000)
if (!statCards) throw new Error('FAIL: 概览页未渲染统计卡片')
const statText = app.querySelector('.stat-grid').textContent
if (!statText.includes('文章总数') || !statText.includes('正文总字数')) {
  throw new Error('FAIL: 概览页统计卡片内容缺失: ' + statText)
}
console.log('PASS: 概览页渲染，统计卡片数量=' + app.querySelectorAll('.stat-card').length)

// ---------- 1.2 列表页表格 / 卡片视图切换 ----------
await render(renderList)
const viewTable = document.getElementById('view-table')
if (!viewTable) throw new Error('FAIL: 未渲染「表格」视图切换按钮')
viewTable.click()
await sleep(200)
if (!app.querySelector('.article-table')) throw new Error('FAIL: 表格视图未渲染出表格')
console.log('PASS: 表格视图切换成功')
document.getElementById('view-card').click()
await sleep(200)
if (app.querySelector('.article-table')) throw new Error('FAIL: 切回卡片视图后表格未移除')
if (app.querySelector('#article-list').classList.contains('is-table')) throw new Error('FAIL: 卡片视图容器仍带表格样式')
console.log('PASS: 卡片视图切换成功')

// ---------- 2. 点击「新建文章」打开弹窗 ----------
btnNew.click()
await sleep(300)
const titleField = document.getElementById('new-title')
const pathField = document.getElementById('new-path')
const modalSubmit = document.getElementById('modal-submit')
const combo = app.querySelector('.modal .cms-combo')
const comboInput = combo?.querySelector('.cms-combo-input')
if (!titleField || !pathField || !modalSubmit || !comboInput) {
  throw new Error('FAIL: 新建弹窗字段缺失（标题 / 路径 / 可输入分类下拉）')
}
console.log('PASS: 点击新建文章，弹窗打开且标题 / 路径 / 分类下拉齐全')

// ---------- 2.1 分类：输入自定义分类 → 出现「使用「xxx」」→ 点击采用 ----------
comboInput.value = '冒烟分类'
comboInput.dispatchEvent(new window.Event('input', { bubbles: true }))
await sleep(60)
const createRow = document.querySelector('.cms-select-panel .cms-select-option.is-create')
if (!createRow || !createRow.textContent.includes('冒烟分类')) {
  throw new Error('FAIL: 输入自定义分类后未出现「使用当前输入」选项')
}
createRow.click()
await sleep(30)
if (comboInput.value !== '冒烟分类') throw new Error('FAIL: 采用自定义分类后未回填输入框')
if (document.querySelector('.cms-select-panel')) throw new Error('FAIL: 采用分类后下拉面板未收起')
console.log('PASS: 分类下拉支持自定义分类')

// ---------- 3. 填写标题 / 路径并创建 ----------
titleField.value = '冒烟测试文章'
pathField.value = 'smoke-test-post'
modalSubmit.click()

// 等待跳转（api.create 完成）
const navigated = await waitFor(() => location.hash.startsWith('#/edit/'), 10000)
if (!navigated) throw new Error('FAIL: 创建后未跳转到编辑页 (hash=' + location.hash + ')')
console.log('PASS: 创建成功并跳转编辑页 →', location.hash)

// ---------- 4. 编辑器渲染 + 预览 ----------
const path = decodeURIComponent(location.hash.replace(/^#\/edit\//, ''))
await render(renderEditor, path)
await sleep(500)
const titleInput = document.getElementById('f-title')
const mdEditor = document.getElementById('md-editor')
const frame = document.getElementById('preview-frame')
if (!titleInput || !mdEditor || !frame) throw new Error('FAIL: 编辑器页面元素缺失')
if (titleInput.value !== '冒烟测试文章') {
  throw new Error('FAIL: 新建弹窗的标题未写入 frontmatter，实际为 ' + titleInput.value)
}
const catField = document.getElementById('f-category')
if (!catField || catField.value !== '冒烟分类') {
  throw new Error('FAIL: 新建弹窗的分类未写入 frontmatter，实际为 ' + (catField && catField.value))
}
console.log('PASS: 编辑器渲染（表单 + textarea + 预览 iframe），标题 / 分类已写入')

// 等待首次预览渲染
const previewOk = await waitFor(() => frame.srcdoc && frame.srcdoc.length > 200, 15000)
if (!previewOk) throw new Error('FAIL: 预览未渲染')
console.log('PASS: 实时预览已渲染, srcdoc len=' + frame.srcdoc.length)

// ---------- 5. 修改正文 → 防抖预览 ----------
mdEditor.value = '# 冒烟测试\n\n::note[hello]\n\n$E=mc^2$'
mdEditor.dispatchEvent(new window.Event('input', { bubbles: true }))
const preview2 = await waitFor(() => frame.srcdoc.includes('admonition-title'), 15000)
if (!preview2) throw new Error('FAIL: 编辑后预览未更新（含 note 组件）')
console.log('PASS: 编辑正文后实时预览更新（Alert 组件渲染成功）')

// ---------- 6. 保存 ----------
const saveBtn = document.getElementById('btn-save')
saveBtn.click()
await sleep(1200)
const dirtyBadge = document.getElementById('dirty-badge')
console.log('PASS: 保存完成, dirty=' + (!dirtyBadge || dirtyBadge.hidden))

// ---------- 7. 清理测试文章 ----------
const delBtn = document.querySelector('.btn-danger')
const smokePath = 'smoke-test-post'
delBtn.click()
const smokeDeleted = await waitDeleted(smokePath)
if (!smokeDeleted) throw new Error('FAIL: smoke-test-post 删除未完成')
console.log('PASS: 删除完成, hash=' + location.hash)

// ---------- 8. 空路径新建 → 自动生成 yyyy/yyyy-mm-dd ----------
await render(renderList)
await sleep(300)
document.getElementById('btn-new').click()
await sleep(200)
document.getElementById('new-title').value = '自动路径文章'
document.getElementById('new-path').value = '' // 路径留空
document.getElementById('modal-submit').click()
const autoPath = await waitFor(() => {
  const m = location.hash.match(/^#\/edit\/(\d{4})\/(\d{4}-\d{2}-\d{2})$/)
  return m ? m[1] + '/' + m[2] : null
}, 10000)
if (!autoPath) throw new Error('FAIL: 空路径未自动生成日期路径 (hash=' + location.hash + ')')
console.log('PASS: 空路径自动生成 → #/edit/' + autoPath)

// 清理自动生成的文章
const autoPathStr = decodeURIComponent(location.hash.replace(/^#\/edit\//, ''))
await render(renderEditor, autoPathStr)
await sleep(500)
document.querySelector('.btn-danger').click()
const autoDeleted = await waitDeleted(autoPathStr)
if (!autoDeleted) throw new Error('FAIL: 自动生成文章删除未完成: ' + autoPathStr)
console.log('PASS: 自动生成文章已删除 (' + autoPathStr + ')')

// ---------- 9. 列表批量模式：默认隐藏，点按钮才出现多选框与操作条 ----------
await render(renderList)
const batchToggle = await waitFor(() => document.getElementById('batch-toggle'))
const batchBar = document.getElementById('batch-bar')
if (!batchToggle || !batchBar) throw new Error('FAIL: 批量操作按钮/操作条缺失')
if (batchBar.hidden !== true) throw new Error('FAIL: 批量操作条默认应隐藏')
if (app.querySelectorAll('.card-check').length) throw new Error('FAIL: 默认不应出现卡片多选框')
batchToggle.click()
await sleep(150)
if (batchBar.hidden !== false) throw new Error('FAIL: 开启批量模式后操作条应显示')
if (!app.querySelectorAll('.card-check').length) throw new Error('FAIL: 开启批量模式后卡片应出现多选框')
batchToggle.click()
await sleep(150)
if (batchBar.hidden !== true || app.querySelectorAll('.card-check').length) {
  throw new Error('FAIL: 退出批量模式后应恢复默认')
}
console.log('PASS: 批量模式默认关闭，开关切换正常')

// ---------- 10. 媒体库：列表渲染 + 图床弹窗 / 大图开关（不执行上传与删除） ----------
const { renderMedia } = await import('./src/pages/MediaPage.ts')
await render(renderMedia)
const mediaCards = await waitFor(() => app.querySelectorAll('.media-card').length, 15000)
if (!mediaCards) throw new Error('FAIL: 媒体库未渲染图片卡片')
if (app.querySelectorAll('.media-check').length) throw new Error('FAIL: 媒体库默认不应出现多选框')
if (app.querySelectorAll('.media-card .media-act').length) throw new Error('FAIL: 卡片上不应直接放操作按钮')
document.getElementById('media-upload').click()
const uploadDialog = await waitFor(() => app.querySelector('.media-upload-dialog'), 5000)
if (!uploadDialog || !app.querySelector('.media-dropzone')) throw new Error('FAIL: 图床上传弹窗未打开')
if (!app.querySelector('.media-quality-range')) throw new Error('FAIL: 上传弹窗缺少压缩质量滑块')
if (!app.querySelector('.media-estimate-summary')) throw new Error('FAIL: 上传弹窗缺少预估大小区域')
console.log('PASS: 图床上传弹窗打开，含拖拽区、目标选择与压缩质量')
const feedInputs = app.querySelectorAll('.media-external-row .input')
app.querySelector('.media-external summary').click()
feedInputs[0].value = 'https://example.com/a.png'
feedInputs[1].value = '回归测试'
app.querySelector('.media-external-row .btn').click()
await sleep(100)
const md = app.querySelector('.media-result-md')?.textContent || ''
if (md !== '![回归测试](https://example.com/a.png)') throw new Error('FAIL: 外链 Markdown 生成错误: ' + md)
console.log('PASS: 外链生成 Markdown 片段')
closeDialog()
await sleep(100)
if (app.querySelector('.media-upload-dialog')) throw new Error('FAIL: 上传弹窗未关闭')

document.getElementById('media-batch-toggle').click()
await sleep(100)
document.getElementById('media-batch-toggle').click()
await sleep(100)
app.querySelector('.media-card .media-thumb').click()
if (!(await waitFor(() => app.querySelector('.media-lightbox'), 5000))) throw new Error('FAIL: 大图详情未打开')
const detailActions = [...app.querySelectorAll('.media-detail-actions .btn')].map((b) => b.textContent)
for (const label of ['复制 Markdown', '复制 alt', '替换图片', '移动到…', '重命名', '删除']) {
  if (!detailActions.includes(label)) throw new Error('FAIL: 详情缺少操作「' + label + '」')
}
app.querySelector('.media-lightbox-close').click()
await sleep(100)
if (app.querySelector('.media-lightbox')) throw new Error('FAIL: 大图详情未关闭')
console.log('PASS: 媒体库多选开关、详情操作与大图开关正常')

// ---------- 11. 编辑器：从媒体库插入图片 ----------
await render(renderEditor, 'markdown')
const editorMd = await waitFor(() => document.getElementById('md-editor'), 10000)
if (!editorMd) throw new Error('FAIL: 编辑器未渲染')
document.getElementById('tool-media').click()
if (!(await waitFor(() => app.querySelector('.media-picker-dialog'), 5000))) {
  throw new Error('FAIL: 编辑器媒体库选图弹窗未打开')
}
if (!(await waitFor(() => app.querySelector('.picker-item'), 15000))) {
  throw new Error('FAIL: 选图弹窗没有列出本文图片')
}
app.querySelector('.media-picker-dialog .media-lightbox-close').click()
await sleep(100)
if (app.querySelector('.media-picker-dialog')) throw new Error('FAIL: 选图弹窗未关闭')
console.log('PASS: 编辑器可从媒体库选图')

function closeDialog() {
  const btns = [...app.querySelectorAll('.media-upload-dialog .modal-actions .btn')]
  const close = btns.find((b) => b.textContent === '关闭')
  close?.click()
}

console.log('\n=== 冒烟测试全部通过 ===')
process.exit(0)
