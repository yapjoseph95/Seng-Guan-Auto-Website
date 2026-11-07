import { useLocale } from './locale'
import { useEffect, useRef, useState } from 'react'
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
  <div className="vehicle-dialog-copy"><p className="section-label">{car.year} · {car.make}{car.status==='sold'?' · '+t('SOLD'):car.status==='reserved'?' · '+t('RESERVED'):''}</p><h2 id="vehicle-detail-title">{car.name}</h2>{car.price!=null&&<strong className="vehicle-price">RM {car.price.toLocaleString(locale)}</strong>}<p>{[t(car.body),t(car.fuel),t(car.transmission),car.mileage!=null?car.mileage.toLocaleString(locale)+' km':''].filter(Boolean).join(' · ')}</p>{car.description&&<p className="vehicle-description">{car.description}</p>}<a className="button button--whatsapp" href={`${contact.whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">{t("Ask about this car ↗")}</a></div>
 </dialog>
}
