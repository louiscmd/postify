import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './styles.css'
import App from './App'
import DevRender from './DevRender'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && location.search.includes('render=') ? <DevRender /> : <App />}
  </StrictMode>,
)

// dev-only handle for debugging in the browser console
if (import.meta.env.DEV) import('./store').then((m) => ((window as unknown as Record<string, unknown>).__postify = m.useStore))
