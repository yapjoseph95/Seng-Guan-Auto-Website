import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LocaleProvider, useLocale } from './locale'
import { VehicleSkeleton } from './LoadingVisuals'

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
const App = lazy(() => import('./App'))

function AdminLoading() {
  const { t } = useLocale()
  let compact=false
  try { compact=localStorage.getItem('sga-admin-layout')==='compact' } catch { /* Use the default layout. */ }
  return <main className={`initial-loading initial-loading--admin${compact?' initial-loading--compact':''}`} role="status" aria-label={t('正在载入后台…')}><div className="initial-loading-header"/><VehicleSkeleton admin compact={compact} /></main>
}

function PublicLoading() {
  const compact=window.matchMedia('(max-width: 760px)').matches
  return <main className="initial-loading initial-loading--public" aria-busy="true"><div className="initial-loading-header"/><VehicleSkeleton compact={compact} /></main>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      {window.location.pathname.replace(/\/$/, '') === '/admin'
        ? <Suspense fallback={<AdminLoading />}><Admin /></Suspense>
        : <Suspense fallback={<PublicLoading />}><App /></Suspense>}
    </LocaleProvider>
  </StrictMode>,
)
