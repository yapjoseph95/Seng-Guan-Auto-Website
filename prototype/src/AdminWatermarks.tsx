import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Upload, X } from 'lucide-react'
import { maxWatermarksPerPhoto, type WatermarkAsset, type WatermarkPlacement } from '../shared/watermarks'
import { maxPhotoBytes } from '../shared/vehicle-photos'
import { useLocale } from './locale'
import type { AdminPhoto } from './AdminPhotoGrid'

export type WatermarkRequest = <T>(path: string, options?: RequestInit) => Promise<T>

const clamp = (value: number) => Math.min(1, Math.max(0, value))
type Size = { width: number; height: number }

function watermarkBounds(photo: Size, mark: Size, placement: WatermarkPlacement) {
 const width = Math.min(photo.width, photo.height * mark.width / mark.height) * placement.scale
 const height = width * mark.height / mark.width
 return { width, height, x: (photo.width - width) * placement.x, y: (photo.height - height) * placement.y }
}

async function imageBitmap(url: string) {
 const image = new Image()
 image.src = url
 await image.decode().catch(() => { throw new Error('Could not load the image.') })
 return createImageBitmap(image)
}

async function renderWatermarks(photoUrl: string, layers: {asset:WatermarkAsset; placement:WatermarkPlacement}[]) {
 const photo = await imageBitmap(photoUrl)
 try {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1,2000 / Math.max(photo.width,photo.height))
  canvas.width = Math.max(1,Math.round(photo.width * scale))
  canvas.height = Math.max(1,Math.round(photo.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('照片处理失败。')
  context.drawImage(photo,0,0,canvas.width,canvas.height)
  for (const {asset,placement} of layers) {
   const mark = await imageBitmap(asset.url)
   try {
    const bounds = watermarkBounds(canvas,mark,placement)
    context.globalAlpha = placement.opacity
    context.drawImage(mark,bounds.x,bounds.y,bounds.width,bounds.height)
   } finally { mark.close() }
  }
  return await new Promise<Blob>((resolve,reject) =>
   canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('照片处理失败。')), 'image/jpeg', .86))
 } finally { photo.close() }
}

function WatermarkDialog({ title, onClose, busy = false, children }: {
 title: string; onClose: () => void; busy?: boolean; children: ReactNode
}) {
 const { t } = useLocale()
 const dialog = useRef<HTMLDialogElement>(null)
 useEffect(() => {
  const modal = dialog.current
  modal?.showModal()
  return () => modal?.close()
 }, [])
 return <dialog ref={dialog} className="admin-watermark-dialog" aria-labelledby="admin-watermark-title"
  onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
  <div className="admin-watermark-heading">
   <h2 id="admin-watermark-title">{title}</h2>
   <button type="button" aria-label={t('Close')} disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button>
  </div>
  {children}
 </dialog>
}

export function WatermarkLibrary({ request, onClose }: {request:WatermarkRequest; onClose:() => void}) {
 const { t } = useLocale()
 const [assets,setAssets] = useState<WatermarkAsset[] | null>(null)
 const [name,setName] = useState('')
 const [file,setFile] = useState<File | null>(null)
 const [busy,setBusy] = useState(false)
 const [error,setError] = useState('')
 const [notice,setNotice] = useState('')
 const fileInput = useRef<HTMLInputElement>(null)

 useEffect(() => {
  let active = true
  request<{watermarks:WatermarkAsset[]}>('watermarks')
   .then(data => { if (active) setAssets(data.watermarks) })
   .catch(error => { if (active) setError((error as Error).message) })
  return () => { active = false }
 }, [request])

 const upload = async (event: FormEvent) => {
  event.preventDefault()
  if (!file || busy) return
  setError('')
  setNotice('')
  setBusy(true)
  try {
   if (file.size > maxPhotoBytes) throw new Error('Watermark images must be under 7 MB.')
   const bitmap = await createImageBitmap(file).catch(() => { throw new Error('The file is not a supported photo.') })
   bitmap.close()
   const data = new FormData()
   data.set('name',name)
   data.set('file',file)
   const asset = await request<WatermarkAsset>('watermarks',{method:'POST',body:data})
   setAssets(current => [...(current ?? []),asset].sort((a,b) => a.name.localeCompare(b.name)))
   setName('')
   setFile(null)
   if (fileInput.current) fileInput.current.value = ''
   setNotice('Watermark added.')
  } catch (error) {
   setError((error as Error).message)
  } finally {
   setBusy(false)
  }
 }

 return <WatermarkDialog title={t('Watermark settings')} busy={busy} onClose={onClose}>
  <form onSubmit={upload} className="admin-watermark-form">
   <p>{t('Upload a JPG, PNG or WebP image. Use a transparent PNG or WebP for a logo without a background.')}</p>
   <label>{t('Watermark name')}<input required maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
   <label>{t('Watermark image')}<input ref={fileInput} required type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
   <button className="admin-primary" disabled={busy || !assets || !file || !name.trim()}><Upload size={17} aria-hidden="true" />{t(busy ? 'Uploading watermark…' : 'Upload watermark')}</button>
  </form>
  {error && <p className="admin-error" role="alert">{t(error)}</p>}
  {notice && <p role="status">{t(notice)}</p>}
  <ul className="admin-watermark-library" aria-label={t('Saved watermarks')}>
   {assets?.map(asset => <li key={asset.id}><img src={asset.url} alt="" /><span>{asset.name}</span></li>)}
  </ul>
 </WatermarkDialog>
}

function photoWatermarks(photo: AdminPhoto) {
 return photo.watermarks ?? (photo.watermark ? [photo.watermark] : [])
}

export type WatermarkPhotoChange = { placements:WatermarkPlacement[]; render?:Blob }

export function PhotoWatermarkEditor({ photos, photo, request, onSelect, onApply, onClose }: {
 photos: AdminPhoto[]; photo: AdminPhoto; request: WatermarkRequest
 onSelect: (id: string) => void
 onApply: (changes: ReadonlyMap<string,WatermarkPhotoChange>) => void; onClose: () => void
}) {
 const { t } = useLocale()
 const photoUrl = photo.original_url ?? photo.url
 const index = photos.findIndex(item => item.id === photo.id)
 const [assets,setAssets] = useState<WatermarkAsset[] | null>(null)
 const [drafts,setDrafts] = useState(() => new Map<string,WatermarkPlacement[]>())
 const original = photoWatermarks(photo)
 const marks = drafts.get(photo.id) ?? original
 const [selected,setSelected] = useState(0)
 const [photoSize,setPhotoSize] = useState<Size>()
 const [assetSizes,setAssetSizes] = useState<Record<string,Size>>({})
 const [busy,setBusy] = useState(false)
 const [error,setError] = useState('')
 const [ghost,setGhost] = useState<{asset:WatermarkAsset;x:number;y:number;over:boolean} | null>(null)
 const stage = useRef<HTMLDivElement>(null)
 const thumbnails = useRef<HTMLDivElement>(null)
 const layerDrag = useRef<{index:number;left:number;top:number;x:number;y:number;travelX:number;travelY:number} | null>(null)
 const assetDrag = useRef<{pointer:number;x:number;y:number;moved:boolean} | null>(null)
 const suppressAssetClick = useRef(false)
 const mark = marks[selected]
 const layers = marks.map(placement => ({
  placement, asset:assets?.find(item => item.id === placement.watermarkId),
 }))
 const canAdd = !busy && !!photoSize && marks.length < maxWatermarksPerPhoto


 useEffect(() => {
  let active = true
  request<{watermarks:WatermarkAsset[]}>('watermarks')
   .then(data => { if (active) setAssets(data.watermarks) })
   .catch(error => { if (active) setError((error as Error).message) })
  return () => { active = false }
 }, [request])

 useEffect(() => {
  const strip = thumbnails.current
  const current = strip?.children[index] as HTMLElement | undefined
  if (!strip || !current) return
  const start = current.offsetLeft
  const end = start + current.offsetWidth
  if (start < strip.scrollLeft) strip.scrollLeft = start
  else if (end > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = end - strip.clientWidth
 }, [index,photos.length])

 const switchPhoto = (next: AdminPhoto) => {
  if (busy || next.id === photo.id) return
  layerDrag.current = null
  setPhotoSize(undefined)
  setError('')
  setSelected(0)
  onSelect(next.id)
 }

 const movePhoto = (offset: number) => switchPhoto(photos[(index + offset + photos.length) % photos.length])

 const updateMarks = (update: (current: WatermarkPlacement[]) => WatermarkPlacement[]) => {
  setDrafts(previous => {
   const next = new Map(previous)
   const updated = update(previous.get(photo.id) ?? original)
   if (JSON.stringify(updated) === JSON.stringify(original)) next.delete(photo.id)
   else next.set(photo.id,updated)
   return next
  })
 }

 const updatePlacement = (layer: number, change: Partial<WatermarkPlacement>) =>
  updateMarks(previous => previous.map((item,i) => i === layer ? {...item,...change} : item))

 const recordAssetSize = (id: string, image: HTMLImageElement) => {
  const {naturalWidth:width,naturalHeight:height} = image
  setAssetSizes(previous => previous[id]?.width === width && previous[id]?.height === height
   ? previous : {...previous,[id]:{width,height}})
 }

 const startLayerDrag = (event: PointerEvent<HTMLImageElement>, layer: number) => {
  if (!stage.current || busy || event.button !== 0 || !event.isPrimary) return
  const frame = stage.current.getBoundingClientRect()
  const overlay = event.currentTarget.getBoundingClientRect()
  const {x,y} = marks[layer]
  setSelected(layer)
  layerDrag.current = {index:layer,left:event.clientX,top:event.clientY,x,y,
   travelX:frame.width-overlay.width,travelY:frame.height-overlay.height}
  event.currentTarget.setPointerCapture(event.pointerId)
 }

 const moveLayerDrag = (event: PointerEvent<HTMLImageElement>) => {
  const start = layerDrag.current
  if (!start || !event.isPrimary) return
  updatePlacement(start.index,{
   x:start.travelX > 0 ? clamp(start.x + (event.clientX - start.left) / start.travelX) : start.x,
   y:start.travelY > 0 ? clamp(start.y + (event.clientY - start.top) / start.travelY) : start.y,
  })
 }

 const frameAt = (x: number, y: number) => {
  const frame = stage.current?.getBoundingClientRect()
  return frame && x >= frame.left && x <= frame.right && y >= frame.top && y <= frame.bottom ? frame : null
 }

 const addWatermark = (asset: WatermarkAsset, drop?: {x:number;y:number;frame:DOMRect}) => {
  if (!canAdd || !photoSize) return
  const placement = {watermarkId:asset.id,x:marks.length % 2 === 0 ? .95 : .05,
   y:marks.length < 2 ? .95 : .05,scale:.28,opacity:.8}
  const size = assetSizes[asset.id]
  if (drop && size) {
   const bounds = watermarkBounds(photoSize,size,placement)
   const width = bounds.width / photoSize.width
   const height = bounds.height / photoSize.height
   placement.x = clamp(((drop.x-drop.frame.left)/drop.frame.width-width/2)/(1-width))
   placement.y = clamp(((drop.y-drop.frame.top)/drop.frame.height-height/2)/(1-height))
  }
  setSelected(marks.length)
  updateMarks(previous => [...previous,placement])
 }

 const startAssetDrag = (event: PointerEvent<HTMLButtonElement>) => {
  if (!canAdd || event.button !== 0 || !event.isPrimary) return
  suppressAssetClick.current = false
  assetDrag.current = {pointer:event.pointerId,x:event.clientX,y:event.clientY,moved:false}
  event.currentTarget.setPointerCapture(event.pointerId)
 }

 const moveAssetDrag = (event: PointerEvent<HTMLButtonElement>, asset: WatermarkAsset) => {
  const start = assetDrag.current
  if (!start || start.pointer !== event.pointerId) return
  if (!start.moved && Math.hypot(event.clientX-start.x,event.clientY-start.y) < 6) return
  start.moved = true
  setGhost({asset,x:event.clientX,y:event.clientY,over:!!frameAt(event.clientX,event.clientY)})
 }

 const endAssetDrag = (event: PointerEvent<HTMLButtonElement>, asset: WatermarkAsset) => {
  const start = assetDrag.current
  if (!start || start.pointer !== event.pointerId) return
  assetDrag.current = null
  suppressAssetClick.current = start.moved
  setGhost(null)
  const frame = frameAt(event.clientX,event.clientY)
  if (start.moved && frame) addWatermark(asset,{x:event.clientX,y:event.clientY,frame})
 }

 const removeWatermark = (layer: number) => {
  updateMarks(previous => previous.filter((_,i) => i !== layer))
  setSelected(Math.max(0,Math.min(selected - Number(layer < selected),marks.length-2)))
 }

 const apply = async () => {
  if (busy || !drafts.size) return
  setError('')
  setBusy(true)
  try {
   const changes = new Map<string,WatermarkPhotoChange>()
   for (const item of photos) {
    const placements = drafts.get(item.id)
    if (!placements) continue
    if (!placements.length) {
     changes.set(item.id,{placements})
     continue
    }
    const layers = placements.map(placement => {
     const asset = assets?.find(asset => asset.id === placement.watermarkId)
     if (!asset) throw new Error('Watermark not found.')
     return {asset,placement}
    })
    const render = await renderWatermarks(item.original_url ?? item.url,layers)
    if (render.size > maxPhotoBytes) throw new Error('照片处理失败。')
    changes.set(item.id,{placements,render})
   }
   onApply(changes)
  } catch (error) {
   setError((error as Error).message)
   setBusy(false)
  }
 }

 return <WatermarkDialog title={t('Edit photo watermark')} busy={busy} onClose={onClose}>
  <div className="admin-watermark-view" data-multiple={photos.length > 1}>
   {photos.length > 1 && <button type="button" aria-label={t('Previous photo')} disabled={busy} onClick={() => movePhoto(-1)}>
    <ChevronLeft size={20} aria-hidden="true" />
   </button>}
   <div className="admin-watermark-stage" data-drop-target={ghost?.over || undefined} ref={stage}>
    <img key={photo.id} className="admin-watermark-base" src={photoUrl} alt={t('照片预览')} draggable={false}
     onLoad={event => setPhotoSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}
     onError={() => setError('Could not load the image.')} />
    {layers.map(({placement,asset},i) => {
     if (!asset) return null
     const size = assetSizes[asset.id]
     const bounds = photoSize && size && watermarkBounds(photoSize,size,placement)
     return <div key={`${i}:${asset.id}`} className="admin-watermark-layer" data-selected={selected === i}
      style={bounds && photoSize ? {width:`${bounds.width/photoSize.width*100}%`,left:`${bounds.x/photoSize.width*100}%`,
       top:`${bounds.y/photoSize.height*100}%`} : {visibility:'hidden'}}>
      <img className="admin-watermark-mark" src={asset.url} alt="" draggable={false} style={{opacity:placement.opacity}}
       onLoad={event => recordAssetSize(asset.id,event.currentTarget)}
       onError={() => setError('Could not load the image.')}
       onPointerDown={event => startLayerDrag(event,i)} onPointerMove={moveLayerDrag}
       onLostPointerCapture={() => { layerDrag.current = null }} />
      <button type="button" className="admin-watermark-remove" disabled={busy}
       aria-label={t('Remove watermark {number}',{number:i+1})} onClick={() => removeWatermark(i)}>
       <X size={15} aria-hidden="true" />
      </button>
     </div>
    })}
   </div>
   {photos.length > 1 && <button type="button" aria-label={t('Next photo')} disabled={busy} onClick={() => movePhoto(1)}>
    <ChevronRight size={20} aria-hidden="true" />
   </button>}
  </div>
  <div className="admin-preview-thumbnails admin-watermark-thumbnails" ref={thumbnails}>
   {photos.map((item, position) => <button key={item.id} type="button"
    aria-label={t('预览照片 {number}', {number:position + 1})} aria-current={item.id === photo.id ? 'true' : undefined}
    data-pending={drafts.has(item.id) || undefined} aria-description={drafts.has(item.id) ? t('有未保存的修改') : undefined}
    disabled={busy} onClick={() => switchPhoto(item)}>
    <img src={item.url} alt="" loading="lazy" draggable={false} />
   </button>)}
  </div>
  <div className="admin-watermark-controls">
   {assets?.length === 0 && <p>{t('Add a watermark in Watermark settings first.')}</p>}
   {!!assets?.length && <>
    <p>{t('Drag a watermark onto the photo, or select it to add it.')}</p>
    <div className="admin-watermark-palette" aria-label={t('Saved watermarks')}>
     {assets.map(asset => <button type="button" key={asset.id} disabled={!canAdd}
      aria-label={t('Add watermark {name}',{name:asset.name})} onPointerDown={startAssetDrag}
      onPointerMove={event => moveAssetDrag(event,asset)} onPointerUp={event => endAssetDrag(event,asset)}
      onLostPointerCapture={() => { assetDrag.current = null; setGhost(null) }}
      onClick={event => { if (event.detail === 0 || !suppressAssetClick.current) addWatermark(asset); suppressAssetClick.current = false }}>
      <img src={asset.url} alt="" draggable={false} onLoad={event => recordAssetSize(asset.id,event.currentTarget)} />
      <span>{asset.name}</span>
     </button>)}
    </div>
   </>}
   {marks.length >= maxWatermarksPerPhoto && <p>{t('Too many watermarks for this photo.')}</p>}
   {ghost && <img className="admin-watermark-ghost" src={ghost.asset.url} alt="" style={{left:ghost.x,top:ghost.y}} />}
   {mark && <>
    <div className="admin-watermark-layer-list" aria-label={t('Watermarks on this photo')}>
     {layers.map(({asset},i) => <button type="button" key={i} aria-pressed={selected === i}
      disabled={busy} onClick={() => setSelected(i)}>{i+1}. {asset?.name ?? t('Watermark')}</button>)}
    </div>
    <div className="admin-watermark-sliders">
     {([
      ['scale','Watermark size',10], ['opacity','Watermark opacity',0],
     ] as const).map(([key,label,min]) => <label key={key}>
      <span>{t(label)} <span aria-hidden="true">{Math.round(mark[key]*100)}%</span></span>
      <input type="range" aria-label={t(label)} aria-valuetext={`${Math.round(mark[key]*100)}%`} min={min} max={100} step={1}
       value={Math.round(mark[key]*100)} disabled={busy} onChange={event => updatePlacement(selected,{[key]:Number(event.target.value)/100})} />
     </label>)}
    </div>
   </>}
   {error && <p className="admin-error" role="alert">{t(error)}</p>}
   <div className="admin-watermark-actions">
    <button type="button" disabled={busy} onClick={onClose}>{t('取消')}</button>
    <button type="button" className="admin-primary" disabled={busy || !drafts.size} onClick={() => void apply()}>
     {busy ? t('Preparing photos…') : drafts.size > 1
      ? t('Apply to {count} photos', {count:drafts.size}) : t('Apply to photo')}
    </button>
   </div>
  </div>
 </WatermarkDialog>
}
