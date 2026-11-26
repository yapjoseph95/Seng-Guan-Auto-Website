export function mailRowPositions(list: HTMLElement | null) {
 return new Map(Array.from(list?.querySelectorAll<HTMLElement>('[data-mail-id]') || [], row => [row.dataset.mailId!, row.getBoundingClientRect().top]))
}

export function animateMailRows(list: HTMLElement, previous: Map<string,number>, reducedMotion: boolean) {
 if(reducedMotion)return []
 const rows=Array.from(list.querySelectorAll<HTMLElement>('[data-mail-id]'))
 // Read every position before starting animations so layout work stays batched.
 const positions=rows.map(row=>({row,top:row.getBoundingClientRect().top,old:previous.get(row.dataset.mailId!)}))
 let incoming=0
 return positions.flatMap(({row,top,old})=>{
  if(typeof row.animate!=='function')return []
  if(old!==undefined&&Math.abs(old-top)<1)return []
  const animation=old===undefined
   ?row.animate([{opacity:0,transform:'translateY(-20px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:(previous.size?260:0)+incoming++*50,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'})
   :row.animate([{transform:`translateY(${old-top}px)`},{transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'})
  return [animation]
 })
}
