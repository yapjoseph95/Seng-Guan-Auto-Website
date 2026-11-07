import { useLocale, LanguageSelect } from './locale'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CarFront, Check, ImagePlus, LoaderCircle, LogOut, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { VehicleStatus } from './data'
import logo from './assets/logo-dark.svg'
import './Admin.css'
type Photo = { id: string; url: string }
export type ManagedVehicle = {id:string;name:string;make:string;year:number;body:string;fuel:string;transmission:string;price:number|null;mileage:number|null;description:string;status:VehicleStatus;featured:boolean;photos:Photo[];photo:string}
const empty = ():ManagedVehicle => ({id:'',name:'',make:'',year:new Date().getFullYear(),body:'Sedan',fuel:'Petrol',transmission:'Automatic',price:null,mileage:null,description:'',status:'draft',featured:false,photos:[],photo:''})
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
const statuses = { draft: '草稿', available: '在售', reserved: '已保留', sold: '已售' }
const publishedStatuses = ['available', 'reserved', 'sold'] as const
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
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState('all')
 const [updatingStatus,setUpdatingStatus]=useState<string|null>(null)
 const [edit,setEdit]=useState<ManagedVehicle|null>(null)
 const [dirty,setDirty]=useState(false)
 const [confirmDelete,setConfirmDelete]=useState<ManagedVehicle|null>(null)
 const fileInput=useRef<HTMLInputElement>(null)
 const messageRef=useRef<HTMLDivElement>(null)
 const refresh=async()=>{const data=await api<{vehicles:ManagedVehicle[]}>('vehicles');setVehicles(data.vehicles)}
 useEffect(()=>{Promise.all([api<{email:string}>('session').then(s=>setEmail(s.email)),refresh()]).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
 useEffect(()=>{if((error||notice)&&!edit&&!confirmDelete)messageRef.current?.focus()},[error,notice,edit,confirmDelete])
 useEffect(()=>{
  if(!edit&&!confirmDelete)return
  const previous=document.activeElement as HTMLElement|null
  const modal=document.querySelector<HTMLElement>(confirmDelete?'.admin-confirm':'.admin-editor')
  const focusable=()=>Array.from(modal?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')??[]).filter(e=>e.getClientRects().length>0)
  focusable()[0]?.focus()
  const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const nodes=focusable();const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
  document.addEventListener('keydown',trap)
  return()=>{document.removeEventListener('keydown',trap);previous?.focus()}
 },[Boolean(edit),Boolean(confirmDelete)])
 const close=()=>{if(busy)return;if(dirty&&!window.confirm(t('还有未保存的修改，确定离开吗？')))return;setEdit(null);setDirty(false);setError('')}
 const update=(changes:Partial<ManagedVehicle>)=>{setEdit(v=>v?{...v,...changes}:v);setDirty(true)}
 const save=async(e:FormEvent)=>{
  e.preventDefault();if(!edit)return;setBusy('保存中…');setError('');setNotice('')
  try{
   const saved=await api<ManagedVehicle>('vehicles'+(edit.id?'/'+edit.id:''),{method:edit.id?'PUT':'POST',body:JSON.stringify({...edit,photoOrder:edit.photos.map(p=>p.id)})})
   setEdit(saved);setDirty(false);await refresh();setNotice(saved.status==='draft'?'草稿已保存。上传照片后，可选择「在售」并发布。':'已保存，网站将显示最新资料。')
  }catch(e){setError((e as Error).message)}finally{setBusy('')}
 }
 const upload=async(files:FileList|null)=>{
  if(!edit?.id||!files?.length)return
  if(edit.photos.length+files.length>20){setError('每辆车最多 20 张照片。');return}
  if(dirty){setError('请先保存资料和照片顺序，再上传新照片。');return}
  setError('');setNotice('');let latest=edit
  try{
   for(let i=0;i<files.length;i++){
    setUploadProgress({number:i+1,total:files.length});setBusy('处理照片 {number}/{total}…')
    const file=await compress(files[i]);const form=new FormData();form.append('file',file)
    latest=await api<ManagedVehicle>(`vehicles/${edit.id}/photos`,{method:'POST',body:form});setEdit(latest)
   }
   await refresh();setNotice('照片上传完成。第一张照片为封面，可用箭头调整顺序。')
  }catch(e){setError((e as Error).message);await refresh().catch(()=>{})}finally{setBusy('');if(fileInput.current)fileInput.current.value=''}
 }
 const removePhoto=async(photo:Photo)=>{
  if(!edit?.id||!window.confirm(t('删除这张照片？')))return
  if(dirty){setError('请先保存当前修改，再删除照片。');return}
  setBusy('删除照片…');setError('')
  try{setEdit(await api<ManagedVehicle>(`vehicles/${edit.id}/photos/${photo.id}`,{method:'DELETE'}));await refresh()}catch(e){setError((e as Error).message)}finally{setBusy('')}
 }
 const movePhoto=(index:number,delta:number)=>{if(!edit)return;const photos=[...edit.photos];[photos[index],photos[index+delta]]=[photos[index+delta],photos[index]];update({photos})}
 const removeVehicle=async()=>{
  if(!confirmDelete)return;setBusy('删除车辆…');setError('')
  try{await api(`vehicles/${confirmDelete.id}`,{method:'DELETE'});setConfirmDelete(null);if(edit?.id===confirmDelete.id){setEdit(null);setDirty(false)}await refresh();setNotice('车辆已删除。')}catch(e){setError((e as Error).message)}finally{setBusy('')}
 }
 const openEditor = (vehicle: ManagedVehicle) => {
  if (dirty && !window.confirm(t('放弃未保存的修改？'))) return
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
 const visible=vehicles.filter(v=>(filter==='all'||v.status===filter)&&`${v.make} ${v.name} ${v.year}`.toLowerCase().includes(query.toLowerCase()))
 return <div className="inventory-admin">
  <header className="admin-header" inert={Boolean(edit||confirmDelete)}><a href="/admin" aria-label={t("车辆管理首页")}><img src={logo} alt="Seng Guan Auto"/></a><span>{t("车辆管理后台")}</span><div><LanguageSelect /><a href="/" target="_blank" rel="noreferrer">{t("查看网站 ↗")}</a><button onClick={()=>{void fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).then(()=>window.location.assign('/admin'))}}><LogOut size={17}/>{t("退出")}</button></div></header>
  <main className="admin-main" inert={Boolean(edit||confirmDelete)}>
   <div className="admin-title"><div><p>{t("YOUR SHOWROOM, UP TO DATE")}</p><h1>{t("车辆管理")}</h1><span>{email||t('安全登录')}{t("· 更新资料，发布到官网")}</span></div><button className="admin-primary" disabled={!!busy||loading||!email||!!updatingStatus} onClick={() => openEditor(empty())}><Plus size={18}/>{t("新增车辆")}</button></div>
   <div ref={messageRef} tabIndex={-1} className="admin-messages" aria-live="polite">{error&&<p className="admin-error" role="alert">{t(error)}</p>}{notice&&<p className="admin-success"><Check size={17}/>{t(notice)}</p>}</div>
   <div className="admin-stats">{(['all', ...publishedStatuses, 'draft'] as const).map(s=><button key={s} aria-pressed={filter===s} onClick={()=>setFilter(s)}><span>{t(s==='all'?'所有车辆':statuses[s])}</span><strong>{vehicles.filter(v=>s==='all'||v.status===s).length}</strong></button>)}</div>
   <label className="admin-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("搜索品牌、车型或年份")} aria-label={t("搜索车辆")}/></label>
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
  {edit&&<div className="admin-overlay"><section className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="vehicle-editor-title"><div className="admin-editor-heading"><div><p>{t(edit.id?'EDIT VEHICLE':'NEW VEHICLE')}</p><h2 id="vehicle-editor-title">{t(edit.id?'编辑车辆':'新增车辆')}</h2></div><button aria-label={t("关闭编辑")} onClick={close} disabled={!!busy}><X/></button></div>
   <form onSubmit={save}><fieldset disabled={!!busy}>
    <section className="admin-photo-section"><h3>{t("车辆照片")} <span>{edit.photos.length}/20</span></h3><p>{t(edit.id?'第一张为封面。照片上传与删除会即时保存；调整顺序后请点击保存。照片会自动压缩。':'先保存草稿，再上传车辆照片。')}</p>
     <input ref={fileInput} className="admin-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>void upload(e.target.files)}/>
     <button type="button" className="admin-upload" disabled={!edit.id||!!busy} onClick={()=>fileInput.current?.click()}><ImagePlus size={21}/>{t("选择照片上传")}</button>
     <div className="admin-photos">{edit.photos.map((p,i)=><div key={p.id}><img src={p.url} alt={t('车辆照片 {number}',{number:i+1})}/>{i===0&&<span>{t("封面")}</span>}<div><button type="button" aria-label={t('照片 {number} 前移',{number:i+1})} disabled={i===0} onClick={()=>movePhoto(i,-1)}><ArrowLeft size={16}/></button><button type="button" aria-label={t('照片 {number} 后移',{number:i+1})} disabled={i===edit.photos.length-1} onClick={()=>movePhoto(i,1)}><ArrowRight size={16}/></button><button type="button" aria-label={t('删除照片 {number}',{number:i+1})} onClick={()=>void removePhoto(p)}><Trash2 size={16}/></button></div></div>)}</div>
    </section>
    <div className="admin-fields">
     <label className="admin-wide">{t("车型名称")}<input required maxLength={160} value={edit.name} onChange={e=>update({name:e.target.value})} placeholder={t("例如 Toyota Harrier 2.4 G")}/></label>
     <label>{t("品牌")}<input required maxLength={80} value={edit.make} onChange={e=>update({make:e.target.value})} placeholder="Toyota"/></label>
     <label>{t("年份")}<input required type="number" min="1950" max={new Date().getFullYear()+1} value={edit.year} onChange={e=>update({year:Number(e.target.value)})}/></label>
     <label>{t("售价 (RM)")}<VehicleAmountInput value={edit.price} onChange={price => update({ price })} /></label>
     <label>{t("里程 (km)")}<VehicleAmountInput value={edit.mileage} onChange={mileage => update({ mileage })} /></label>
     <label>{t("车身类型")}<select value={edit.body} onChange={e=>update({body:e.target.value})}>{['Sedan','SUV','MPV','Hatchback','Pickup','Coupe','Van','Wagon','Other'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>
     <label>{t("排挡")}<select value={edit.transmission} onChange={e=>update({transmission:e.target.value})}>{['Automatic','Manual'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>
     <label>{t("燃油")}<select value={edit.fuel} onChange={e=>update({fuel:e.target.value})}>{['Petrol','Diesel','Hybrid','Electric','Other'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>
     <label>{t("展示状态")}<select value={edit.status} onChange={e=>update({status:e.target.value as ManagedVehicle['status']})} disabled={!edit.id}>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{t(v)}</option>)}</select></label>
     <label className="admin-wide">{t("车辆介绍")}<textarea rows={4} maxLength={10000} value={edit.description} onChange={e=>update({description:e.target.value})} placeholder={t("车况、配备及其他说明（内容会展示在官网）")}/></label>
     <label className="admin-checkbox admin-wide"><input type="checkbox" checked={edit.featured} onChange={e=>update({featured:e.target.checked})}/>{t("放入首页推荐（仅在售车辆）")}</label>
    </div>
   </fieldset><div className="admin-editor-actions"><span>{busy ? t(busy, uploadProgress ?? undefined) : t(dirty?'有未保存的修改':edit.id?'已保存':'新车辆将先保存为草稿')}</span><button type="button" onClick={close} disabled={!!busy}>{t("返回")}</button><button className="admin-primary" disabled={!!busy} type="submit">{busy?<LoaderCircle size={17} className="admin-spin"/>:<Check size={17}/>}{t(edit.status==='draft'?'保存草稿':'保存并发布')}</button></div>
   {error&&<p className="admin-error" role="alert">{t(error)}</p>}{notice&&<p className="admin-success" role="status">{t(notice)}</p>}
   </form></section></div>}
  {confirmDelete&&<div className="admin-overlay"><section className="admin-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">{t("删除这辆车？")}</h2><p>{confirmDelete.name}{t("的资料和照片将被删除。若只是已售出，请改为「已售」状态。")}</p><div><button disabled={!!busy} onClick={()=>setConfirmDelete(null)}>{t("取消")}</button><button className="admin-primary" disabled={!!busy} onClick={()=>void removeVehicle()}>{t(busy||'确认删除')}</button></div>{error&&<p role="alert">{t(error)}</p>}</section></div>}
 </div>
}
