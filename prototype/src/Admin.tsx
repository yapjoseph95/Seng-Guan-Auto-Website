import { formatPublicationDate } from './vehicle-date'
import { formatMileage, isMileageBand, mileageBands, type MileageBand } from '../shared/vehicle-mileage'
import { useLocale, LanguageSelect } from './locale'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { CarFront, Check, ChevronLeft, ChevronRight, Image, ImagePlus, LoaderCircle, LogOut, Pencil, Plus, Search, Stamp, Trash2, X } from 'lucide-react'
import type { VehicleStatus } from './data'
import logo from './assets/logo-dark.svg'
import AdminPhotoGrid, { type AdminPhoto } from './AdminPhotoGrid'
import { maxPhotoBytes, maxVehiclePhotos } from '../shared/vehicle-photos'
import { PhotoWatermarkEditor, WatermarkLibrary, type WatermarkPhotoChange } from './AdminWatermarks'
import type { WatermarkPlacement } from '../shared/watermarks'
import './Admin.css'
export type ManagedVehicle = {id:string;name:string;make:string;year:number;body:string;fuel:string;transmission:string;price:number|null;mileage:number|null;mileage_band?:MileageBand|null;description:string;status:VehicleStatus;updated_at:string;published_at?:string|null;plate_number?:string|null;featured:boolean;photos:AdminPhoto[];photo:string}
const empty = ():ManagedVehicle => ({id:'',name:'',make:'',year:new Date().getFullYear(),body:'Sedan',fuel:'Petrol',transmission:'Automatic',price:null,mileage:null,mileage_band:null,description:'',status:'available',updated_at:'',plate_number:'',featured:true,photos:[],photo:''})
async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
 const execute=()=>fetch('/api/admin/'+path,{...options,credentials:'same-origin',headers:{...(typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}})
 let response=await execute()
 if(response.status===401){const refreshed=await fetch('/api/auth/refresh',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(refreshed.ok)response=await execute();else{window.dispatchEvent(new Event('admin-session-expired'));throw new Error('请重新登录。')}}
 if(response.status===403||response.redirected)throw new Error('此账号没有权限执行此操作。')
 const data=await response.json().catch(()=>({error:'服务器暂时无法连接，请稍后重试。'}))
 if(!response.ok)throw new Error(data.error||'操作失败，请重试。')
 return data
}
async function compress(file:File) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请使用 JPG、PNG 或 WebP 照片。')
 if(file.size>25*1024*1024)throw new Error('原图不能超过 25 MB。')
 const bitmap=await createImageBitmap(file)
 try {
  const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height))
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器不支持照片处理。')
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('照片处理失败。')),'image/jpeg',.86))
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'})
 } finally { bitmap.close() }
}
function releasePhotos(staged: Map<string, string>, discard = false) {
 for (const [id,url] of staged) {
  URL.revokeObjectURL(url)
  if (discard) discardPhoto(id)
 }
 staged.clear()
}

function discardPhoto(id: string) {
 void api(`staged-photos/${id}`,{method:'DELETE'}).catch(() => {})
}

type PreviewGalleryProps = {
 photos: AdminPhoto[]
 index: number
 onSelect: (id: string) => void
 onWatermark: (photo: AdminPhoto) => void
 onRemove: (photo: AdminPhoto) => void
 busy: boolean
}

function PreviewGallery({ photos, index, onSelect, onWatermark, onRemove, busy }: PreviewGalleryProps) {
 const { t } = useLocale()
 const thumbnails = useRef<HTMLDivElement>(null)
 const photo = photos[index]

 useEffect(() => {
  const strip = thumbnails.current
  const current = strip?.children[index] as HTMLButtonElement | undefined
  if (!strip || !current) return
  const start = current.offsetLeft
  const end = start + current.offsetWidth
  if (start < strip.scrollLeft) strip.scrollLeft = start
  else if (end > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = end - strip.clientWidth
 }, [index, photos.length])

 if (!photo) return <div className="admin-photo-preview-empty">
  <Image size={32} aria-hidden="true" />{t('添加照片后可预览。')}
 </div>

 const move = (offset: number) => onSelect(photos[(index + offset + photos.length) % photos.length].id)

 return <div className="admin-preview-gallery">
  <div className="admin-preview-frame">
   <img className="admin-preview-image" src={photo.url} alt={t('车辆照片 {number}', { number: index + 1 })} draggable={false} />
   {photos.length > 1 && <>
    <button type="button" className="admin-preview-edge admin-preview-edge--previous"
     aria-label={t('Previous photo')} onClick={() => move(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
    <button type="button" className="admin-preview-edge admin-preview-edge--next"
     aria-label={t('Next photo')} onClick={() => move(1)}><ChevronRight size={20} aria-hidden="true" /></button>
   </>}
  </div>
  <div className="admin-preview-controls">
   <div>
    {photos.length > 1 && <button type="button" aria-label={t('Previous photo')} onClick={() => move(-1)}>
     <ChevronLeft size={20} aria-hidden="true" />
    </button>}
    <span aria-live="polite">{index + 1} / {photos.length}</span>
    {photos.length > 1 && <button type="button" aria-label={t('Next photo')} onClick={() => move(1)}>
     <ChevronRight size={20} aria-hidden="true" />
    </button>}
   </div>
   <div>
    <button type="button" aria-label={t('Edit watermark for photo {number}', { number:index + 1 })}
     data-watermarked={!!photo.watermark} disabled={busy} onClick={() => onWatermark(photo)}>
     <Stamp size={18} aria-hidden="true" />
    </button>
    <button type="button" aria-label={t('删除照片 {number}', { number:index + 1 })}
     className="admin-preview-delete" disabled={busy} onClick={() => onRemove(photo)}>
     <Trash2 size={18} aria-hidden="true" />
    </button>
   </div>
  </div>
  <div className="admin-preview-thumbnails" ref={thumbnails}>
   {photos.map((item, position) => <button key={item.id} type="button"
    aria-label={t('预览照片 {number}', { number: position + 1 })}
    aria-current={position === index ? 'true' : undefined} onClick={() => onSelect(item.id)}>
    <img src={item.url} alt="" draggable={false} />
   </button>)}
  </div>
 </div>
}

function PhotoPreview({ mobileOpen, onClose, ...gallery }: PreviewGalleryProps & {
 mobileOpen: boolean
 onClose: () => void
}) {
 const { t } = useLocale()
 const dialog = useRef<HTMLDialogElement>(null)
 useEffect(() => {
  const element = dialog.current
  if (mobileOpen && element && !element.open) element.showModal()
  if (!mobileOpen && element?.open) element.close()
 }, [mobileOpen])

 return <>
  <aside className="admin-photo-preview" aria-label={t('照片预览')}>
   <h3>{t('照片预览')}</h3>
   <PreviewGallery {...gallery} />
  </aside>
  <dialog ref={dialog} className="admin-mobile-photo-preview" aria-label={t('照片预览')} onClose={onClose}
   onClick={event => { if (event.target === event.currentTarget) onClose() }}>
   <header><span>{t('照片预览')}</span>
    <button type="button" aria-label={t('关闭照片预览')} onClick={onClose}><X size={20} aria-hidden="true" /></button>
   </header>
   {mobileOpen && <PreviewGallery {...gallery} />}
  </dialog>
 </>
}

const statuses = { draft: '草稿', available: '在售', reserved: '已保留', sold: '已售' }
const publishedStatuses = ['available', 'reserved', 'sold'] as const
const editorStatuses = [...publishedStatuses, 'draft'] as const
const commonMakes = [
 'Audi', 'BMW', 'BYD', 'Chery', 'Ford', 'GWM', 'Honda', 'Hyundai', 'Isuzu', 'Jaecoo',
 'Kia', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG', 'MINI', 'Mitsubishi', 'Nissan',
 'Perodua', 'Peugeot', 'Porsche', 'Proton', 'Subaru', 'Suzuki', 'Toyota', 'Volkswagen', 'Volvo',
]
const amountFormat = new Intl.NumberFormat('en-MY')

function VehicleAmountInput({ value, onChange }: {
 value: number | null
 onChange: (value: number | null) => void
}) {
 const change = (event: ChangeEvent<HTMLInputElement>) => {
  const input = event.currentTarget
  const digits = input.value.replace(/[,\s]/g, '')
  if (!/^\d{0,9}$/.test(digits)) return
  const digitOffset = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, '').length
  const next = digits ? Number(digits) : null
  const formatted = next === null ? '' : amountFormat.format(next)
  let caret = 0
  for (let remaining = digitOffset; caret < formatted.length && remaining > 0; caret++) {
   if (formatted[caret] !== ',') remaining--
  }
  onChange(next)
  requestAnimationFrame(() => {
   if (document.activeElement === input && input.value === formatted) input.setSelectionRange(caret, caret)
  })
 }

 return <input
  type="text"
  inputMode="numeric"
  value={value === null ? '' : amountFormat.format(value)}
  onChange={change}
  onKeyDown={(event) => {
   const input = event.currentTarget
   const caret = input.selectionStart
   if (caret === null || caret !== input.selectionEnd) return
   if (event.key === 'Backspace' && input.value[caret - 1] === ',') input.setSelectionRange(caret - 1, caret - 1)
   if (event.key === 'Delete' && input.value[caret] === ',') input.setSelectionRange(caret + 1, caret + 1)
  }}
 />
}
export default function Admin() {
  const { t, locale } = useLocale()
 const [vehicles,setVehicles]=useState<ManagedVehicle[]>([])
 const [email,setEmail]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [uploadProgress,setUploadProgress]=useState<{number:number;total:number}|null>(null)
 const processingPhotos = busy === '处理照片 {number}/{total}…' || busy === '上传照片 {number}/{total}…'
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState('all')
 const [updatingStatus,setUpdatingStatus]=useState<string|null>(null)
 const [edit,setEdit]=useState<ManagedVehicle|null>(null)
 const [dirty,setDirty]=useState(false)
 const [libraryOpen,setLibraryOpen]=useState(false)
 const [watermarkPhotoId,setWatermarkPhotoId]=useState<string | null>(null)
 const watermarkPhoto = edit?.photos.find(photo => photo.id === watermarkPhotoId)
 const watermarkChanges = useRef(new Map<string, {placements:WatermarkPlacement[]; render?:Blob; url?:string}>())
 const clearWatermarkChanges = () => {
  for (const {url} of watermarkChanges.current.values()) if (url) URL.revokeObjectURL(url)
  watermarkChanges.current.clear()
 }
 const applyWatermarks = (changes: ReadonlyMap<string,WatermarkPhotoChange>) => {
  if (!edit) return
  const photos = edit.photos.map(photo => {
   const change = changes.get(photo.id)
   if (!change) return photo
   const original = photo.original_url ?? photo.url
   const previousUrl = watermarkChanges.current.get(photo.id)?.url
   const url = change.render ? URL.createObjectURL(change.render) : undefined
   if (previousUrl) URL.revokeObjectURL(previousUrl)
   watermarkChanges.current.set(photo.id,{...change,url})
   return {...photo,original_url:original,watermark:change.placements[0] ?? null,watermarks:change.placements,url:url ?? original}
  })
  update({photos})
  setWatermarkPhotoId(null)
 }
 const [previewId,setPreviewId]=useState<string | null>(null)
 const [mobilePreviewOpen,setMobilePreviewOpen]=useState(false)
 const previewPhoto = edit?.photos.find(photo => photo.id === previewId) ?? edit?.photos[0]
 const previewNumber = edit?.photos.findIndex(photo => photo.id === previewPhoto?.id) ?? -1
 const [confirmDelete,setConfirmDelete]=useState<ManagedVehicle|null>(null)
 const fileInput=useRef<HTMLInputElement>(null)
 const stagedPhotos=useRef(new Map<string, string>())
 const originalVehicle=useRef<{updatedAt:string; photoOrder:string[]; createId:string} | null>(null)
 useEffect(() => {
  const staged = stagedPhotos.current
  const changes = watermarkChanges.current
  return () => {
   releasePhotos(staged)
   for (const {url} of changes.values()) if (url) URL.revokeObjectURL(url)
   changes.clear()
  }
 }, [])
 const messageRef=useRef<HTMLDivElement>(null)
 const refresh=async()=>{const data=await api<{vehicles:ManagedVehicle[]}>('vehicles');setVehicles(data.vehicles)}
 useEffect(()=>{Promise.all([api<{email:string}>('session').then(s=>setEmail(s.email)),refresh()]).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
 useEffect(()=>{if(error&&!edit&&!confirmDelete)messageRef.current?.focus()},[error,edit,confirmDelete])
 useEffect(() => {
  if (!notice) return
  const timeout = window.setTimeout(() => setNotice(''), 4000)
  return () => window.clearTimeout(timeout)
 }, [notice])
 useEffect(()=>{
  if(!edit&&!confirmDelete)return
  const previous=document.activeElement as HTMLElement|null
  const modal=document.querySelector<HTMLElement>(confirmDelete?'.admin-confirm':'.admin-edit-dialog')
  const focusable=()=>Array.from(modal?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')??[]).filter(e=>e.getClientRects().length>0)
  focusable()[0]?.focus()
  const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab'||modal?.querySelector('dialog[open]'))return;const nodes=focusable();const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
  document.addEventListener('keydown',trap)
  return()=>{document.removeEventListener('keydown',trap);previous?.focus()}
 },[Boolean(edit),Boolean(confirmDelete)])
 const close = () => {
  if (busy || (dirty && !window.confirm(t('还有未保存的修改，确定离开吗？')))) return
  releasePhotos(stagedPhotos.current,true)
  clearWatermarkChanges()
  setEdit(null)
  setDirty(false)
  setError('')
 }
 const update=(changes:Partial<ManagedVehicle>)=>{setEdit(v=>v?{...v,...changes}:v);setDirty(true)}
 const save = async (event: FormEvent) => {
  event.preventDefault()
  const original = originalVehicle.current
  if (!edit || !original || busy) return
  if (edit.status !== 'draft' && !edit.photos.length) {
   setError('Upload at least one photo before publishing.')
   return
  }
  setBusy('保存中…')
  setError('')
  setNotice('')
  const { photos, photo: _cover, ...details } = edit
  const form = new FormData()
  const watermarks: Record<string,WatermarkPlacement[]> = {}
  for (const photo of photos) {
   const change = watermarkChanges.current.get(photo.id)
   if (!change) continue
   watermarks[photo.id] = change.placements
   if (change.render) form.set('watermark:'+photo.id,change.render,'watermarked.jpg')
  }
  form.set('vehicle',JSON.stringify({
   ...details, updatedAt:original.updatedAt, originalPhotoOrder:original.photoOrder,
   createId:original.createId, photoOrder:photos.map(photo => photo.id), watermarks,
  }))
  try {
   const saved = await api<ManagedVehicle>('vehicles' + (edit.id ? '/' + edit.id : ''), {
    method: edit.id ? 'PUT' : 'POST', body: form,
   })
   releasePhotos(stagedPhotos.current)
   clearWatermarkChanges()
   setEdit(null)
   setDirty(false)
   setVehicles(current => edit.id ? current.map(vehicle => vehicle.id === saved.id ? saved : vehicle) : [saved,...current])
   setNotice(saved.status === 'draft' ? '草稿已保存。' : '已保存，网站将显示最新资料。')
  } catch (error) {
   setError((error as Error).message)
  } finally {
   setBusy('')
  }
 }
 const selectPhotos = async (files: FileList | null) => {
  if (!edit || !files?.length || busy) return
  const selected = Array.from(files)
  if (fileInput.current) fileInput.current.value = ''
  if (edit.photos.length + selected.length > maxVehiclePhotos) {
   setError('每辆车最多 20 张照片。')
   return
  }
  setError('')
  setNotice('')
  try {
   for (const [index, file] of selected.entries()) {
    setUploadProgress({ number:index + 1, total:selected.length })
    setBusy('处理照片 {number}/{total}…')
    const photo = await compress(file)
    if (photo.size > maxPhotoBytes) throw new Error('Please upload a JPEG, PNG or WebP photo under 7 MB.')
    const id = crypto.randomUUID()
    const form = new FormData()
    form.set('file',photo)
    setBusy('上传照片 {number}/{total}…')
    await api(`staged-photos/${id}`,{method:'POST',body:form})
    const url = URL.createObjectURL(photo)
    stagedPhotos.current.set(id,url)
    setEdit(vehicle => vehicle ? { ...vehicle, photos:[...vehicle.photos,{id,url}] } : vehicle)
    setDirty(true)
   }
  } catch (error) {
   setError((error as Error).message)
  } finally {
   setBusy('')
  }
 }
 const removePhoto = (photo: AdminPhoto) => {
  if (!edit || busy || !window.confirm(t('删除这张照片？'))) return
  const staged = stagedPhotos.current.get(photo.id)
  if (staged) {
   URL.revokeObjectURL(staged)
   stagedPhotos.current.delete(photo.id)
   discardPhoto(photo.id)
  }
  const rendered = watermarkChanges.current.get(photo.id)?.url
  if (rendered) URL.revokeObjectURL(rendered)
  watermarkChanges.current.delete(photo.id)
  const remaining = edit.photos.filter(item => item.id !== photo.id)
  if (previewPhoto?.id === photo.id) {
   setPreviewId((remaining[previewNumber] ?? remaining.at(-1))?.id ?? null)
  }
  update({ photos:remaining })
  setError('')
  setNotice('')
 }
 const removeVehicle=async()=>{
  if(!confirmDelete)return;setBusy('删除车辆…');setError('')
  try{await api(`vehicles/${confirmDelete.id}`,{method:'DELETE'});setConfirmDelete(null);if(edit?.id===confirmDelete.id){setEdit(null);setDirty(false)}await refresh();setNotice('车辆已删除。')}catch(e){setError((e as Error).message)}finally{setBusy('')}
 }
 const openEditor = (vehicle: ManagedVehicle) => {
  if (dirty && !window.confirm(t('放弃未保存的修改？'))) return
  releasePhotos(stagedPhotos.current)
  originalVehicle.current = { updatedAt:vehicle.updated_at, photoOrder:vehicle.photos.map(photo => photo.id), createId:crypto.randomUUID() }
  setPreviewId(null)
  setWatermarkPhotoId(null)
  setMobilePreviewOpen(false)
  setEdit({ ...vehicle, photos: [...vehicle.photos] })
  setDirty(false)
  setError('')
  setNotice('')
 }
 const changeStatus = async (vehicle: ManagedVehicle, status: typeof publishedStatuses[number]) => {
  setUpdatingStatus(vehicle.id)
  setError('')
  setNotice('')
  try {
   const saved = await api<ManagedVehicle>(`vehicles/${vehicle.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
   setVehicles(current => current.map(item => item.id === saved.id ? saved : item))
  } catch (error) {
   setError((error as Error).message)
  } finally {
   setUpdatingStatus(null)
  }
 }
 const search = query.trim().toLowerCase()
 const plateQuery = search.replace(/[\s-]+/g,'')
 const visible = vehicles.filter(vehicle => {
  if (filter !== 'all' && vehicle.status !== filter) return false
  const details = `${vehicle.make} ${vehicle.name} ${vehicle.year}`.toLowerCase()
  const plate = vehicle.plate_number?.toLowerCase().replace(/[\s-]+/g,'')
  return details.includes(search) || (plateQuery && plate?.includes(plateQuery))
 })
 return <div className="inventory-admin">
  <header className="admin-header" inert={Boolean(edit||confirmDelete)}><a href="/admin" aria-label={t("车辆管理首页")}><img src={logo} alt="Seng Guan Auto"/></a><span>{t("车辆管理后台")}</span><div><LanguageSelect /><a href="/" target="_blank" rel="noreferrer">{t("查看网站 ↗")}</a><button onClick={()=>{void fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).then(()=>window.location.assign('/admin'))}}><LogOut size={17}/>{t("退出")}</button></div></header>
  <main className="admin-main" inert={Boolean(edit||confirmDelete)}>
   <div className="admin-title"><div><p>{t("YOUR SHOWROOM, UP TO DATE")}</p><h1>{t("车辆管理")}</h1><span>{email||t('安全登录')}{t("· 更新资料，发布到官网")}</span></div><div className="admin-title-actions"><button type="button" disabled={loading||!email} onClick={() => setLibraryOpen(true)}><Stamp size={17} aria-hidden="true"/>{t('Watermark settings')}</button><button className="admin-primary" disabled={!!busy||loading||!email||!!updatingStatus} onClick={() => openEditor(empty())}><Plus size={18}/>{t("新增车辆")}</button></div></div>
   <div ref={messageRef} tabIndex={-1} className="admin-messages" aria-live="polite">{error&&<p className="admin-error" role="alert">{t(error)}</p>}</div>
   <div className="admin-stats">{(['all', ...publishedStatuses, 'draft'] as const).map(s=><button key={s} aria-pressed={filter===s} onClick={()=>setFilter(s)}><span>{t(s==='all'?'所有车辆':statuses[s])}</span><strong>{vehicles.filter(v=>s==='all'||v.status===s).length}</strong></button>)}</div>
   <label className="admin-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Search make, model, year or plate")} aria-label={t("搜索车辆")}/></label>
   {loading ? <p className="admin-empty"><LoaderCircle className="admin-spin" />{t('正在载入车辆…')}</p> : (
    <div className="admin-list">
     {visible.map(vehicle => (
      <article key={vehicle.id} className="admin-car">
       <div className="admin-car-photo">
        {vehicle.photo ? <img src={vehicle.photo} alt={vehicle.name} /> : <CarFront aria-hidden="true" />}
        <span className={`admin-status admin-status--${vehicle.status}`}>{t(statuses[vehicle.status])}</span>
       </div>
       <button type="button" className="admin-card-edit" disabled={!!updatingStatus}
        aria-label={t('编辑 {name}', { name: vehicle.name })} title={t('编辑资料')}
        onClick={() => openEditor(vehicle)}>
        <span className="admin-card-icon"><Pencil size={17} aria-hidden="true" /></span>
       </button>
       <button type="button" className="admin-card-icon admin-card-delete" disabled={!!updatingStatus}
        aria-label={t('删除 {name}', { name: vehicle.name })} title={t('删除 {name}', { name: vehicle.name })}
        onClick={() => setConfirmDelete(vehicle)}>
        <Trash2 size={17} aria-hidden="true" />
       </button>
       <div className="admin-car-copy">
        <p>{vehicle.year} · {vehicle.make}{vehicle.featured && vehicle.status === 'available' ? ' · ' + t('首页推荐') : ''}</p>
        <h2>{vehicle.name}</h2>
        {vehicle.plate_number&&<p>{vehicle.plate_number}</p>}
        <span>{vehicle.price === null ? t('售价未填写') : 'RM ' + vehicle.price.toLocaleString(locale)} · {t(
         vehicle.photos.length === 1 ? '{count} 张照片（单张）' : '{count} 张照片', { count: vehicle.photos.length },
        )}</span>
        <fieldset className="admin-status-control"
         aria-label={t('车辆状态：{name}', { name: vehicle.name })}
         aria-busy={updatingStatus === vehicle.id}
         data-status={vehicle.status}
         disabled={!vehicle.photos.length || !!updatingStatus}>
         {publishedStatuses.map(status => (
          <label key={status}>
           <input type="radio" name={`vehicle-status-${vehicle.id}`} value={status}
            checked={vehicle.status === status} onChange={() => void changeStatus(vehicle, status)} />
           <span>{t(statuses[status])}</span>
          </label>
         ))}
        </fieldset>
        {!vehicle.photos.length && <p className="admin-status-hint">{t('Upload at least one photo before publishing.')}</p>}
       </div>
      </article>
     ))}
    </div>
   )}
   {!loading&&!visible.length&&<div className="admin-empty"><CarFront size={32}/><h2>{t(query?'没有找到这辆车':'这里将展示你的车辆')}</h2><p>{t(query?'试试其他车型或品牌。':'点击「新增车辆」，填写资料并上传照片。')}</p></div>}
  </main>
  <div className="admin-toast" role="status">
   {notice&&<p className="admin-success"><Check size={17} aria-hidden="true"/>{t(notice)}</p>}
  </div>
  {edit&&<div className="admin-overlay"><div className="admin-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-editor-title">
   <PhotoPreview photos={edit.photos} index={previewNumber} onSelect={setPreviewId} busy={!!busy}
    onWatermark={photo => setWatermarkPhotoId(photo.id)} onRemove={removePhoto} mobileOpen={mobilePreviewOpen} onClose={() => setMobilePreviewOpen(false)} />
   <section className="admin-editor"><div className="admin-editor-heading"><div><p>{t(edit.id?'EDIT VEHICLE':'NEW VEHICLE')}</p><h2 id="vehicle-editor-title">{t(edit.id?'编辑车辆':'新增车辆')}</h2></div><button aria-label={t("关闭编辑")} onClick={close} disabled={!!busy}><X/></button></div>
   <form onSubmit={save}><fieldset disabled={!!busy}>
    <section className="admin-photo-section"><h3>{t("车辆照片")} <span>{edit.photos.length}/{maxVehiclePhotos}</span></h3><p>{t('选好照片后会立即上传。拖动可调整顺序，第一张为封面。保存后，照片和车辆资料会一起更新到官网。')}</p>
     <input ref={fileInput} className="admin-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>void selectPhotos(e.target.files)}/>
     <AdminPhotoGrid photos={edit.photos} previewedId={previewPhoto?.id}
      onPreview={photo => {
       setPreviewId(photo.id)
       if (window.matchMedia('(max-width: 760px)').matches) setMobilePreviewOpen(true)
      }}
      onReorder={photos => { if (!busy) update({ photos }) }} onRemove={removePhoto} onWatermark={photo => setWatermarkPhotoId(photo.id)}>
      <button type="button" className="admin-upload" aria-label={t("选择照片上传")}
       disabled={!!busy || edit.photos.length >= maxVehiclePhotos} onClick={()=>fileInput.current?.click()}>
       <ImagePlus size={28} aria-hidden="true" />
      </button>
     </AdminPhotoGrid>
     {processingPhotos && uploadProgress && <div className="admin-photo-upload-status" role="status">
      <LoaderCircle size={18} className="admin-spin" aria-hidden="true" />
      <span>{t(busy,uploadProgress)}</span>
      <span className="admin-photo-upload-track" aria-hidden="true" />
     </div>}
    </section>
    <div className="admin-fields">
     {edit.published_at&&<p className="admin-wide admin-published-date">{t('Published {date}', { date:formatPublicationDate(edit.published_at,locale) })}</p>}
     <label className="admin-wide">{t("车型名称")}<input required maxLength={160} value={edit.name} onChange={e=>update({name:e.target.value})} placeholder={t("例如 Toyota Harrier 2.4 G")}/></label>
     <label>{t("品牌")}
      <input list="admin-makes" required maxLength={80} value={edit.make}
       onChange={e=>update({make:e.target.value})} placeholder="Toyota" autoComplete="off" />
      <datalist id="admin-makes">
       {[...new Set([...commonMakes,...vehicles.map(vehicle => vehicle.make)])].sort().map(make => <option key={make} value={make} />)}
      </datalist>
     </label>
     <label>{t("年份")}<input required type="number" min="1950" max={new Date().getFullYear()+1} value={edit.year} onChange={e=>update({year:Number(e.target.value)})}/></label>
     <label className="admin-wide">{t('Plate number (internal only)')}
      <input value={edit.plate_number ?? ''} maxLength={32} autoComplete="off" onChange={e=>update({plate_number:e.target.value})} />
     </label>
     <label>{t("售价 (RM)")}<VehicleAmountInput value={edit.price} onChange={price => update({ price })} /></label>
     <label>{t("里程 (km)")}
      <select value={edit.mileage_band ?? (edit.mileage == null ? '' : 'exact')} onChange={e => {
       const value = Number(e.target.value)
       if (e.target.value !== 'exact') update({ mileage:null, mileage_band:isMileageBand(value) ? value : null })
      }}>
       <option value="">{t('选择里程范围')}</option>
       {edit.mileage != null && <option value="exact">{formatMileage(edit.mileage,null,locale)}</option>}
       {mileageBands.map(band => <option key={band} value={band}>{formatMileage(null,band,locale)}</option>)}
      </select>
     </label>
     <label>{t("车身类型")}<select value={edit.body} onChange={e=>update({body:e.target.value})}>{['Sedan','SUV','MPV','Hatchback','Pickup','Coupe','Van','Wagon','Other'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>
     <label>{t("排挡")}<select value={edit.transmission} onChange={e=>update({transmission:e.target.value})}>{['Automatic','Manual'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>
     <label>{t("燃油")}<select value={edit.fuel} onChange={e=>update({fuel:e.target.value})}>{['Petrol','Diesel','Hybrid','Electric','Other'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>
     <div className="admin-wide admin-editor-status">
      <span id="editor-status-label">{t("展示状态")}</span>
      <fieldset className="admin-status-control admin-status-control--editor" aria-labelledby="editor-status-label" data-status={edit.status}>
       {editorStatuses.map(status => <label key={status}>
        <input type="radio" name="editor-vehicle-status" value={status}
         checked={edit.status === status} onChange={() => update({status})} />
        <span>{t(statuses[status])}</span>
       </label>)}
      </fieldset>
     </div>
     <label className="admin-wide">{t("车辆介绍")}<textarea rows={4} maxLength={10000} value={edit.description} onChange={e=>update({description:e.target.value})} placeholder={t("车况、配备及其他说明（内容会展示在官网）")}/></label>
     <label className="admin-checkbox admin-wide"><input type="checkbox" checked={edit.featured} onChange={e=>update({featured:e.target.checked})}/>{t("放入首页推荐（仅在售车辆）")}</label>
    </div>
   </fieldset><div className="admin-editor-actions"><span>{busy ? t(busy, uploadProgress ?? undefined) : t(dirty?'有未保存的修改':edit.id?'已保存':'尚未保存')}</span><button type="button" onClick={close} disabled={!!busy}>{t("取消")}</button><button className="admin-primary" disabled={!!busy} type="submit">{busy?<LoaderCircle size={17} className="admin-spin"/>:<Check size={17}/>}{t(edit.status==='draft'?'保存草稿':'保存并发布')}</button></div>
   {error&&<p className="admin-error" role="alert">{t(error)}</p>}
   </form></section>
   {watermarkPhoto && <PhotoWatermarkEditor photos={edit.photos} photo={watermarkPhoto} onSelect={setWatermarkPhotoId}
    request={api} onApply={applyWatermarks} onClose={() => setWatermarkPhotoId(null)} />}
   </div></div>}
  {libraryOpen && <WatermarkLibrary request={api} onClose={() => setLibraryOpen(false)} />}
  {confirmDelete&&<div className="admin-overlay"><section className="admin-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">{t("删除这辆车？")}</h2><p>{confirmDelete.name}{t("的资料和照片将被删除。若只是已售出，请改为「已售」状态。")}</p><div><button disabled={!!busy} onClick={()=>setConfirmDelete(null)}>{t("取消")}</button><button className="admin-primary" disabled={!!busy} onClick={()=>void removeVehicle()}>{t(busy||'确认删除')}</button></div>{error&&<p role="alert">{t(error)}</p>}</section></div>}
 </div>
}
