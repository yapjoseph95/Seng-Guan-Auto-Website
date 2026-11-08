import { useEffect, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import AdminSettingsDialog from './AdminSettingsDialog'
import { useLocale } from './locale'
import { vehicleTemplateLanguages, vehicleTemplateMaxLength, type VehicleTemplate } from '../shared/vehicle-template'

export default function AdminVehicleTemplate({ request, onClose, onSaved }: {
 request: <T>(path:string, options?:RequestInit)=>Promise<T>
 onClose: ()=>void
 onSaved: ()=>void
}) {
 const { t } = useLocale()
 const [content,setContent] = useState<VehicleTemplate | null>(null)
 const [saving,setSaving] = useState(false)
 const [error,setError] = useState('')
 useEffect(() => {
  const controller = new AbortController()
  request<VehicleTemplate>('vehicle-template',{signal:controller.signal})
   .then(value => { if (!controller.signal.aborted) setContent(value) })
   .catch(error => { if (!controller.signal.aborted) setError(error.message) })
  return () => controller.abort()
 },[request])
 return <AdminSettingsDialog title={t('Vehicle Template')} className="admin-template-dialog" busy={saving} onClose={onClose}>
  <p>{t('These defaults are copied into new vehicles. Each vehicle can have its own wording.')}</p>
  {content ? <form className="admin-template-form" onSubmit={async event => {
   event.preventDefault()
   setSaving(true)
   setError('')
   try {
    await request<VehicleTemplate>('vehicle-template',{method:'PUT',body:JSON.stringify(content)})
    onSaved()
   } catch (error) {
    setError((error as Error).message)
   } finally {
    setSaving(false)
   }
  }}>
   {vehicleTemplateLanguages.map(({id,label}) => <label key={id}>{label}
    <textarea lang={id} rows={4} maxLength={vehicleTemplateMaxLength} disabled={saving} value={content[id]}
     onChange={event => setContent({...content,[id]:event.target.value})} />
   </label>)}
   <div className="admin-template-actions">
    <button type="button" disabled={saving} onClick={onClose}>{t('取消')}</button>
    <button type="submit" className="admin-primary" disabled={saving}>
     {saving ? <LoaderCircle size={17} className="admin-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
     {t('Save template')}
    </button>
   </div>
  </form> : !error && <p role="status">{t('Loading template…')}</p>}
  {error && <p className="admin-error" role="alert">{t(error)}</p>}
 </AdminSettingsDialog>
}
