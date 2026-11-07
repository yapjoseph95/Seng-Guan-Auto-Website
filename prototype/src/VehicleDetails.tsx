import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Vehicle } from './data'
import { contact } from './data'
export default function VehicleDetails({car,onClose}:{car:Vehicle;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null)
 const [index,setIndex]=useState(0)
 const photos=car.photos?.length?car.photos:[{id:'cover',url:car.photo}]
 useEffect(()=>{const d=dialog.current;d?.showModal();const closed=()=>onClose();d?.addEventListener('close',closed);return()=>{d?.removeEventListener('close',closed);d?.close()}},[onClose])
 const message=`Hi, I am interested in the ${car.year} ${car.name}. Is it available?`
 return <dialog ref={dialog} className="vehicle-dialog" aria-labelledby="vehicle-detail-title" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <button className="vehicle-dialog-close" onClick={onClose} aria-label="Close vehicle details"><X/></button>
  <div className="vehicle-gallery"><img src={photos[index]?.url} alt={`${car.name} — photo ${index+1}`}/>{photos.length>1&&<div><button onClick={()=>setIndex((index-1+photos.length)%photos.length)} aria-label="Previous photo"><ChevronLeft/></button><span>{index+1} / {photos.length}</span><button onClick={()=>setIndex((index+1)%photos.length)} aria-label="Next photo"><ChevronRight/></button></div>}</div>
  <div className="vehicle-dialog-copy"><p className="section-label">{car.year} · {car.make}{car.status==='sold'?' · SOLD':''}</p><h2 id="vehicle-detail-title">{car.name}</h2>{car.price!=null&&<strong className="vehicle-price">RM {car.price.toLocaleString()}</strong>}<p>{[car.body,car.fuel,car.transmission,car.mileage!=null?car.mileage.toLocaleString()+' km':''].filter(Boolean).join(' · ')}</p>{car.description&&<p className="vehicle-description">{car.description}</p>}<a className="button button--whatsapp" href={`${contact.whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Ask about this car ↗</a></div>
 </dialog>
}
