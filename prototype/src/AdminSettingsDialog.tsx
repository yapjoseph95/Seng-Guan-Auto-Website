import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useLocale } from './locale'

export default function AdminSettingsDialog({ title, onClose, busy = false, children, className = '' }: {
 title: string; onClose: () => void; busy?: boolean; children: ReactNode; className?: string
}) {
 const { t } = useLocale()
 const titleId = useId()
 const dialog = useRef<HTMLDialogElement>(null)
 useEffect(() => {
  const modal = dialog.current
  modal?.showModal()
  return () => modal?.close()
 }, [])
 return <dialog ref={dialog} autoFocus className={'admin-watermark-dialog '+className} aria-labelledby={titleId}
  onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
  <div className="admin-watermark-heading">
   <h2 id={titleId}>{title}</h2>
   <button type="button" aria-label={t('Close')} disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button>
  </div>
  {children}
 </dialog>
}
