/// <reference types="@cloudflare/workers-types" />
import { administrator, authentication, limitedText, HttpError, json, type Env } from '../../server/auth'
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
 if (!['draft','available','sold'].includes(String(status))) throw new HttpError(400, 'Invalid publication status.')
 return [text('name',160,true),text('make',80,true),year,text('body',60),text('fuel',60),text('transmission',60),number('price'),number('mileage'),text('description',10000),status,data.featured === true ? 1 : 0]
}
async function body(request: Request) {
 if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Expected JSON.')
 const text = await limitedText(request,40000)
 try { const data = JSON.parse(text); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data } catch { throw new HttpError(400, 'Invalid request.') }
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
  if (!id && request.method === 'POST') {
   const data = await body(request); data.status = 'draft'
   const id = crypto.randomUUID()
   await env.DB.prepare('INSERT INTO vehicles(id,name,make,year,body,fuel,transmission,price,mileage,description,status,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,...fields(data)).run()
   return json(await vehicle(env,id,true),201)
  }
  if (!id) throw new HttpError(404,'Vehicle not found.')
  await vehicle(env,id,true)
  if (parts[2] === 'photos' && request.method === 'POST') {
   const length=Number(request.headers.get('Content-Length'))
   if (!length || length>8*1024*1024) throw new HttpError(413,'Photos must be smaller than 8 MB.')
   const form = await request.formData(); const file=form.get('file')
   if (!(file instanceof File) || file.size>7*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new HttpError(400,'Please upload a JPEG, PNG or WebP photo under 7 MB.')
   const bytes=new Uint8Array(await file.arrayBuffer())
   const type=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':''
   if (type!==file.type) throw new HttpError(400,'The file is not a supported photo.')
   const photoId=crypto.randomUUID();const key=`vehicles/${id}/${photoId}`
   await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:type}})
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
   const statements=[env.DB.prepare("UPDATE vehicles SET name=?,make=?,year=?,body=?,fuel=?,transmission=?,price=?,mileage=?,description=?,status=?,featured=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(...values,id)]
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
