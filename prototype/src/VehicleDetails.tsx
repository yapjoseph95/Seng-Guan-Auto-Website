import WhatsAppGlyph from './WhatsAppGlyph'
import { formatPublicationDate } from './vehicle-date'
import { formatMileage } from '../shared/vehicle-mileage'
import { useLocale } from './locale'
import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, CarFront, Fuel, Gauge, Pause, Play, Settings2, X } from 'lucide-react'
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

export default function VehicleDetails({car,onClose}:{car:Vehicle;onClose:()=>void}) {
 const { t, locale } = useLocale()
 const dialog = useRef<HTMLDialogElement>(null)
 const thumbnails = useRef<HTMLDivElement>(null)
 const [index,setIndex] = useState(0)
 const [paused,setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
 const photos = car.photos?.length ? car.photos : [{id:'cover',url:car.photo}]

 useEffect(() => {
  const modal = dialog.current
  modal?.showModal()
  return () => modal?.close()
 }, [])

 useEffect(() => {
  if (paused || photos.length < 2) return
  const timer = window.setInterval(() => {
   if (!document.hidden) setIndex(current => (current + 1) % photos.length)
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

 const dismiss = () => {
  dialog.current?.close()
  onClose()
 }
 const message = t('Hi, I am interested in the {year} {name}. Is it available?', {year:car.year,name:car.name})

 return <dialog ref={dialog} className="vehicle-dialog" aria-labelledby="vehicle-detail-title"
  onCancel={event => {event.preventDefault(); dismiss()}}
  onClick={event => {if (event.target === event.currentTarget) dismiss()}}>
  <button type="button" className="vehicle-dialog-close" onClick={dismiss} aria-label={t('Close vehicle details')}><X /></button>
  <div className="vehicle-gallery">
   <img src={photos[index]?.url} alt={t('{name} — photo {number}',{name:car.name,number:index+1})} />
   {photos.length > 1 && <div className="vehicle-gallery-controls">
    <div className="vehicle-gallery-thumbnails" ref={thumbnails}>
     {photos.map((photo,position) => <button type="button" key={photo.id}
      aria-label={t('预览照片 {number}',{number:position+1})} aria-current={index === position ? 'true' : undefined}
      onClick={() => setIndex(position)}>
      <img src={photo.url} alt="" loading="lazy" />
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
    {car.published_at && <time className="vehicle-published-date" dateTime={car.published_at}>
     {t('Published {date}',{date:formatPublicationDate(car.published_at,locale)})}
    </time>}
   </div>
   <h2 id="vehicle-detail-title">{car.name}</h2>
   {car.price != null && <strong className="vehicle-price">RM {car.price.toLocaleString(locale)}</strong>}
   <VehicleSpecs car={car} showFuel />
   {car.description && <p className="vehicle-description">{car.description}</p>}
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
  modal?.showModal()
  return () => modal?.close()
 }, [])

 const dismiss = () => {
  dialog.current?.close()
  onClose()
 }

 return <dialog ref={dialog} className="vehicle-dialog vehicle-dialog--unavailable"
  aria-labelledby={titleId} aria-describedby={descriptionId}
  onCancel={event => { event.preventDefault(); dismiss() }}
  onClick={event => { if (event.target === event.currentTarget) dismiss() }}>
  <div className="vehicle-dialog-copy">
   <h2 id={titleId}>{t('Oh no!')}</h2>
   <p id={descriptionId}>{t(status === 'sold'
    ? 'This car has already been sold. Feel free to browse our other cars.'
    : 'This car has already been reserved. Feel free to browse our other cars.')}</p>
   <button type="button" className="button button--primary" onClick={dismiss}>{t('Browse other cars')}</button>
  </div>
 </dialog>
}
