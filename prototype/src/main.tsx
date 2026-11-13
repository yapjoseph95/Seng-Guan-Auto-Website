import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { LocaleProvider, useLocale } from './locale'

// Avoid leaving touch-operated buttons focused while preserving keyboard focus.
let touchInteraction = false
document.addEventListener('pointerdown', event => { touchInteraction = event.pointerType === 'touch' }, true)
document.addEventListener('keydown', () => { touchInteraction = false }, true)
document.addEventListener('focusin', event => {
  const target = event.target
  if (!touchInteraction || !(target instanceof HTMLElement) || !target.matches('button, a[role="button"]')) return
  requestAnimationFrame(() => {
    if (touchInteraction && document.activeElement === target && target.getAttribute('aria-expanded') !== 'true' && !target.hasAttribute('aria-haspopup')) target.blur()
  })
}, true)

const Admin = lazy(() => import('./AdminLogin'))

function AdminLoading() {
  const { t } = useLocale()
  return <p style={{ padding: 32, color: 'white' }}>{t('正在载入后台…')}</p>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      {window.location.pathname.replace(/\/$/, '') === '/admin'
        ? <Suspense fallback={<AdminLoading />}><Admin /></Suspense>
        : <App />}
    </LocaleProvider>
  </StrictMode>,
)
