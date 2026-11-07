import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRight, Stamp, Trash2 } from 'lucide-react'
import { useLocale } from './locale'

import type { WatermarkPlacement } from '../shared/watermarks'

export type AdminPhoto = { id: string; url: string; original_url?: string; watermark?: WatermarkPlacement | null }

function PhotoTile({ photo, index, total, selected, onPreview, onMove, onRemove, onWatermark }: {
  photo: AdminPhoto
  index: number
  total: number
  selected: boolean
  onPreview: (photo: AdminPhoto) => void
  onMove: (index: number, to: number) => void
  onRemove: (photo: AdminPhoto) => void
  onWatermark: (photo: AdminPhoto) => void
}) {
  const { t } = useLocale()
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id, disabled: total < 2 })
  const number = index + 1

  return (
    <div ref={setNodeRef} className="admin-photo-tile" data-dragging={isDragging} data-previewed={selected}
      style={{ transform: CSS.Translate.toString(transform), transition }}>
      <button {...listeners} ref={setActivatorNodeRef} type="button" className="admin-photo-handle" data-sortable={total > 1}
        aria-label={t('预览照片 {number}', { number })} onClick={() => onPreview(photo)}>
        <img src={photo.url} alt={t('车辆照片 {number}', { number })} draggable={false} />
      </button>
      {index === 0 && <span className="admin-photo-cover">{t('封面')}</span>}
      <div className="admin-photo-actions">
        <button type="button" aria-label={t('照片 {number} 前移', { number })} disabled={index === 0}
          onClick={() => onMove(index, index - 1)}><ArrowLeft size={16} aria-hidden="true" /></button>
        <button type="button" aria-label={t('照片 {number} 后移', { number })} disabled={number === total}
          onClick={() => onMove(index, index + 1)}><ArrowRight size={16} aria-hidden="true" /></button>
        <button type="button" aria-label={t('Edit watermark for photo {number}', { number })} data-watermarked={!!photo.watermark}
          onClick={() => onWatermark(photo)}><Stamp size={16} aria-hidden="true" /></button>
        <button type="button" aria-label={t('删除照片 {number}', { number })}
          onClick={() => onRemove(photo)}><Trash2 size={16} aria-hidden="true" /></button>
      </div>
    </div>
  )
}

export default function AdminPhotoGrid({ photos, previewedId, onPreview, onReorder, onRemove, onWatermark, children }: {
  photos: AdminPhoto[]
  previewedId: string | undefined
  onPreview: (photo: AdminPhoto) => void
  onReorder: (photos: AdminPhoto[]) => void
  onRemove: (photo: AdminPhoto) => void
  onWatermark: (photo: AdminPhoto) => void
  children: ReactNode
}) {
  const { t } = useLocale()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const draggedPhoto = photos.find(photo => photo.id === draggedId)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const move = (from: number, to: number) => {
    if (from >= 0 && to >= 0 && to < photos.length && from !== to) onReorder(arrayMove(photos, from, to))
  }
  const finishDrag = ({ active, over }: DragEndEvent) => {
    setDraggedId(null)
    if (over) move(photos.findIndex(photo => photo.id === active.id), photos.findIndex(photo => photo.id === over.id))
  }
  const position = (id: string | number) => photos.findIndex(photo => photo.id === id) + 1

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={({ active }) => setDraggedId(String(active.id))}
      onDragCancel={() => setDraggedId(null)} onDragEnd={finishDrag}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => t('已拿起第 {number} 张照片。', { number: position(active.id) }),
          onDragOver: ({ over }) => over ? t('目标位置：{number}。', { number: position(over.id) }) : undefined,
          onDragEnd: ({ over }) => over ? t('照片已放到第 {number} 个位置。', { number: position(over.id) }) : undefined,
          onDragCancel: () => t('已取消拖动。'),
        },
      }}>
      <div className="admin-photos">
        <SortableContext items={photos.map(photo => photo.id)} strategy={rectSortingStrategy}>
          {photos.map((photo, index) => (
            <PhotoTile key={photo.id} photo={photo} index={index} total={photos.length}
              selected={photo.id === previewedId} onPreview={onPreview} onMove={move} onRemove={onRemove} onWatermark={onWatermark} />
          ))}
        </SortableContext>
        {children}
      </div>
      {createPortal(
        <DragOverlay dropAnimation={null} zIndex={60}>
          {draggedPhoto && <img className="admin-photo-drag-preview" src={draggedPhoto.url} alt="" draggable={false} />}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
