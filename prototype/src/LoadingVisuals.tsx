import { useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from 'react'
import { useLocale } from './locale'
import './LoadingVisuals.css'

export function ProgressiveImage({src,priority=false,preview,containerClassName='',onPreviewLoad,...props}:ImgHTMLAttributes<HTMLImageElement>&{src:string;priority?:boolean;preview?:string;containerClassName?:string;onPreviewLoad?:(image:HTMLImageElement)=>void}) {
 const ref=useRef<HTMLSpanElement>(null)
 const [near,setNear]=useState(priority)
 const [loadedSrc,setLoadedSrc]=useState('')
 const loaded=loadedSrc===src
 useEffect(()=>{setNear(priority)},[src])
 useEffect(()=>{if(priority)setNear(true)},[priority])
 useEffect(()=>{
  const node=ref.current
  if(!node || near)return
  const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting){setNear(true);observer.disconnect()}},{rootMargin:'300px'})
  observer.observe(node)
  return()=>observer.disconnect()
 },[near,src])
 const isPhoto=/^\/api\/(?:admin\/)?photos\//.test(src)
 const separator=src.includes('?')?'&':'?'
 return <span ref={ref} className={`progressive-image ${containerClassName}`} data-loaded={loaded}>
  {near && (isPhoto || preview) && <img className="progressive-image-preview" src={preview ?? `${src}${separator}preview=1`} onLoad={event=>onPreviewLoad?.(event.currentTarget)} alt="" aria-hidden="true" draggable={false} />}
  {near && <img {...props} src={src} loading="eager" decoding="async" fetchPriority={priority?'high':'auto'} onLoad={event=>{setLoadedSrc(src);props.onLoad?.(event)}} />}
 </span>
}
export function VehicleSkeleton({compact=false,admin=false}:{compact?:boolean;admin?:boolean}) {
 const ref=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  const container=ref.current
  if(!container)return
  const update=()=>{
   const root=container.getBoundingClientRect()
   const blocks=Array.from(container.querySelectorAll('.skeleton-photo,.skeleton-copy i')).map(node=>{
    const box=node.getBoundingClientRect()
    return `<rect x="${box.left-root.left}" y="${box.top-root.top}" width="${box.width}" height="${box.height}" rx="3" fill="white"/>`
   }).join('')
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${root.width}" height="${root.height}">${blocks}</svg>`
   container.style.setProperty('--skeleton-mask',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`)
  }
  const observer=new ResizeObserver(update)
  observer.observe(container)
  update()
  return()=>observer.disconnect()
 },[compact,admin])
 return <div ref={ref} className={`loading-skeleton ${admin?'loading-skeleton--admin ':''}${compact?'loading-skeleton--compact':''}`} aria-hidden="true">
  {Array.from({length:admin?6:3},(_,index)=><div className="loading-skeleton-card" key={index}><div className="skeleton-photo"/><div className="skeleton-copy"><i/><i/><i/><i/></div></div>)}
  <span className="skeleton-light" />
 </div>
}
export function ListingTransition({loading,compact=false,admin=false,children}:{loading:boolean;compact?:boolean;admin?:boolean;children:ReactNode}) {
 const [showSkeleton,setShowSkeleton]=useState(loading)
 useEffect(()=>{
  if(loading){setShowSkeleton(true);return}
  const timer=window.setTimeout(()=>setShowSkeleton(false),500)
  return()=>window.clearTimeout(timer)
 },[loading])
 return <div className="listing-transition" aria-busy={loading}>
  {loading ? <VehicleSkeleton compact={compact} admin={admin} /> : <>{children}{showSkeleton && <div className="skeleton-fade"><VehicleSkeleton compact={compact} admin={admin} /></div>}</>}
 </div>
}
export function LoadMore({sentinel,loading,hasMore,error,retry}:{sentinel:React.RefObject<HTMLDivElement|null>;loading:boolean;hasMore:boolean;error:string;retry:()=>void}) {
 const {t}=useLocale()
 return <div className="load-more" ref={sentinel} role="status" aria-live="polite">
  {error ? <button type="button" onClick={retry}>{t('Unable to load vehicles. Try again.')}</button> : loading ? <span className="loading-dots" aria-label={t('Loading vehicles…')}><i/><i/><i/></span> : !hasMore ? t('No more vehicles') : null}
 </div>
}
export const entranceStyle=(index:number):CSSProperties=>({'--entrance-delay':`${index%6*50}ms`} as CSSProperties)
