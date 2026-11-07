/// <reference types="@cloudflare/workers-types" />
import { isMileageBand } from '../../shared/vehicle-mileage'
import { administrator, authentication, limitedText, HttpError, json, type Env } from '../../server/auth'
import { maxNewPhotoBytes, maxPhotoBytes, maxVehiclePhotos } from '../../shared/vehicle-photos'
import { defaultWatermarkSettings, maxWatermarksPerPhoto, type WatermarkDefaults, type WatermarkPlacement } from '../../shared/watermarks'
type Row = Record<string, unknown>
const publicVehicleFields = 'id,name,make,year,body,fuel,transmission,price,mileage,description,status,featured,created_at,updated_at,mileage_band,published_at'
const vehicleFields = (admin: boolean) => admin
 ? 'vehicles.*, (SELECT plate_number FROM vehicle_private_details WHERE vehicle_id=vehicles.id) AS plate_number'
 : publicVehicleFields
const photoFields = 'p.id,p.vehicle_id,p.position,w.watermark_id,w.x,w.y,w.scale,w.opacity,w.additional_layers,w.object_key AS render_key'
const photoJoin = ' LEFT JOIN photo_watermarks w ON w.photo_id=p.id'
const photoSelect = 'SELECT '+photoFields+' FROM photos p'+photoJoin+' WHERE p.vehicle_id=? ORDER BY p.position,p.id'
function formatVehicle(row: Row, photos: Row[], admin: boolean) {
 const items = photos.map(({id,vehicle_id,position,watermark_id,x,y,scale,opacity,additional_layers,render_key}) => {
  const original = `/api/${admin ? 'admin/' : ''}photos/${id}`
  const url = render_key ? original + '?v=' + String(render_key).split('/').at(-1) : original
  const photo = { id,vehicle_id,position,url }
  if (!admin) return photo
  const watermark = watermark_id ? { watermarkId:watermark_id,x,y,scale,opacity } : null
  const watermarks = watermark ? [watermark,...JSON.parse(String(additional_layers ?? '[]'))] : []
  return {...photo,original_url:original,watermark,watermarks}
 })
 return { ...row, featured:!!row.featured, photos:items, photo:items[0]?.url ?? '' }
}
async function vehicle(env: Env, id: string, admin: boolean) {
 const row = await env.DB.prepare('SELECT '+vehicleFields(admin)+' FROM vehicles WHERE id = ?' + (admin ? '' : " AND status != 'draft'")).bind(id).first<Row>()
 if (!row) throw new HttpError(404, 'Vehicle not found.')
 const photos = await env.DB.prepare(photoSelect).bind(id).all<Row>()
 return formatVehicle(row, photos.results, admin)
}
function fields(data: Record<string, unknown>) {
 const text = (key: string, max: number, required = false) => {
  const value = String(data[key] ?? '').trim()
  if (value.length > max || required && !value) throw new HttpError(400, `Please check ${key}.`)
  return value
 }
 const year = Number(data.year)
 if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) throw new HttpError(400, 'Please enter a valid vehicle year.')
 const number = (key: string) => {
  if (data[key] === '' || data[key] == null) return null
  const n = Number(data[key]); if (!Number.isSafeInteger(n) || n < 0 || n > 100000000) throw new HttpError(400, `Please check ${key}.`)
  return n
 }
 const status = data.status || 'draft'
 if (!['draft','available','reserved','sold'].includes(String(status))) throw new HttpError(400, 'Invalid publication status.')
 const mileageBand = data.mileage_band ?? null
 if (mileageBand !== null && !isMileageBand(mileageBand)) throw new HttpError(400,'Please check mileage.')
 return [text('name',160,true),text('make',80,true),year,text('body',60),text('fuel',60),text('transmission',60),number('price'),mileageBand === null ? number('mileage') : null,text('description',10000),status,data.featured === true ? 1 : 0,mileageBand]
}
const photoTypes = ['image/jpeg', 'image/png', 'image/webp']
async function checkedPhoto(file: unknown) {
 if (!(file instanceof File) || file.size > maxPhotoBytes || !photoTypes.includes(file.type)) {
  throw new HttpError(400,'Please upload a JPEG, PNG or WebP photo under 7 MB.')
 }
 const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer())
 const type=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':''
 if (type!==file.type) throw new HttpError(400,'The file is not a supported photo.')
 return file
}

function parseBody(text: string) {
 try {
  const data: unknown = JSON.parse(text)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error()
  return data as Record<string,unknown>
 } catch {
  throw new HttpError(400,'Invalid request.')
 }
}

async function body(request: Request) {
 if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Expected JSON.')
 return parseBody(await limitedText(request,40000))
}
const insertVehicle = 'INSERT INTO vehicles(id,name,make,year,body,fuel,transmission,price,mileage,description,status,featured,mileage_band) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)'
const timestamp = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"
const nextUpdatedAt = `CASE WHEN ${timestamp} <= updated_at THEN strftime('%Y-%m-%dT%H:%M:%fZ',updated_at,'+0.001 seconds') ELSE ${timestamp} END`
const updateVehicle = `UPDATE vehicles SET name=?,make=?,year=?,body=?,fuel=?,transmission=?,price=?,mileage=?,description=?,status=?,featured=?,mileage_band=COALESCE(?, CASE WHEN ? THEN mileage_band END),updated_at=${nextUpdatedAt} WHERE id=?`
function preserveMileageBand(data: Record<string, unknown>) {
 return !Object.hasOwn(data,'mileage_band') && (data.mileage == null || data.mileage === '') ? 1 : 0
}

function plateUpdate(env: Env, id: string, data: Row) {
 if (!Object.hasOwn(data,'plate_number')) return []
 const value = data.plate_number ?? ''
 const plate = typeof value === 'string' ? value.trim().toUpperCase() : null
 if (plate === null || plate.length > 32) throw new HttpError(400,'Please check the plate number.')
 return [env.DB.prepare(
  'INSERT INTO vehicle_private_details(vehicle_id,plate_number) VALUES(?,?) ON CONFLICT(vehicle_id) DO UPDATE SET plate_number=excluded.plate_number'
 ).bind(id,plate)]
}

const photoIdPattern = /^[a-zA-Z0-9-]{1,80}$/
const newVehicleIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const changedVehicle = 'This vehicle changed while you were editing. Reload it before saving.'
const photoLimitMessage = 'New photos must total 36 MB or less per save.'
type StoredPhoto = { id: string; object_key: string; render_key: string | null }

function photoIds(value: unknown): string[] {
 if (!Array.isArray(value) || value.length > maxVehiclePhotos || new Set(value).size !== value.length
   || value.some(id => typeof id !== 'string' || !photoIdPattern.test(id))) {
  throw new HttpError(400,'Invalid photo order.')
 }
 return value
}

async function deletePhotoObjects(env: Env, keys: string[]) {
 if (!keys.length) return
 await env.PHOTOS.delete(keys).catch(() => console.error('Vehicle photo cleanup failed.'))
}

const stagedPhotoUnavailable = 'An uploaded photo is no longer available. Remove it and upload it again.'

async function stagedPhotoPrefix(email: string) {
 const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.toLowerCase()))
 const owner = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('')
 return `staged-vehicle-photos/${owner}/`
}

async function stagePhoto(request: Request, env: Env, email: string, id: string) {
 if (!newVehicleIdPattern.test(id)) throw new HttpError(400,'Invalid request.')
 const key = (await stagedPhotoPrefix(email)) + id
 if (request.method === 'DELETE') {
  await env.PHOTOS.delete(key)
  return json({ id })
 }
 if (request.method !== 'POST') throw new HttpError(405,'Method not allowed.')
 const length = Number(request.headers.get('Content-Length'))
 if (!Number.isSafeInteger(length) || length <= 0 || length > maxPhotoBytes + 4096) {
  throw new HttpError(413,'Photos must be smaller than 8 MB.')
 }
 const form = await request.formData().catch(() => { throw new HttpError(400,'Invalid request.') })
 const file = await checkedPhoto(form.get('file'))
 const staged = await env.PHOTOS.put(key,file,{
  httpMetadata:{contentType:file.type}, onlyIf:{etagDoesNotMatch:'*'},
 })
 if (!staged) throw new HttpError(409,'Invalid request.')
 return json({ id },201)
}

function imageResponse(body: ReadableStream, type: string, admin: boolean) {
 return new Response(body,{headers:{
  'Content-Type':type, 'Cache-Control':admin ? 'private, no-store' : 'public, max-age=300',
  'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'none'",
 }})
}

const inRange = (n: unknown, min = 0): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= 1

function watermarkName(value: unknown) {
 const name = typeof value === 'string' ? value.trim() : ''
 if (!name || name.length > 80) throw new HttpError(400,'Enter a watermark name up to 80 characters.')
 return name
}

async function watermarkLibrary(request: Request, env: Env, id?: string) {
 if (request.method === 'PATCH' && id) {
  const name = watermarkName((await body(request)).name)
  const result = await env.DB.prepare(
   'UPDATE watermark_assets SET name=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM watermark_assets WHERE name=? AND id<>?)'
  ).bind(name,id,name,id).run()
  if (!result.meta.changes) {
   const asset = await env.DB.prepare('SELECT id FROM watermark_assets WHERE id=?').bind(id).first()
   if (!asset) throw new HttpError(404,'Watermark not found.')
   throw new HttpError(409,'A watermark with that name already exists.')
  }
  return json({name})
 }

 if (request.method === 'PUT' && id) {
  const {scale,opacity,x,y} = await body(request)
  if (!inRange(scale,.1) || !inRange(opacity)) throw new HttpError(400,'Invalid watermark defaults.')
  if (id !== 'settings') {
   if ((x !== undefined && !inRange(x)) || (y !== undefined && !inRange(y))) {
    throw new HttpError(400,'Invalid watermark defaults.')
   }
   const result = await env.DB.prepare(
    'UPDATE watermark_assets SET default_scale=?,default_opacity=?,default_x=COALESCE(?,default_x),default_y=COALESCE(?,default_y) WHERE id=?'
   ).bind(scale,opacity,x ?? null,y ?? null,id).run()
   if (!result.meta.changes) throw new HttpError(404,'Watermark not found.')
   return json({scale,opacity,x,y})
  }
  await env.DB.prepare(
   'INSERT INTO watermark_settings(id,scale,opacity) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET scale=excluded.scale,opacity=excluded.opacity'
  ).bind(scale,opacity).run()
  return json({scale,opacity})
 }
 if (request.method === 'GET' && id) {
  const asset = await env.DB.prepare('SELECT content_type FROM watermark_assets WHERE id=?').bind(id).first<{content_type:string}>()
  const image = asset && await env.PHOTOS.get('watermark-assets/'+id)
  if (!asset || !image) throw new HttpError(404,'Watermark not found.')
  return imageResponse(image.body,asset.content_type,true)
 }
 if (request.method === 'GET') {
  const assets = await env.DB.prepare('SELECT id,name,default_scale,default_opacity,default_x,default_y FROM watermark_assets ORDER BY name,id')
   .all<{id:string;name:string;default_scale:number|null;default_opacity:number|null;default_x:number|null;default_y:number|null}>()
  const defaults = await env.DB.prepare('SELECT scale,opacity FROM watermark_settings WHERE id=1').first<Pick<WatermarkDefaults,'scale' | 'opacity'>>()
   ?? {scale:defaultWatermarkSettings.scale,opacity:defaultWatermarkSettings.opacity}
  const watermarks = assets.results.map(({id,name,default_scale,default_opacity,default_x,default_y}) => ({
   id,name,url:'/api/admin/watermarks/'+id,
   defaults:{
    scale:default_scale ?? defaults.scale,opacity:default_opacity ?? defaults.opacity,
    x:default_x ?? defaultWatermarkSettings.x,y:default_y ?? defaultWatermarkSettings.y,
   },
  }))
  return json({watermarks,defaults})
 }
 if (request.method !== 'POST' || id) throw new HttpError(405,'Method not allowed.')
 const length = Number(request.headers.get('Content-Length'))
 if (!Number.isSafeInteger(length) || length <= 0 || length > maxPhotoBytes + 4096) throw new HttpError(413,'Watermark images must be under 7 MB.')
 const form = await request.formData().catch(() => { throw new HttpError(400,'Invalid request.') })
 const name = watermarkName(form.get('name'))
 const file = await checkedPhoto(form.get('file'))
 const assetId = crypto.randomUUID()
 const key = 'watermark-assets/'+assetId
 await env.PHOTOS.put(key,file,{httpMetadata:{contentType:file.type}})
 try {
  const result = await env.DB.prepare('INSERT INTO watermark_assets(id,name,content_type) VALUES(?,?,?) ON CONFLICT(name) DO NOTHING')
   .bind(assetId,name,file.type).run()
  if (!result.meta.changes) throw new HttpError(409,'A watermark with that name already exists.')
 } catch (error) {
  const saved = await env.DB.prepare('SELECT id FROM watermark_assets WHERE id=?').bind(assetId).first().catch(() => undefined)
  if (saved === null) await deletePhotoObjects(env,[key])
  throw error
 }
 return json({id:assetId,name,url:'/api/admin/watermarks/'+assetId},201)
}

function placement(value: unknown): WatermarkPlacement {
 const item = value as Partial<WatermarkPlacement> | null
 if (!item || typeof item.watermarkId !== 'string' || !newVehicleIdPattern.test(item.watermarkId)
  || !inRange(item.x) || !inRange(item.y) || !inRange(item.scale,.1) || !inRange(item.opacity)) {
  throw new HttpError(400,'Invalid watermark placement.')
 }
 return {watermarkId:item.watermarkId,x:item.x,y:item.y,scale:item.scale,opacity:item.opacity}
}

async function saveVehicle(request: Request, env: Env, email: string, existingId?: string) {
 const length = Number(request.headers.get('Content-Length'))
 if (!Number.isSafeInteger(length) || length <= 0 || length > maxNewPhotoBytes + 128 * 1024) {
  throw new HttpError(413,photoLimitMessage)
 }
 const form = await request.formData().catch(() => { throw new HttpError(400,'Invalid request.') })
 const details = form.get('vehicle')
 if (typeof details !== 'string' || details.length > 40000) throw new HttpError(400,'Invalid request.')
 const data = parseBody(details)
 const values = fields(data)
 const id = existingId ?? data.createId
 if (typeof id !== 'string' || (!existingId && !newVehicleIdPattern.test(id))) throw new HttpError(400,'Invalid request.')
 const privateUpdates = plateUpdate(env,id,data)
 const order = photoIds(data.photoOrder)
 if (data.status && data.status !== 'draft' && !order.length) throw new HttpError(400,'Upload at least one photo before publishing.')

 const existing = (await env.DB.prepare(
  'SELECT p.id,p.object_key,w.object_key AS render_key FROM photos p'+photoJoin+' WHERE p.vehicle_id=? ORDER BY p.position,p.id'
 ).bind(id).all<StoredPhoto>()).results
 const currentIds = JSON.stringify(existing.map(photo => photo.id))
 const currentVehicle = await env.DB.prepare('SELECT updated_at FROM vehicles WHERE id=?').bind(id).first<{updated_at:string}>()
 if (existingId && !currentVehicle) throw new HttpError(404,'Vehicle not found.')
 if (existingId ? currentVehicle?.updated_at !== data.updatedAt || currentIds !== JSON.stringify(photoIds(data.originalPhotoOrder)) : currentVehicle) {
  throw new HttpError(409,changedVehicle)
 }
 const oldById = new Map(existing.map(photo => [photo.id, photo]))
 const uploads = new Map<string,{key:string;type:string;size:number;source:File|string}>()
 const prefix = await stagedPhotoPrefix(email)
 let uploadBytes = 0
 for (const photoId of order) {
  if (oldById.has(photoId)) continue
  const key = `vehicles/${id}/${crypto.randomUUID()}`
  const inline = form.get('photo:' + photoId)
  if (inline !== null) {
   const file = await checkedPhoto(inline)
   uploadBytes += file.size
   if (uploadBytes > maxNewPhotoBytes) throw new HttpError(413,photoLimitMessage)
   uploads.set(photoId,{key,type:file.type,size:file.size,source:file})
  } else {
   const source = prefix + photoId
   const staged = newVehicleIdPattern.test(photoId) ? await env.PHOTOS.head(source) : null
   const type = staged?.httpMetadata?.contentType
   if (!staged || !type || !photoTypes.includes(type) || staged.size > maxPhotoBytes) {
    throw new HttpError(409,stagedPhotoUnavailable)
   }
   uploads.set(photoId,{key,type,size:staged.size,source})
  }
 }

 const removed = existing.filter(photo => !order.includes(photo.id))
 const statements: D1PreparedStatement[] = []
 if (existingId) {
  // A failed version or photo-order check aborts the batch through the NOT NULL constraint.
  statements.push(env.DB.prepare(
   `UPDATE vehicles SET updated_at=CASE WHEN updated_at=? AND
    (SELECT json_group_array(id) FROM (SELECT id FROM photos WHERE vehicle_id=? ORDER BY position,id))=?
    THEN updated_at ELSE NULL END WHERE id=?`
  ).bind(data.updatedAt,id,currentIds,id))
  statements.push(env.DB.prepare(updateVehicle).bind(...values,preserveMileageBand(data),id))
 } else {
  statements.push(env.DB.prepare(insertVehicle).bind(id,...values))
 }
 statements.push(...privateUpdates)
 for (const photo of removed) {
  statements.push(env.DB.prepare('DELETE FROM photos WHERE id=? AND vehicle_id=?').bind(photo.id,id))
 }
 order.forEach((photoId,position) => {
  const upload = uploads.get(photoId)
  if (upload) {
   statements.push(env.DB.prepare('INSERT INTO photos(id,vehicle_id,object_key,content_type,size,position) VALUES(?,?,?,?,?,?)')
    .bind(photoId,id,upload.key,upload.type,upload.size,position))
  } else {
   statements.push(env.DB.prepare('UPDATE photos SET position=? WHERE id=? AND vehicle_id=?').bind(position,photoId,id))
  }
 })

 const rendered: {key:string; type:string; source:File}[] = []
 const replacedRenders: string[] = []
 if (data.watermarks !== undefined) {
  if (!data.watermarks || typeof data.watermarks !== 'object' || Array.isArray(data.watermarks)) {
   throw new HttpError(400,'Invalid watermark placement.')
  }
  const entries = Object.entries(data.watermarks)
  const assets = entries.some(([,value]) => value !== null && (!Array.isArray(value) || value.length))
   ? new Set((await env.DB.prepare('SELECT id FROM watermark_assets').all<{id:string}>()).results.map(asset => asset.id))
   : new Set<string>()
  for (const [photoId,value] of entries) {
   if (!order.includes(photoId)) throw new HttpError(400,'Invalid watermark placement.')
   const oldRender = oldById.get(photoId)?.render_key
   if (oldRender) replacedRenders.push(oldRender)
   const layers = value === null ? [] : Array.isArray(value) ? value : [value]
   if (layers.length > maxWatermarksPerPhoto) throw new HttpError(400,'Too many watermarks for this photo.')
   const marks = layers.map(placement)
   const [mark,...additional] = marks
   if (!mark) {
    statements.push(env.DB.prepare('DELETE FROM photo_watermarks WHERE photo_id=?').bind(photoId))
    continue
   }
   if (marks.some(layer => !assets.has(layer.watermarkId))) throw new HttpError(404,'Watermark not found.')
   const file = await checkedPhoto(form.get('watermark:'+photoId))
   if (file.type !== 'image/jpeg') throw new HttpError(400,'Invalid watermark placement.')
   uploadBytes += file.size
   if (uploadBytes > maxNewPhotoBytes) throw new HttpError(413,photoLimitMessage)
   const key = `vehicle-watermarks/${id}/${crypto.randomUUID()}`
   rendered.push({key,type:file.type,source:file})
   statements.push(env.DB.prepare(
    'INSERT INTO photo_watermarks(photo_id,watermark_id,x,y,scale,opacity,object_key,additional_layers) VALUES(?,?,?,?,?,?,?,?) '
    +'ON CONFLICT(photo_id) DO UPDATE SET watermark_id=excluded.watermark_id,x=excluded.x,y=excluded.y,scale=excluded.scale,opacity=excluded.opacity,object_key=excluded.object_key,additional_layers=excluded.additional_layers'
   ).bind(photoId,mark.watermarkId,mark.x,mark.y,mark.scale,mark.opacity,key,JSON.stringify(additional)))
  }
 }

 const attemptedKeys: string[] = []
 try {
  for (const {key,type,source} of [...uploads.values(),...rendered]) {
   let contents: File | ArrayBuffer
   if (typeof source === 'string') {
    const staged = await env.PHOTOS.get(source)
    if (!staged) throw new HttpError(409,stagedPhotoUnavailable)
    contents = await staged.arrayBuffer()
   } else {
    contents = source
   }
   attemptedKeys.push(key)
   await env.PHOTOS.put(key,contents,{httpMetadata:{contentType:type}})
  }
  const results = await env.DB.batch(statements)
  if (!results[0].meta.changes) throw new HttpError(409,changedVehicle)
 } catch (error) {
  // Only remove unreferenced objects if storage was written but the save failed.
  const persisted = await env.DB.prepare('SELECT p.id,p.object_key,w.object_key AS render_key FROM photos p'+photoJoin+' WHERE p.vehicle_id=? ORDER BY p.position,p.id')
   .bind(id).all<StoredPhoto>().catch(() => null)
  if (persisted) await deletePhotoObjects(env,attemptedKeys.filter(key => !persisted.results.some(photo => photo.object_key === key || photo.render_key === key)))
  const latest = await env.DB.prepare('SELECT updated_at FROM vehicles WHERE id=?').bind(id).first<{updated_at:string}>().catch(() => undefined)
  if ((latest !== undefined && latest?.updated_at !== currentVehicle?.updated_at)
    || persisted && JSON.stringify(persisted.results.map(photo => photo.id)) !== currentIds) {
   throw new HttpError(409,changedVehicle)
  }
  throw error
 }

 const stagedKeys = Array.from(uploads.values()).flatMap(({source}) => typeof source === 'string' ? [source] : [])
 await deletePhotoObjects(env,[...removed.flatMap(photo => [photo.object_key,...(photo.render_key ? [photo.render_key] : [])]),...replacedRenders,...stagedKeys])
 return json(await vehicle(env,id,true),existingId ? 200 : 201)
}
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
 try {
  const url = new URL(request.url)
  const parts = url.pathname.replace(/^\/api\//,'').split('/').filter(Boolean)
  if(parts[0] === 'auth') return await authentication(request,env,parts[1]||'')
  const admin = parts[0] === 'admin'
  let email = ''
  if (admin) {
   email = await administrator(request,env)
   parts.shift()
   if (!['GET','HEAD'].includes(request.method) && (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')) throw new HttpError(403,'Please make changes from the admin dashboard.')
  } else if (!['GET','HEAD'].includes(request.method)) throw new HttpError(405,'Method not allowed.')
  if (admin && parts[0] === 'session' && request.method === 'GET') return json({ email })
  if (admin && parts[0] === 'staged-photos' && parts.length === 2) return await stagePhoto(request,env,email,parts[1])
  if (admin && parts[0] === 'watermarks' && parts.length <= 2) return await watermarkLibrary(request,env,parts[1])
  if (parts[0] === 'photos' && parts[1] && request.method === 'GET') {
   const p = await env.DB.prepare('SELECT p.object_key,p.content_type,w.object_key AS render_key FROM photos p JOIN vehicles v ON v.id=p.vehicle_id'+photoJoin
    +' WHERE p.id=?'+(admin ? '' : " AND v.status!='draft'")).bind(parts[1]).first<StoredPhoto & {content_type:string}>()
   if (!p) throw new HttpError(404,'Photo not found.')
   const render = p.render_key && (!admin || url.searchParams.has('v'))
   const object = await env.PHOTOS.get(render ? p.render_key! : p.object_key)
   if (!object) throw new HttpError(404,'Photo not found.')
   return imageResponse(object.body,render ? 'image/jpeg' : p.content_type,admin)
  }
  if (parts[0] !== 'vehicles') throw new HttpError(404,'Not found.')
  const id = parts[1]
  if (request.method === 'GET') {
   if (id) return json(await vehicle(env,id,admin))
   const rows = await env.DB.prepare('SELECT '+vehicleFields(admin)+' FROM vehicles'+(admin?'':" WHERE status!='draft'")+' ORDER BY created_at DESC,id LIMIT 500').all<Row>()
   const photos = await env.DB.prepare('SELECT '+photoFields+' FROM photos p JOIN vehicles v ON v.id=p.vehicle_id'+photoJoin+(admin?'':" WHERE v.status!='draft'")+' ORDER BY p.position,p.id').all<Row>()
   const grouped = new Map<string,Row[]>()
   for(const photo of photos.results) { const key=String(photo.vehicle_id); const list=grouped.get(key)||[]; list.push(photo); grouped.set(key,list) }
   return json({vehicles:rows.results.map(row=>formatVehicle(row,grouped.get(String(row.id))||[],admin))})
  }
  if (!admin) throw new HttpError(403,'Not authorized.')
  if (request.headers.get('Content-Type')?.startsWith('multipart/form-data')
    && (parts.length === 1 && request.method === 'POST' || parts.length === 2 && request.method === 'PUT')) {
   return await saveVehicle(request,env,email,id)
  }
  if (!id && request.method === 'POST') {
   const data = await body(request); data.status = 'draft'
   const id = crypto.randomUUID()
   await env.DB.batch([env.DB.prepare(insertVehicle).bind(id,...fields(data)),...plateUpdate(env,id,data)])
   return json(await vehicle(env,id,true),201)
  }
  if (!id) throw new HttpError(404,'Vehicle not found.')
  if (parts.length === 2 && request.method === 'PATCH') {
   const { status } = await body(request)
   if (status !== 'available' && status !== 'reserved' && status !== 'sold') {
    throw new HttpError(400,'Invalid publication status.')
   }
   const result = await env.DB.prepare(
    `UPDATE vehicles SET status=?,updated_at=${nextUpdatedAt} WHERE id=? AND EXISTS (SELECT 1 FROM photos WHERE vehicle_id=?)`
   ).bind(status,id,id).run()
   if (!result.meta.changes) {
    await vehicle(env,id,true)
    throw new HttpError(400,'Upload at least one photo before publishing.')
   }
   return json(await vehicle(env,id,true))
  }
  await vehicle(env,id,true)
  if (parts[2] === 'photos' && request.method === 'POST') {
   const length=Number(request.headers.get('Content-Length'))
   if (!length || length>8*1024*1024) throw new HttpError(413,'Photos must be smaller than 8 MB.')
   const file=await checkedPhoto((await request.formData()).get('file'))
   const photoId=crypto.randomUUID();const key=`vehicles/${id}/${photoId}`
   const type=file.type
   await env.PHOTOS.put(key,file,{httpMetadata:{contentType:type}})
   try {
    const r=await env.DB.prepare('INSERT INTO photos(id,vehicle_id,object_key,content_type,size,position) SELECT ?,?,?,?,?,COALESCE(MAX(position),-1)+1 FROM photos WHERE vehicle_id=? HAVING COUNT(*)<20').bind(photoId,id,key,type,file.size,id).run()
    if(!r.meta.changes) throw new HttpError(400,'Maximum 20 photos per vehicle.')
   } catch(e) { await env.PHOTOS.delete(key); throw e }
   return json(await vehicle(env,id,true),201)
  }
  if (parts[2] === 'photos' && parts[3] && request.method === 'DELETE') {
   const photo=await env.DB.prepare('SELECT p.object_key,w.object_key AS render_key FROM photos p'+photoJoin+' WHERE p.id=? AND p.vehicle_id=?').bind(parts[3],id).first<StoredPhoto>()
   if(!photo) throw new HttpError(404,'Photo not found.')
   const r=await env.DB.prepare("DELETE FROM photos WHERE id=? AND vehicle_id=? AND ((SELECT status FROM vehicles WHERE id=?)='draft' OR (SELECT COUNT(*) FROM photos WHERE vehicle_id=?)>1)").bind(parts[3],id,id,id).run()
   if(!r.meta.changes)throw new HttpError(400,'Published vehicles need at least one photo. Save as draft first.')
   await deletePhotoObjects(env,[photo.object_key,...(photo.render_key ? [photo.render_key] : [])])
   return json(await vehicle(env,id,true))
  }
  if (!parts[2] && request.method === 'PUT') {
   const data=await body(request);const values=fields(data)
   if(data.status!=='draft') {
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM photos WHERE vehicle_id=?').bind(id).first<{n:number}>()
    if(!count?.n)throw new HttpError(400,'Upload at least one photo before publishing.')
   }
   const statements=[env.DB.prepare(updateVehicle).bind(...values,preserveMileageBand(data),id),...plateUpdate(env,id,data)]
   if(data.photoOrder!==undefined) {
    const existing=await env.DB.prepare('SELECT id FROM photos WHERE vehicle_id=?').bind(id).all<{id:string}>()
    if(!Array.isArray(data.photoOrder)||data.photoOrder.length!==existing.results.length||new Set(data.photoOrder).size!==data.photoOrder.length||data.photoOrder.some((p:unknown)=>!existing.results.some(e=>e.id===p)))throw new HttpError(409,'Photos have changed. Please reload this vehicle.')
    statements.push(...data.photoOrder.map((p:string,i:number)=>env.DB.prepare('UPDATE photos SET position=? WHERE id=? AND vehicle_id=?').bind(i,p,id)))
   }
   await env.DB.batch(statements)
   return json(await vehicle(env,id,true))
  }
  if (!parts[2] && request.method === 'DELETE') {
   const photos=await env.DB.prepare('SELECT p.object_key,w.object_key AS render_key FROM photos p'+photoJoin+' WHERE p.vehicle_id=?').bind(id).all<StoredPhoto>()
   await env.DB.batch([env.DB.prepare('DELETE FROM photos WHERE vehicle_id=?').bind(id),env.DB.prepare('DELETE FROM vehicles WHERE id=?').bind(id)])
   await deletePhotoObjects(env,photos.results.flatMap(photo => [photo.object_key,...(photo.render_key ? [photo.render_key] : [])]))
   return json({deleted:true})
  }
  throw new HttpError(405,'Method not allowed.')
 } catch(error) {
  if(error instanceof HttpError)return json({error:error.message},error.status)
  console.error(JSON.stringify({event:'vehicle_api_error',message:error instanceof Error?error.message:'Unknown error'}))
  return json({error:'Unable to complete the request. Please try again.'},500)
 }
}
