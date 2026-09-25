import './styles.css'
import { parseRoute } from './router'
import { renderOverview } from './pages/OverviewPage'
import { renderList } from './pages/ListPage'
import { renderEditor } from './pages/EditorPage'
import { renderConfig } from './pages/ConfigPage'

interface AppElement extends HTMLElement {
  __cleanup?: () => void
}

const app = document.getElementById('app') as AppElement

async function render() {
  const prev = app
  prev.__cleanup?.()
  prev.__cleanup = undefined
  app.innerHTML = ''
  const route = parseRoute(location.hash)
  if (route.name === 'edit') await renderEditor(app, route.path)
  else if (route.name === 'list') await renderList(app)
  else if (route.name === 'config') await renderConfig(app)
  else await renderOverview(app)
}

window.addEventListener('hashchange', render)

render().catch((e) => {
  app.textContent = `初始化失败: ${String(e)}`
})
