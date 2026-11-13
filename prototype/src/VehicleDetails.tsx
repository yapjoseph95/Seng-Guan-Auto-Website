import WhatsAppGlyph from './WhatsAppGlyph'
import { formatPublicationDate } from './vehicle-date'
import { formatMileage } from '../shared/vehicle-mileage'
import { getVehicleDiscount } from '../shared/vehicle-pricing'
import { useLocale } from './locale'
import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Calculator, CalendarDays, CarFront, ChevronLeft, ChevronRight, Fuel, Gauge, Pause, Play, Settings2, X } from 'lucide-react'
import type { Vehicle } from './data'
import { contact } from './data'
export function VehicleSpecs({car,showFuel = false}: {car:Vehicle; showFuel?:boolean}) {
 const { t, locale } = useLocale()
 const mileage = formatMileage(car.mileage,car.mileage_band,locale)
 const fuel = showFuel && car.fuel
 return <div className="vehicle-specs">
  <div className="vehicle-spec-pair">
   <span><CalendarDays size={14} aria-hidden="true" /> {car.year}</span>
   {mileage && <span><Gauge size={14} aria-hidden="true" /> {mileage}</span>}
  </div>
  {(car.body || car.transmission || fuel) && <div className="vehicle-spec-pair">
   {car.body && <span><CarFront size={14} aria-hidden="true" /> {t(car.body)}</span>}
   {car.transmission && <span><Settings2 size={14} aria-hidden="true" /> {t(car.transmission)}</span>}
   {fuel && <span><Fuel size={14} aria-hidden="true" /> {t(fuel)}</span>}
  </div>}
 </div>
}

export function VehicleListingDate({car}: {car:Vehicle}) {
 const { t, locale } = useLocale()
 const date = car.listing_updated_at ?? car.published_at
 if (!date) return null
 return <time className="vehicle-published-date" dateTime={date}>
  {t(car.listing_updated_at ? 'Updated on {date}' : 'Published on {date}',{date:formatPublicationDate(date,locale)})}
 </time>
}

export default function VehicleDetails({car,onClose,onCalculator,onShare,copied=false}:{car:Vehicle;onClose:()=>void;onCalculator?:()=>void;onShare?:()=>void;copied?:boolean}) {
 const { t, locale, language } = useLocale()
 const dialog = useRef<HTMLDialogElement>(null)
 const thumbnails = useRef<HTMLDivElement>(null)
 const gesture = useRef<{id:number; x:number; y:number} | null>(null)
 const dragged = useRef(false)
 const [index,setIndex] = useState(0)
 const [paused,setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
 const photos = car.photos?.length ? car.photos : [{id:'cover',url:car.photo}]

 useEffect(() => {
  const modal = dialog.current
  const previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  modal?.showModal()
  return () => { modal?.close(); document.documentElement.style.overflow = previousOverflow }
 }, [])

 useEffect(() => {
  if (paused || photos.length < 2) return
  const timer = window.setInterval(() => {
   if (!document.hidden && !gesture.current) setIndex(current => (current + 1) % photos.length)
  },5000)
  return () => window.clearInterval(timer)
 }, [index,paused,photos.length])

 useEffect(() => {
  const strip = thumbnails.current
  const active = strip?.children[index] as HTMLElement | undefined
  if (!strip || !active) return
  if (active.offsetLeft < strip.scrollLeft) strip.scrollLeft = active.offsetLeft
  else if (active.offsetLeft + active.offsetWidth > strip.scrollLeft + strip.clientWidth) {
   strip.scrollLeft = active.offsetLeft + active.offsetWidth - strip.clientWidth
  }
 }, [index])

 const stepPhoto = (direction: number) => {
  setIndex(current => (current + direction + photos.length) % photos.length)
 }

 const startGesture = (event: PointerEvent<HTMLDivElement>) => {
  if (photos.length < 2 || !event.isPrimary || event.button !== 0) return
  dragged.current = false
  gesture.current = {id:event.pointerId, x:event.clientX, y:event.clientY}
  // Keep an edge button as the click target when the gesture is a tap.
  const edge = (event.target as Element).closest('.vehicle-gallery-edge')
  const captureTarget = edge ?? event.currentTarget
  captureTarget.setPointerCapture(event.pointerId)
 }

 const finishGesture = (event: PointerEvent<HTMLDivElement>) => {
  const start = gesture.current
  if (!start || start.id !== event.pointerId) return
  gesture.current = null
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  dragged.current = Math.hypot(dx,dy) > 12
  if (Math.abs(dx) >= 35 && Math.abs(dx) > Math.abs(dy) * 1.2) {
   stepPhoto(dx < 0 ? 1 : -1)
  }
 }

 const clearGesture = (event: PointerEvent<HTMLDivElement>) => {
  if (gesture.current?.id === event.pointerId) gesture.current = null
 }

 const dismiss = () => {
  dialog.current?.close()
  onClose()
 }
 const description = car.description
 const template = car.description_template?.[language]
 const message = t('Hi, I am interested in the {year} {name}. Is it available?', {year:car.year,name:car.name})

 return <dialog ref={dialog} autoFocus className="vehicle-dialog" aria-labelledby="vehicle-detail-title"
  onCancel={event => {event.preventDefault(); dismiss()}}>
  <button type="button" className="vehicle-dialog-close" onClick={dismiss} aria-label={t('Close vehicle details')}><X /></button>
  <div className="vehicle-gallery" onContextMenu={event=>event.preventDefault()} onDragStart={event=>event.preventDefault()}>
   <div className="vehicle-gallery-frame" onPointerDown={startGesture} onPointerUp={finishGesture}
    onPointerCancel={clearGesture} onLostPointerCapture={clearGesture}>
    <img src={photos[index]?.url} draggable={false} alt={t('{name} — photo {number}',{name:car.name,number:index+1})} />
    {photos.length > 1 && <>
     <button type="button" className="vehicle-gallery-edge vehicle-gallery-edge--previous"
      aria-label={t('Previous photo')} onClick={event => {if (!dragged.current || event.detail === 0) stepPhoto(-1)}}>
      <ChevronLeft size={20} aria-hidden="true" />
     </button>
     <button type="button" className="vehicle-gallery-edge vehicle-gallery-edge--next"
      aria-label={t('Next photo')} onClick={event => {if (!dragged.current || event.detail === 0) stepPhoto(1)}}>
      <ChevronRight size={20} aria-hidden="true" />
     </button>
    </>}
   </div>
   {photos.length > 1 && <div className="vehicle-gallery-controls">
    <div className="vehicle-gallery-thumbnails" ref={thumbnails}>
     {photos.map((photo,position) => <button type="button" key={photo.id}
      aria-label={t('预览照片 {number}',{number:position+1})} aria-current={index === position ? 'true' : undefined}
      onClick={() => setIndex(position)}>
      <img src={photo.url} alt="" loading="lazy" draggable={false} />
     </button>)}
    </div>
    <button type="button" className="vehicle-gallery-play"
     aria-label={t(paused ? 'Play photo slideshow' : 'Pause photo slideshow')} onClick={() => setPaused(value => !value)}>
     {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
    </button>
   </div>}
  </div>
  <div className="vehicle-dialog-copy">
   <div className="vehicle-dialog-meta">
    <p className="section-label vehicle-dialog-make">{car.make}</p>
    <VehicleListingDate car={car} />
   </div>
   <div className="vehicle-dialog-title-row"><h2 id="vehicle-detail-title">{car.name}</h2>
    {onCalculator && onShare && <div className="vehicle-actions vehicle-dialog-actions">
     <button type="button" className="vehicle-calculator" onClick={onCalculator} aria-label={t('Loan calculator for {name}',{name:car.name})} title={t('Loan calculator')}><Calculator size={20} aria-hidden="true" /></button>
     <button type="button" className="vehicle-share" onClick={onShare} aria-label={t('Share {name}',{name:car.name})}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 10.5 14 5v3C8 8.8 4 12.3 2.5 19c3.4-4.3 7.1-6.3 11.5-6.3v3.3l8-5.5Z" /></svg></button>
     <span className="vehicle-share-status" role="status">{copied ? t('Link copied') : ''}</span>
    </div>}
   </div>
   {car.price != null && (() => {
    const discount = getVehicleDiscount(car.price,car.discount_price)
    return discount ? <div className="vehicle-pricing vehicle-pricing--details">
     <strong className="vehicle-price">RM {car.discount_price!.toLocaleString(locale)}</strong>
     <del className="vehicle-price-original">RM {car.price!.toLocaleString(locale)}</del>
     <span className="vehicle-price-drop">-{discount.percent}% {t('Price drop!')}</span>
    </div> : <strong className="vehicle-price">RM {car.price!.toLocaleString(locale)}</strong>
   })()}
   <VehicleSpecs car={car} showFuel />
   {(description || template) && <>
    <h3 className="vehicle-description-title">{t('Vehicle Description')}</h3>
    <div className="vehicle-description">
     {description && <p>{description}</p>}
     {description && template && <hr />}
     {template && <p>{template}</p>}
    </div>
   </>}
   <a className="button button--whatsapp" href={`${contact.whatsapp}?text=${encodeURIComponent(message)}`}
    target="_blank" rel="noreferrer"><WhatsAppGlyph />{t('Ask about this car')}</a>
  </div>
 </dialog>
}

export function VehicleUnavailable({ status, onClose }: { status: 'reserved' | 'sold'; onClose: () => void }) {
 const { t } = useLocale()
 const dialog = useRef<HTMLDialogElement>(null)
 const titleId = useId()
 const descriptionId = useId()

 useEffect(() => {
  const modal = dialog.current
  const previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  modal?.showModal()
  return () => { modal?.close(); document.documentElement.style.overflow = previousOverflow }
 }, [])

 const dismiss = () => {
  dialog.current?.close()
  onClose()
 }

 return <dialog ref={dialog} autoFocus className="vehicle-dialog vehicle-dialog--unavailable"
  aria-labelledby={titleId} aria-describedby={descriptionId}
  onCancel={event => { event.preventDefault(); dismiss() }}>
  <div className="vehicle-dialog-copy">
   <h2 id={titleId}>{t('Oh no!')}</h2>
   <p id={descriptionId}>{t(status === 'sold'
    ? 'This car has already been sold. Feel free to browse our other cars.'
    : 'This car has already been reserved. Feel free to browse our other cars.')}</p>
   <button type="button" className="button button--primary" onClick={dismiss}>{t('Browse other cars')}</button>
  </div>
 </dialog>
}
