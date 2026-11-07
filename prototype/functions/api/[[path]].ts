/// <reference types="@cloudflare/workers-types" />
import { administrator, authentication, limitedText, HttpError, json, type Env } from '../../server/auth'
import { maxNewPhotoBytes, maxPhotoBytes, maxVehiclePhotos } from '../../shared/vehicle-photos'
type Row = Record<string, unknown>
const photoSelect = 'SELECT id,vehicle_id,position FROM photos WHERE vehicle_id = ? ORDER BY position,id'
function formatVehicle(row: Row, photos: Row[], admin: boolean) {
 return { ...row, featured: !!row.featured, photos: photos.map(p => ({ ...p, url: `/api/${admin ? 'admin/' : ''}photos/${p.id}` })), photo: photos.length ? `/api/${admin ? 'admin/' : ''}photos/${photos[0].id}` : '' }
}
async function vehicle(env: Env, id: string, admin: boolean) {
 const row = await env.DB.prepare('SELECT * FROM vehicles WHERE id = ?' + (admin ? '' : " AND status != 'draft'")).bind(id).first<Row>()
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
 return [text('name',160,true),text('make',80,true),year,text('body',60),text('fuel',60),text('transmission',60),number('price'),number('mileage'),text('description',10000),status,data.featured === true ? 1 : 0]
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
const insertVehicle = 'INSERT INTO vehicles(id,name,make,year,body,fuel,transmission,price,mileage,description,status,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'
const timestamp = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"
const nextUpdatedAt = `CASE WHEN ${timestamp} <= updated_at THEN strftime('%Y-%m-%dT%H:%M:%fZ',updated_at,'+0.001 seconds') ELSE ${timestamp} END`
const updateVehicle = `UPDATE vehicles SET name=?,make=?,year=?,body=?,fuel=?,transmission=?,price=?,mileage=?,description=?,status=?,featured=?,updated_at=${nextUpdatedAt} WHERE id=?`
const photoIdPattern = /^[a-zA-Z0-9-]{1,80}$/
const newVehicleIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const changedVehicle = 'This vehicle changed while you were editing. Reload it before saving.'
const photoLimitMessage = 'New photos must total 36 MB or less per save.'
type StoredPhoto = { id: string; object_key: string }

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
 const order = photoIds(data.photoOrder)
 if (data.status && data.status !== 'draft' && !order.length) throw new HttpError(400,'Upload at least one photo before publishing.')

 const existing = (await env.DB.prepare(
  'SELECT id,object_key FROM photos WHERE vehicle_id=? ORDER BY position,id'
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
  statements.push(env.DB.prepare(updateVehicle).bind(...values,id))
 } else {
  statements.push(env.DB.prepare(insertVehicle).bind(id,...values))
 }
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

 const attemptedKeys: string[] = []
 try {
  for (const {key,type,source} of uploads.values()) {
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
  const persisted = await env.DB.prepare('SELECT id,object_key FROM photos WHERE vehicle_id=? ORDER BY position,id')
   .bind(id).all<StoredPhoto>().catch(() => null)
  if (persisted) await deletePhotoObjects(env,attemptedKeys.filter(key => !persisted.results.some(photo => photo.object_key === key)))
  const latest = await env.DB.prepare('SELECT updated_at FROM vehicles WHERE id=?').bind(id).first<{updated_at:string}>().catch(() => undefined)
  if ((latest !== undefined && latest?.updated_at !== currentVehicle?.updated_at)
    || persisted && JSON.stringify(persisted.results.map(photo => photo.id)) !== currentIds) {
   throw new HttpError(409,changedVehicle)
  }
  throw error
 }

 const stagedKeys = Array.from(uploads.values()).flatMap(({source}) => typeof source === 'string' ? [source] : [])
 await deletePhotoObjects(env,[...removed.map(photo => photo.object_key),...stagedKeys])
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
  if (parts[0] === 'photos' && parts[1] && request.method === 'GET') {
   const p = await env.DB.prepare("SELECT p.* FROM photos p JOIN vehicles v ON v.id=p.vehicle_id WHERE p.id=?" + (admin ? '' : " AND v.status!='draft'")).bind(parts[1]).first<{object_key:string,content_type:string}>()
   if (!p) throw new HttpError(404,'Photo not found.')
   const object = await env.PHOTOS.get(p.object_key)
   if (!object) throw new HttpError(404,'Photo not found.')
   return new Response(object.body,{headers:{'Content-Type':p.content_type,'Cache-Control':admin?'private, no-store':'public, max-age=300','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}})
  }
  if (parts[0] !== 'vehicles') throw new HttpError(404,'Not found.')
  const id = parts[1]
  if (request.method === 'GET') {
   if (id) return json(await vehicle(env,id,admin))
   const rows = await env.DB.prepare('SELECT * FROM vehicles'+(admin?'':" WHERE status!='draft'")+' ORDER BY created_at DESC,id LIMIT 500').all<Row>()
   const photos = await env.DB.prepare('SELECT p.id,p.vehicle_id,p.position FROM photos p JOIN vehicles v ON v.id=p.vehicle_id'+(admin?'':" WHERE v.status!='draft'")+' ORDER BY p.position,p.id').all<Row>()
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
   await env.DB.prepare(insertVehicle).bind(id,...fields(data)).run()
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
   const photo=await env.DB.prepare('SELECT object_key FROM photos WHERE id=? AND vehicle_id=?').bind(parts[3],id).first<{object_key:string}>()
   if(!photo) throw new HttpError(404,'Photo not found.')
   const r=await env.DB.prepare("DELETE FROM photos WHERE id=? AND vehicle_id=? AND ((SELECT status FROM vehicles WHERE id=?)='draft' OR (SELECT COUNT(*) FROM photos WHERE vehicle_id=?)>1)").bind(parts[3],id,id,id).run()
   if(!r.meta.changes)throw new HttpError(400,'Published vehicles need at least one photo. Save as draft first.')
   await env.PHOTOS.delete(photo.object_key)
   return json(await vehicle(env,id,true))
  }
  if (!parts[2] && request.method === 'PUT') {
   const data=await body(request);const values=fields(data)
   if(data.status!=='draft') {
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM photos WHERE vehicle_id=?').bind(id).first<{n:number}>()
    if(!count?.n)throw new HttpError(400,'Upload at least one photo before publishing.')
   }
   const statements=[env.DB.prepare(updateVehicle).bind(...values,id)]
   if(data.photoOrder!==undefined) {
    const existing=await env.DB.prepare('SELECT id FROM photos WHERE vehicle_id=?').bind(id).all<{id:string}>()
    if(!Array.isArray(data.photoOrder)||data.photoOrder.length!==existing.results.length||new Set(data.photoOrder).size!==data.photoOrder.length||data.photoOrder.some((p:unknown)=>!existing.results.some(e=>e.id===p)))throw new HttpError(409,'Photos have changed. Please reload this vehicle.')
    statements.push(...data.photoOrder.map((p:string,i:number)=>env.DB.prepare('UPDATE photos SET position=? WHERE id=? AND vehicle_id=?').bind(i,p,id)))
   }
   await env.DB.batch(statements)
   return json(await vehicle(env,id,true))
  }
  if (!parts[2] && request.method === 'DELETE') {
   const photos=await env.DB.prepare('SELECT object_key FROM photos WHERE vehicle_id=?').bind(id).all<{object_key:string}>()
   await env.DB.batch([env.DB.prepare('DELETE FROM photos WHERE vehicle_id=?').bind(id),env.DB.prepare('DELETE FROM vehicles WHERE id=?').bind(id)])
   await env.PHOTOS.delete(photos.results.map(p=>p.object_key))
   return json({deleted:true})
  }
  throw new HttpError(405,'Method not allowed.')
 } catch(error) {
  if(error instanceof HttpError)return json({error:error.message},error.status)
  console.error(JSON.stringify({event:'vehicle_api_error',message:error instanceof Error?error.message:'Unknown error'}))
  return json({error:'Unable to complete the request. Please try again.'},500)
 }
}
