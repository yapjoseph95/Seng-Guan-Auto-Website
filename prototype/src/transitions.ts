import { flushSync } from 'react-dom'

export function transitionView(update:()=>void, direction:'forward'|'back'|'shared'='shared') {
 const doc = document as Document & {startViewTransition?:(callback:()=>void)=>{finished:Promise<void>}}
 if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return }
 document.documentElement.dataset.transitionDirection=direction
 const transition=doc.startViewTransition(()=>flushSync(update))
 void transition.finished.finally(()=>{delete document.documentElement.dataset.transitionDirection})
}

let pageTransitionId = 0

function pageItems() {
 const main = document.querySelector<HTMLElement>('#main-content')
 if (!main) return []
 const items = Array.from(main.querySelectorAll<HTMLElement>(
  ':scope > .hero, :scope > .home-flow > *, :scope > .content-page > *',
 ))
 return (items.length ? items : Array.from(main.children) as HTMLElement[])
  .filter(item => {
   const rect = item.getBoundingClientRect()
   return rect.bottom > 0 && rect.top < window.innerHeight
  })
}

export async function transitionPage(update: () => void, scrollToTop = false) {
 const id = ++pageTransitionId
 if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  flushSync(update)
  if (scrollToTop) window.scrollTo({ top: 0, behavior: 'instant' })
  return
 }
 const outgoing = pageItems().map((item, index) => item.animate(
  [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 16px' }],
  { duration: 220, delay: Math.min(index * 45, 180), easing: 'ease-in', fill: 'forwards' },
 ))
 await Promise.all(outgoing.map(animation => animation.finished.catch(() => {})))
 if (id !== pageTransitionId) { outgoing.forEach(animation => animation.cancel()); return }
 flushSync(update)
 if (scrollToTop) window.scrollTo({ top: 0, behavior: 'instant' })
 outgoing.forEach(animation => animation.cancel())
 pageItems().forEach((item, index) => item.animate(
  [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }],
  { duration: 300, delay: Math.min(index * 50, 200), easing: 'ease-out', fill: 'backwards' },
 ))
}
