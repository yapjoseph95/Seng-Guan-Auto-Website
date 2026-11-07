import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { Upload, X } from 'lucide-react'
import type { WatermarkAsset, WatermarkPlacement } from '../shared/watermarks'
import { maxPhotoBytes } from '../shared/vehicle-photos'
import { useLocale } from './locale'

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

export async function renderWatermark(photoUrl: string, asset: WatermarkAsset, placement: WatermarkPlacement) {
 const photo = await imageBitmap(photoUrl)
 try {
  const mark = await imageBitmap(asset.url)
  try {
   const canvas = document.createElement('canvas')
   const scale = Math.min(1,2000 / Math.max(photo.width,photo.height))
   canvas.width = Math.max(1,Math.round(photo.width * scale))
   canvas.height = Math.max(1,Math.round(photo.height * scale))
   const context = canvas.getContext('2d')
   if (!context) throw new Error('照片处理失败。')
   context.drawImage(photo,0,0,canvas.width,canvas.height)
   const bounds = watermarkBounds(canvas,mark,placement)
   context.globalAlpha = placement.opacity
   context.drawImage(mark,bounds.x,bounds.y,bounds.width,bounds.height)
   return await new Promise<Blob>((resolve,reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('照片处理失败。')), 'image/jpeg', .86))
  } finally { mark.close() }
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

export function PhotoWatermarkEditor({ photoUrl, initial, request, onApply, onClose }: {
 photoUrl: string; initial: WatermarkPlacement | null; request: WatermarkRequest
 onApply: (placement: WatermarkPlacement | null, render?: Blob) => void; onClose: () => void
}) {
 const { t } = useLocale()
 const [assets,setAssets] = useState<WatermarkAsset[] | null>(null)
 const [mark,setMark] = useState(initial)
 const [photoSize,setPhotoSize] = useState<Size>()
 const [assetSize,setAssetSize] = useState<(Size & {id:string})>()
 const [busy,setBusy] = useState(false)
 const [error,setError] = useState('')
 const stage = useRef<HTMLDivElement>(null)
 const drag = useRef<{left:number;top:number;x:number;y:number;travelX:number;travelY:number} | null>(null)
 const asset = assets?.find(asset => asset.id === mark?.watermarkId)
 const bounds = mark && photoSize && assetSize && assetSize.id === asset?.id
  ? watermarkBounds(photoSize,assetSize,mark) : null

 useEffect(() => {
  let active = true
  request<{watermarks:WatermarkAsset[]}>('watermarks')
   .then(data => { if (active) setAssets(data.watermarks) })
   .catch(error => { if (active) setError((error as Error).message) })
  return () => { active = false }
 }, [request])

 const setPlacement = (change: Partial<WatermarkPlacement>) =>
  setMark(previous => previous && {...previous,...change})

 const startDrag = (event: PointerEvent<HTMLImageElement>) => {
  if (!mark || !stage.current || busy || event.button !== 0) return
  const frame = stage.current.getBoundingClientRect()
  const overlay = event.currentTarget.getBoundingClientRect()
  drag.current = {left:event.clientX,top:event.clientY,x:mark.x,y:mark.y,
   travelX:frame.width-overlay.width,travelY:frame.height-overlay.height}
  event.currentTarget.setPointerCapture(event.pointerId)
 }

 const moveDrag = (event: PointerEvent<HTMLImageElement>) => {
  const start = drag.current
  if (!start) return
  setPlacement({
   x:start.travelX > 0 ? clamp(start.x + (event.clientX - start.left) / start.travelX) : start.x,
   y:start.travelY > 0 ? clamp(start.y + (event.clientY - start.top) / start.travelY) : start.y,
  })
 }

 const apply = async () => {
  if (!mark) { onApply(null); return }
  if (!asset || !bounds || busy) return
  setError('')
  setBusy(true)
  try {
   const render = await renderWatermark(photoUrl,asset,mark)
   if (render.size > maxPhotoBytes) throw new Error('照片处理失败。')
   onApply(mark,render)
  } catch (error) {
   setError((error as Error).message)
   setBusy(false)
  }
 }

 return <WatermarkDialog title={t('Edit photo watermark')} busy={busy} onClose={onClose}>
  <div className="admin-watermark-stage" ref={stage}>
   <img className="admin-watermark-base" src={photoUrl} alt={t('照片预览')} draggable={false}
    onLoad={event => setPhotoSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}
    onError={() => setError('Could not load the image.')} />
   {asset && <img key={asset.id} className="admin-watermark-mark" src={asset.url} alt="" draggable={false}
    onLoad={event => setAssetSize({id:asset.id,width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}
    onError={() => setError('Could not load the image.')}
    onPointerDown={startDrag} onPointerMove={moveDrag} onLostPointerCapture={() => { drag.current = null }}
    style={bounds && photoSize ? {width:`${bounds.width/photoSize.width*100}%`,left:`${bounds.x/photoSize.width*100}%`,top:`${bounds.y/photoSize.height*100}%`,opacity:mark?.opacity} : {visibility:'hidden'}} />}
  </div>
  <div className="admin-watermark-controls">
   <label>{t('Watermark')}<select value={mark?.watermarkId ?? ''} disabled={busy || !assets}
    onChange={event => {
     const watermarkId = event.target.value
     setError('')
     setMark(previous => watermarkId ? {...(previous ?? {x:.95,y:.95,scale:.28,opacity:.8}),watermarkId} : null)
    }}>
    <option value="">{t('No watermark')}</option>
    {assets?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>
   {assets?.length === 0 && <p>{t('Add a watermark in Watermark settings first.')}</p>}
   {mark && <div className="admin-watermark-sliders">
    {([
     ['scale','Watermark size',10], ['opacity','Watermark opacity',0],
    ] as const).map(([key,label,min]) => <label key={key}>
     <span>{t(label)} <span aria-hidden="true">{Math.round(mark[key]*100)}%</span></span>
     <input type="range" aria-label={t(label)} aria-valuetext={`${Math.round(mark[key]*100)}%`} min={min} max={100} step={1} value={Math.round(mark[key]*100)} disabled={busy}
      onChange={event => setPlacement({[key]:Number(event.target.value)/100})} />
    </label>)}
   </div>}
   {error && <p className="admin-error" role="alert">{t(error)}</p>}
   <div className="admin-watermark-actions">
    <button type="button" disabled={busy} onClick={onClose}>{t('取消')}</button>
    <button type="button" className="admin-primary" disabled={busy || (!!mark && !bounds)} onClick={() => void apply()}>
     {t(busy ? 'Preparing watermark…' : 'Apply to photo')}
    </button>
   </div>
  </div>
 </WatermarkDialog>
}
