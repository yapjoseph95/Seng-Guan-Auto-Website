import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { lazy, Suspense } from 'react'
const Admin = lazy(() => import('./AdminLogin'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.replace(/\/$/, '') === '/admin' ? <Suspense fallback={<p style={{padding:32,color:'white'}}>正在载入后台…</p>}><Admin /></Suspense> : <App />}
  </StrictMode>,
)
