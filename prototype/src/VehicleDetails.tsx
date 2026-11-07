import { formatPublicationDate } from './vehicle-date'
import { formatMileage } from '../shared/vehicle-mileage'
import { useLocale } from './locale'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Vehicle } from './data'
import { contact } from './data'
export default function VehicleDetails({car,onClose}:{car:Vehicle;onClose:()=>void}) {
  const { t, locale } = useLocale()
 const dialog=useRef<HTMLDialogElement>(null)
 const [index,setIndex]=useState(0)
 const photos=car.photos?.length?car.photos:[{id:'cover',url:car.photo}]
 useEffect(()=>{const d=dialog.current;d?.showModal();const closed=()=>onClose();d?.addEventListener('close',closed);return()=>{d?.removeEventListener('close',closed);d?.close()}},[onClose])
 const message=t('Hi, I am interested in the {year} {name}. Is it available?', {year:car.year,name:car.name})
 return <dialog ref={dialog} className="vehicle-dialog" aria-labelledby="vehicle-detail-title" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <button className="vehicle-dialog-close" onClick={onClose} aria-label={t("Close vehicle details")}><X/></button>
  <div className="vehicle-gallery"><img src={photos[index]?.url} alt={t('{name} — photo {number}', {name:car.name,number:index+1})}/>{photos.length>1&&<div><button onClick={()=>setIndex((index-1+photos.length)%photos.length)} aria-label={t("Previous photo")}><ChevronLeft/></button><span>{index+1} / {photos.length}</span><button onClick={()=>setIndex((index+1)%photos.length)} aria-label={t("Next photo")}><ChevronRight/></button></div>}</div>
  <div className="vehicle-dialog-copy"><p className="section-label">{car.year} · {car.make}{car.status==='sold'?' · '+t('SOLD'):car.status==='reserved'?' · '+t('RESERVED'):''}</p><h2 id="vehicle-detail-title">{car.name}</h2>{car.price!=null&&<strong className="vehicle-price">RM {car.price.toLocaleString(locale)}</strong>}<p>{[t(car.body),t(car.fuel),t(car.transmission),formatMileage(car.mileage,car.mileage_band,locale)].filter(Boolean).join(' · ')}</p>{car.published_at&&<p className="vehicle-published-date"><time dateTime={car.published_at}>{t('Published {date}', { date:formatPublicationDate(car.published_at,locale) })}</time></p>}{car.description&&<p className="vehicle-description">{car.description}</p>}<a className="button button--whatsapp" href={`${contact.whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">{t("Ask about this car ↗")}</a></div>
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
