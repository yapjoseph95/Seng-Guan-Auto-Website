import { flushSync } from 'react-dom'

export function transitionView(update:()=>void, direction:'forward'|'back'|'shared'='shared') {
 const doc = document as Document & {startViewTransition?:(callback:()=>void)=>{finished:Promise<void>}}
 if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return }
 document.documentElement.dataset.transitionDirection=direction
 const transition=doc.startViewTransition(()=>flushSync(update))
 void transition.finished.finally(()=>{delete document.documentElement.dataset.transitionDirection})
}
