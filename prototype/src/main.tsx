import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { LocaleProvider, useLocale } from './locale'

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
