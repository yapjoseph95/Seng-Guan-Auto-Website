import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { onRequest } from '../functions/api/[[path]].ts'

const sql=new DatabaseSync(':memory:')
sql.exec(readFileSync(new URL('../migrations/0001_vehicles.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0002_auth_limits.sql',import.meta.url),'utf8'))
const reservedMigration = readFileSync(new URL('../migrations/0003_reserved_vehicles.sql',import.meta.url),'utf8')
sql.exec(`
 INSERT INTO vehicles(id,name,make,year,status) VALUES('existing','Existing car','Toyota',2020,'sold');
 INSERT INTO photos(id,vehicle_id,object_key,content_type,size,position) VALUES('existing-photo','existing','old/key','image/jpeg',100,3);
`)
sql.exec('BEGIN; '+reservedMigration+' COMMIT;')
sql.exec(readFileSync(new URL('../migrations/0004_vehicle_mileage_band.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0005_vehicle_publication.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0006_watermarks.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0007_watermark_layers.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0008_watermark_defaults.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0009_watermark_asset_defaults.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0010_watermark_default_position.sql',import.meta.url),'utf8'))
sql.exec(readFileSync(new URL('../migrations/0013_vehicle_templates.sql',import.meta.url),'utf8'))
assert.equal(sql.prepare("SELECT published_at = created_at AS backfilled FROM vehicles WHERE id='existing'").get()?.backfilled,1)
assert.equal(sql.prepare("SELECT status FROM vehicles WHERE id='existing'").get()?.status,'sold')
assert.equal(sql.prepare("SELECT position FROM photos WHERE id='existing-photo' AND vehicle_id='existing' AND object_key='old/key'").get()?.position,3)
assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[])
sql.exec("DELETE FROM vehicles WHERE id='existing'")
assert.equal(sql.prepare('SELECT count(*) AS count FROM photos').get()?.count,0)

class Statement {
 constructor(public query:string, public params:unknown[]=[]){}
 bind(...values:unknown[]){return new Statement(this.query,values)}
 async first(){return sql.prepare(this.query).get(...this.params as any[])??null}
 async all(){return {results:sql.prepare(this.query).all(...this.params as any[])}}
 async run(){const r=sql.prepare(this.query).run(...this.params as any[]);return {meta:{changes:Number(r.changes)}}}
}
const objects=new Map<string,{bytes:Uint8Array;type:string}>()
let onPut: (() => void) | undefined
const env={DB:{prepare:(query:string)=>new Statement(query),batch:async(stmts:Statement[])=>{sql.exec('BEGIN');try{const r=await Promise.all(stmts.map(s=>s.run()));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}},PHOTOS:{
 put:async(key:string,body:Blob|ArrayBuffer,options?:{httpMetadata?:{contentType?:string};onlyIf?:unknown})=>{
  if(options?.onlyIf&&objects.has(key))return null
  objects.set(key,{bytes:new Uint8Array(body instanceof Blob?await body.arrayBuffer():body),type:options?.httpMetadata?.contentType??''})
  onPut?.()
  return {key}
 },
 head:async(key:string)=>{
  const photo=objects.get(key)
  return photo?{size:photo.bytes.byteLength,httpMetadata:{contentType:photo.type}}:null
 },
 get:async(key:string)=>{
  const photo=objects.get(key)
  return photo?{body:photo.bytes,arrayBuffer:async()=>photo.bytes.slice().buffer}:null
 },
 delete:async(keys:string|string[])=>{for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key)},
},SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_ANON_KEY:'test-publishable-key',ADMIN_EMAILS:'admin@example.test'}
const users:Record<string,unknown>={valid:{email:'admin@example.test',email_confirmed_at:'2026-11-06T00:00:00Z'},other:{email:'other@example.test',email_confirmed_at:'2026-11-06T00:00:00Z'},unverified:{email:'admin@example.test'}}
const sent:string[]=[]
const originalFetch=globalThis.fetch
globalThis.fetch=async(input,options)=>{
 const url=String(input);assert(url.startsWith(env.SUPABASE_URL+'/auth/v1/'))
 const h=new Headers(options?.headers);assert.equal(h.get('apikey'),env.SUPABASE_ANON_KEY)
 if(url.endsWith('/user')){const user=users[h.get('Authorization')?.replace('Bearer ','')||''];return user?Response.json(user):Response.json({error:'invalid token'},{status:401})}
 const data=options?.body?JSON.parse(String(options.body)):{}
 if(url.endsWith('/otp')){assert.equal(data.create_user,false);sent.push(data.email);return Response.json({})}
 if(url.endsWith('/verify'))return data.email==='admin@example.test'&&data.token==='123456'?Response.json({access_token:'valid',refresh_token:'refresh-secret',expires_in:3600,user:users.valid}):Response.json({error:'invalid otp'},{status:400})
 if(url.includes('/token?'))return data.refresh_token==='refresh-secret'?Response.json({access_token:'valid',refresh_token:'refresh-secret',expires_in:3600,user:users.valid}):Response.json({error:'invalid refresh'},{status:401})
 if(url.includes('/logout?'))return Response.json({})
 throw Error('Unexpected provider endpoint '+url)
}
const token='valid'
const origin='https://sengguanauto.test'
async function call(path:string,method='GET',data?:unknown, auth=true,requestOrigin=origin){
 const headers:Record<string,string>={Origin:requestOrigin}
 if(auth)headers.Cookie='__Host-sga_access='+token
 let body:BodyInit|undefined
 if(data instanceof FormData){const initial=new Request(origin+path,{method,body:data});headers['Content-Type']=initial.headers.get('content-type')!;const buffer=await initial.arrayBuffer();headers['Content-Length']=String(buffer.byteLength);body=buffer}
 else if(data!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(data)}
 return onRequest({request:new Request(origin+path,{method,headers,body}),env} as any)
}
test('authorized vehicle lifecycle, drafts and photos stay private, validation and same-origin enforcement',async()=>{
 assert.equal((await call('/api/admin/vehicles','GET',undefined,false)).status,401)
 for(const token of ['forged','expired','other','unverified']) {
  const denied=await onRequest({request:new Request(origin+'/api/admin/session',{headers:{Cookie:'__Host-sga_access='+token}}),env} as any)
  assert.equal(denied.status,token==='other'||token==='unverified'?403:401)
 }
 assert.equal((await call('/api/admin/session')).status,200)
 const sample={name:'Test vehicle',make:'Toyota',year:2020,body:'SUV',fuel:'Petrol',transmission:'Automatic',status:'available',featured:true,price:45000,mileage:70000,description:'Test description'}
 assert.equal((await call('/api/admin/vehicles','POST',{...sample,year:1800})).status,400)
 assert.equal((await call('/api/admin/vehicles','POST',{...sample,name:''})).status,400)
 assert.equal((await call('/api/admin/vehicles','POST',{...sample,price:-1})).status,400)
 assert.equal((await call('/api/admin/vehicles','POST',{...sample,description:'x'.repeat(50000)})).status,413)
 assert.equal((await call('/api/admin/vehicles','POST',sample,true,'https://attacker.test')).status,403)
 const created=await call('/api/admin/vehicles','POST',{...sample,plate_number:' wxy 1234 '})
 assert.equal(created.status,201)
 const draft=await created.json() as any
 assert.equal(draft.status,'draft')
 assert.equal(draft.published_at,null)
 assert.equal(draft.plate_number,'WXY 1234')
 assert.equal((await call('/api/admin/vehicles/'+draft.id,'PUT',{...sample,plate_number:'x'.repeat(33)})).status,400)
 assert.deepEqual((await (await call('/api/vehicles','GET',undefined,false)).json() as any).vehicles,[])
 assert.equal((await call('/api/admin/vehicles/'+draft.id,'PUT',sample)).status,400)
 assert.equal((await call('/api/admin/vehicles/'+draft.id,'PATCH',{status:'reserved'})).status,400)
 const spoof=new FormData();spoof.append('file',new File(['not a JPEG'],'fake.jpg',{type:'image/jpeg'}));assert.equal((await call(`/api/admin/vehicles/${draft.id}/photos`,'POST',spoof)).status,400)
 assert.equal(objects.size,0)
 const ids=[]
 for(let i=0;i<2;i++){const form=new FormData();form.append('file',new File([readFileSync(new URL('../../resources/CarPhotos/1.jpg',import.meta.url))],`photo${i}.jpg`,{type:'image/jpeg'}));const uploaded=await call(`/api/admin/vehicles/${draft.id}/photos`,'POST',form);assert.equal(uploaded.status,201);const v=await uploaded.json() as any;ids.push(v.photos.at(-1).id)}
 assert.equal((await call('/api/photos/'+ids[0],'GET',undefined,false)).status,404)
 assert.equal((await call('/api/admin/vehicles/'+draft.id,'PUT',{...sample,photoOrder:[ids[0],ids[0]]})).status,409)
 const publish=await call('/api/admin/vehicles/'+draft.id,'PUT',{...sample,photoOrder:[...ids].reverse()});assert.equal(publish.status,200);assert.equal((await publish.json() as any).photos[0].id,ids[1])
 const published=(await (await call('/api/vehicles','GET',undefined,false)).json() as any).vehicles;assert.equal(published.length,1);assert.equal(published[0].price,45000);assert.equal(published[0].description,'Test description');assert(!JSON.stringify(published).includes('object_key'))
 const publicationDate = published[0].published_at
 assert.ok(Number.isFinite(Date.parse(publicationDate)))
 assert.equal(Object.hasOwn(published[0],'plate_number'),false)
 assert.equal(JSON.stringify(published).includes('WXY 1234'),false)
 const adminPath='/api/admin/vehicles/'+draft.id
 assert.equal((await (await call(adminPath)).json() as any).plate_number,'WXY 1234')
 assert.equal((await call(adminPath,'PUT',{...sample,status:'reserved'})).status,200)
 assert.equal((await call(adminPath,'PATCH',{status:'reserved'},false)).status,401)
 assert.equal((await call(adminPath,'PATCH',{status:'reserved'},true,'https://attacker.test')).status,403)
 assert.equal((await call(adminPath,'PATCH',{status:'invalid'})).status,400)
 for (const status of ['reserved','sold','available']) {
  const response=await call(adminPath,'PATCH',{status,name:'Ignored'})
  assert.equal(response.status,200)
  const publicVehicle=await (await call('/api/vehicles/'+draft.id,'GET',undefined,false)).json() as any
  assert.equal(publicVehicle.status,status)
  assert.equal(publicVehicle.published_at,publicationDate)
  assert.equal(Object.hasOwn(publicVehicle,'plate_number'),false)
  assert.equal(publicVehicle.name,sample.name)
  assert.equal(publicVehicle.price,sample.price)
  assert.equal(publicVehicle.mileage,sample.mileage)
  assert.deepEqual(publicVehicle.photos.map((photo: {id:string})=>photo.id),[...ids].reverse())
 }
 assert.equal((await call('/api/photos/'+ids[1],'GET',undefined,false)).status,200)
 assert.equal((await call(`/api/admin/vehicles/${draft.id}/photos/${ids[0]}`,'DELETE')).status,200)
 assert.equal((await call(`/api/admin/vehicles/${draft.id}/photos/${ids[1]}`,'DELETE')).status,400)
 assert.equal((await call('/api/admin/vehicles/'+draft.id,'PUT',{...sample,status:'draft',photoOrder:[ids[1]]})).status,200)
 assert.equal((await call('/api/photos/'+ids[1],'GET',undefined,false)).status,404)
 assert.equal((await call('/api/admin/vehicles/'+draft.id,'DELETE',undefined,false)).status,401)
 assert.equal((await call('/api/admin/vehicles/'+draft.id,'DELETE')).status,200)
 assert.equal(objects.size,0)
 assert.equal((await call('/api/admin/vehicles/'+draft.id)).status,404)
 assert.equal((await call('/api/auth/request-code','POST',{email:'outsider@example.test'},false)).status,200)
 assert.equal(sent.length,0)
 assert.equal((await call('/api/auth/request-code','POST',{email:'admin@example.test'},false)).status,200)
 assert.deepEqual(sent,['admin@example.test'])
 assert.equal((await call('/api/auth/verify-code','POST',{email:'admin@example.test',code:'000000'},false)).status,400)
 assert.equal((await call('/api/auth/verify-code','POST',{email:'admin@example.test',code:'123456'},false,'https://attacker.test')).status,403)
 const verified=await call('/api/auth/verify-code','POST',{email:'admin@example.test',code:'123456'},false)
 assert.equal(verified.status,200)
 assert.deepEqual(await verified.json(),{email:'admin@example.test'})
 const cookies=verified.headers.getSetCookie();assert.equal(cookies.length,2)
 for(const cookie of cookies){assert(cookie.includes('HttpOnly'));assert(cookie.includes('Secure'));assert(cookie.includes('SameSite=Lax'));assert(cookie.includes('Path=/'))}
 const refreshed=await onRequest({request:new Request(origin+'/api/auth/refresh',{method:'POST',headers:{Origin:origin,Cookie:'__Host-sga_refresh=refresh-secret'}}),env} as any)
 assert.equal(refreshed.status,200)
 assert(!JSON.stringify(await refreshed.json()).includes('refresh-secret'))
 const logout=await call('/api/auth/logout','POST',{},true);assert.equal(logout.status,200);assert(logout.headers.getSetCookie().every(c=>c.includes('Max-Age=0')))
 for(let i=0;i<5;i++)assert.equal((await call('/api/auth/request-code','POST',{email:'admin@example.test'},false)).status,200)
 assert.equal((await call('/api/auth/request-code','POST',{email:'admin@example.test'},false)).status,429)
})
test.after(()=>{globalThis.fetch=originalFetch})

test('a multipart save commits details, uploads, cover order and removals together',async()=>{
 const createId=crypto.randomUUID()
 const path='/api/admin/vehicles/'+createId
 const publicPath='/api/vehicles/'+createId
 const file=new File([readFileSync(new URL('../../resources/CarPhotos/1.jpg',import.meta.url))],'car.jpg',{type:'image/jpeg'})
 const details={createId,name:'Before',make:'Toyota',year:2020,status:'available',plate_number:'WXY 4321'}
 const create=(photos:string[])=>{
  const form=new FormData()
  form.set('vehicle',JSON.stringify({...details,photoOrder:photos}))
  for(const id of photos)form.set('photo:'+id,file)
  return form
 }
 assert.equal((await call('/api/admin/vehicles','POST',create([]))).status,400)
 const created=await call('/api/admin/vehicles','POST',create(['initial-1','initial-2']))
 assert.equal(created.status,201)
 const first=await created.json() as any
 assert.equal(first.photo,'/api/admin/photos/initial-1')
 assert.equal(first.plate_number,'WXY 4321')
 assert.ok(Number.isFinite(Date.parse(first.published_at)))
 assert.equal(Object.hasOwn(await (await call(publicPath,'GET',undefined,false)).json() as object,'plate_number'),false)
 assert.equal((await call('/api/admin/vehicles','POST',create(['initial-1','initial-2']))).status,409)
 const edit=()=>{
  const form=new FormData()
  form.set('vehicle',JSON.stringify({...details,name:'After',updatedAt:first.updated_at,originalPhotoOrder:['initial-1','initial-2'],photoOrder:['new-cover','initial-2']}))
  form.set('photo:new-cover',file)
  return form
 }
 onPut=()=>{
  assert.equal(sql.prepare('SELECT name FROM vehicles WHERE id=?').get(createId)?.name,'Before')
  assert.deepEqual(sql.prepare('SELECT id FROM photos WHERE vehicle_id=? ORDER BY position').all(createId).map(p=>p.id),['initial-1','initial-2'])
  throw Error('Simulated storage failure')
 }
 try {
  assert.equal((await call(path,'PUT',edit())).status,500)
  assert.equal(objects.size,2)
  assert.equal((await (await call(publicPath,'GET',undefined,false)).json() as any).name,'Before')
 } finally { onPut=undefined }

 const updated=await call(path,'PUT',edit())
 assert.equal(updated.status,200)
 const saved=await (await call(publicPath,'GET',undefined,false)).json() as any
 assert.equal(saved.name,'After')
 assert.deepEqual(saved.photos.map((photo: {id:string})=>photo.id),['new-cover','initial-2'])
 assert.equal(saved.photo,'/api/photos/new-cover')
 assert.equal((await call('/api/photos/initial-1','GET',undefined,false)).status,404)
 assert.equal((await call('/api/photos/new-cover','GET',undefined,false)).status,200)
 assert.equal(objects.size,2)
 assert.equal((await call(path,'PUT',edit())).status,409)

 const concurrent=edit()
 concurrent.set('vehicle',JSON.stringify({...details,name:'Stale name',updatedAt:saved.updated_at,originalPhotoOrder:['new-cover','initial-2'],photoOrder:['concurrent-upload','new-cover']}))
 concurrent.delete('photo:new-cover')
 concurrent.set('photo:concurrent-upload',file)
 onPut=()=>{sql.prepare("UPDATE vehicles SET updated_at='2030-01-01T00:00:00.000Z' WHERE id=?").run(createId)}
 try {
  assert.equal((await call(path,'PUT',concurrent)).status,409)
  assert.equal(objects.size,2)
  const unchanged=await (await call(publicPath,'GET',undefined,false)).json() as any
  assert.equal(unchanged.name,'After')
  assert.deepEqual(unchanged.photos.map((photo: {id:string})=>photo.id),['new-cover','initial-2'])
 } finally { onPut=undefined }
 assert.equal((await call(path,'DELETE')).status,200)
})

test('selected photos can upload privately before the vehicle save',async()=>{
 const id=crypto.randomUUID()
 const stagedPath='/api/admin/staged-photos/'+id
 const form=new FormData()
 form.set('file',new File([readFileSync(new URL('../../resources/CarPhotos/1.jpg',import.meta.url))],'car.jpg',{type:'image/jpeg'}))
 assert.equal((await call(stagedPath,'POST',form,false)).status,401)
 assert.equal((await call(stagedPath,'POST',form,true,'https://attacker.test')).status,403)
 assert.equal((await call(stagedPath,'POST',form)).status,201)
 assert.equal((await call(stagedPath,'POST',form)).status,409)
 assert.equal((await call('/api/photos/'+id,'GET',undefined,false)).status,404)
 assert.equal(sql.prepare('SELECT id FROM photos WHERE id=?').get(id),undefined)
 assert.equal(objects.size,1)
 const saveForm=new FormData()
 saveForm.set('vehicle',JSON.stringify({createId:crypto.randomUUID(),name:'Uploaded privately',make:'Toyota',year:2020,status:'available',photoOrder:[id]}))
 onPut=()=>{throw Error('Simulated publish failure')}
 try {
  assert.equal((await call('/api/admin/vehicles','POST',saveForm)).status,500)
  assert.equal(objects.size,1)
  assert.equal((await call('/api/photos/'+id,'GET',undefined,false)).status,404)
 } finally { onPut=undefined }
 const published=await call('/api/admin/vehicles','POST',saveForm)
 assert.equal(published.status,201)
 const vehicle=await published.json() as {id:string;photo:string}
 assert.equal(vehicle.photo,'/api/admin/photos/'+id)
 assert.equal((await call('/api/photos/'+id,'GET',undefined,false)).status,200)
 assert.equal(objects.size,1)
 assert.ok([...objects.keys()][0].startsWith('vehicles/'))
 assert.equal((await call(stagedPath,'DELETE')).status,200)
 assert.equal(objects.size,1)
 assert.equal((await call('/api/admin/vehicles/'+vehicle.id,'DELETE')).status,200)
})

test('mileage bands persist without replacing legacy exact mileage on unrelated edits', async () => {
 const base={name:'Mileage test',make:'Proton',year:2021,status:'draft',mileage:38000}
 const created=await call('/api/admin/vehicles','POST',base)
 assert.equal(created.status,201)
 const vehicle=await created.json() as {id:string;mileage:number;mileage_band:number|null}
 assert.equal(vehicle.mileage,38000)
 const path='/api/admin/vehicles/'+vehicle.id
 assert.equal((await call(path,'PUT',{...base,mileage_band:39999})).status,400)
 const changed=await call(path,'PUT',{...base,mileage_band:40000})
 assert.equal(changed.status,200)
 const band=await changed.json() as {mileage:number|null;mileage_band:number}
 assert.equal(band.mileage,null)
 assert.equal(band.mileage_band,40000)
 const legacySave=await call(path,'PUT',{...base,mileage:null,name:'Legacy edit'})
 assert.equal((await legacySave.json() as {mileage_band:number}).mileage_band,40000)
 const cleared=await call(path,'PUT',{...base,mileage:null,mileage_band:null})
 assert.equal((await cleared.json() as {mileage_band:null}).mileage_band,null)
 await call(path,'DELETE')
})

test('named watermarks stay private and a vehicle save publishes only the rendered photo',async()=>{
 const photo = new File([readFileSync(new URL('../../resources/CarPhotos/1.jpg',import.meta.url))],'original.jpg',{type:'image/jpeg'})
 const derivative = new File([readFileSync(new URL('../../resources/CarPhotos/2.jpg',import.meta.url))],'rendered.jpg',{type:'image/jpeg'})
 const library = '/api/admin/watermarks'
 const upload = new FormData()
 upload.set('name','Showroom mark')
 upload.set('file',photo)
 assert.equal((await call(library,'POST',upload,false)).status,401)
 const createdAsset = await call(library,'POST',upload)
 assert.equal(createdAsset.status,201)
 const asset = await createdAsset.json() as {id:string;name:string;url:string}
 assert.equal(asset.name,'Showroom mark')
 assert.equal((await call(library,'POST',upload)).status,409)
 assert.equal((await call(asset.url,'GET',undefined,false)).status,401)
 assert.equal((await call(asset.url)).status,200)
 assert.deepEqual((await (await call(library)).json() as any).watermarks,[{...asset,defaults:{scale:.28,opacity:.8,x:.95,y:.95}}])
 const id = crypto.randomUUID()
 const photoId = 'watermark-cover'
 const mark = {watermarkId:asset.id,x:.3,y:.6,scale:.4,opacity:.35}
 const details = {createId:id,name:'Watermarked car',make:'Toyota',year:2021,status:'available',photoOrder:[photoId]}
 const payload = (placement:unknown, updatedAt?:string) => {
  const form = new FormData()
  form.set('vehicle',JSON.stringify({...details,updatedAt,originalPhotoOrder:[photoId],watermarks:{[photoId]:placement}}))
  if (!updatedAt) form.set('photo:'+photoId,photo)
  if (placement) form.set('watermark:'+photoId,derivative)
  return form
 }
 const path = '/api/admin/vehicles/'+id
 assert.equal((await call('/api/admin/vehicles','POST',payload({...mark,opacity:1.1}))).status,400)
 const created = await call('/api/admin/vehicles','POST',payload(mark))
 assert.equal(created.status,201)
 const admin = await created.json() as any
 assert.deepEqual(admin.photos[0].watermark,mark)
 assert.match(admin.photo,/\?v=/)
 const publicVehicle = await (await call('/api/vehicles/'+id,'GET',undefined,false)).json() as any
 assert.equal(Object.hasOwn(publicVehicle.photos[0],'watermark'),false)
 assert.equal(Object.hasOwn(publicVehicle.photos[0],'watermarks'),false)
 assert.equal(Object.hasOwn(publicVehicle.photos[0],'original_url'),false)
 assert.deepEqual(await (await call(publicVehicle.photo,'GET',undefined,false)).arrayBuffer(),await derivative.arrayBuffer())
 assert.deepEqual(await (await call('/api/photos/'+photoId,'GET',undefined,false)).arrayBuffer(),await derivative.arrayBuffer())
 assert.deepEqual(await (await call(admin.photos[0].original_url)).arrayBuffer(),await photo.arrayBuffer())
 const layers = [{...mark,opacity:.7},{...mark,x:.85,scale:.22,opacity:1}]
 assert.equal((await call(path,'PUT',payload(Array(11).fill(mark),admin.updated_at))).status,400)
 assert.equal((await call(path,'PUT',payload([mark,{...mark,watermarkId:crypto.randomUUID()}],admin.updated_at))).status,404)
 const update = await call(path,'PUT',payload(layers,admin.updated_at))
 assert.equal(update.status,200)
 const updated = await update.json() as any
 assert.equal(updated.photos[0].watermark.opacity,.7)
 assert.deepEqual(updated.photos[0].watermarks,layers)
 assert.notEqual(updated.photo,admin.photo)
 const removed = await call(path,'PUT',payload([],updated.updated_at))
 assert.equal(removed.status,200)
 assert.equal((await removed.json() as any).photos[0].watermark,null)
 assert.deepEqual(await (await call('/api/photos/'+photoId,'GET',undefined,false)).arrayBuffer(),await photo.arrayBuffer())
 assert.equal([...objects.keys()].filter(key=>key.startsWith('vehicle-watermarks/')).length,0)
 assert.equal((await call(path,'DELETE')).status,200)
})

test('watermark defaults are private, validated and persist independently of photos', async () => {
 const library = '/api/admin/watermarks'
 const settings = library+'/settings'
 const defaults = async () => (await (await call(library)).json() as {defaults:unknown}).defaults
 assert.deepEqual(await defaults(),{scale:.28,opacity:.8})
 assert.equal((await call(settings,'PUT',{scale:.5,opacity:.6},false)).status,401)
 assert.equal((await call(settings,'PUT',{scale:.5,opacity:.6},true,'https://attacker.test')).status,403)
 assert.equal((await call(settings,'PUT',{scale:.09,opacity:.6})).status,400)
 assert.equal((await call(settings,'PUT',{scale:.5,opacity:1.1})).status,400)
 assert.deepEqual(await defaults(),{scale:.28,opacity:.8})
 for (const values of [{scale:.4,opacity:.65},{scale:1,opacity:0}]) {
  const response = await call(settings,'PUT',values)
  assert.equal(response.status,200)
  assert.deepEqual(await response.json(),values)
  assert.deepEqual(await defaults(),values)
 }
})

test('watermark assets retain independent defaults and use the former shared defaults as fallback', async () => {
 const library = '/api/admin/watermarks'
 const asset = sql.prepare('SELECT id FROM watermark_assets LIMIT 1').get() as {id:string}
 const otherId = crypto.randomUUID()
 sql.prepare("INSERT INTO watermark_assets(id,name,content_type) VALUES(?,?,'image/jpeg')").run(otherId,'Other watermark')
 const path = library+'/'+asset.id
 const values = {scale:.53,opacity:.37,x:0,y:.42}
 assert.equal((await call(path,'PUT',values,false)).status,401)
 assert.equal((await call(path,'PUT',values,true,'https://attacker.test')).status,403)
 assert.equal((await call(path,'PUT',{...values,scale:.09})).status,400)
 assert.equal((await call(path,'PUT',{...values,x:1.1})).status,400)
 assert.equal((await call(path,'PUT',{...values,y:null})).status,400)
 assert.equal((await call(library+'/'+crypto.randomUUID(),'PUT',values)).status,404)
 const updated = await call(path,'PUT',values)
 assert.equal(updated.status,200)
 assert.deepEqual(await updated.json(),values)
 const other = await call(library+'/'+otherId,'PUT',{scale:.7,opacity:0})
 assert.equal(other.status,200)
 const {watermarks,defaults} = await (await call(library)).json() as any
 assert.deepEqual(watermarks.find((item:any)=>item.id===asset.id).defaults,values)
 assert.deepEqual(watermarks.find((item:any)=>item.id===otherId).defaults,{scale:.7,opacity:0,x:.95,y:.95})
 assert.deepEqual(defaults,{scale:1,opacity:0})
 sql.prepare('INSERT INTO watermark_assets(id,name,content_type) VALUES(?,?,?)').run(crypto.randomUUID(),'Legacy fallback','image/jpeg')
 assert.equal((await call(path,'PUT',{scale:.6,opacity:.5})).status,200)
 const refreshed = await (await call(library)).json() as any
 assert.deepEqual(refreshed.watermarks.find((item:any)=>item.id===asset.id).defaults,{scale:.6,opacity:.5,x:0,y:.42})
 assert.deepEqual(refreshed.watermarks.find((item:any)=>item.name==='Legacy fallback').defaults,{...defaults,x:.95,y:.95})
})

test('watermark rename validates names and preserves asset identity and defaults', async () => {
 const id = crypto.randomUUID()
 sql.prepare("INSERT INTO watermark_assets(id,name,content_type,default_scale) VALUES(?,?,'image/jpeg',.51)").run(id,'Rename this')
 sql.prepare("INSERT INTO watermark_assets(id,name,content_type) VALUES(?,?,'image/jpeg')").run(crypto.randomUUID(),'Taken name')
 const path = '/api/admin/watermarks/'+id
 assert.equal((await call(path,'PATCH',{name:'New name'},false)).status,401)
 assert.equal((await call(path,'PATCH',{name:'New name'},true,'https://attacker.test')).status,403)
 assert.equal((await call(path,'PATCH',{name:'  '})).status,400)
 assert.equal((await call(path,'PATCH',{name:'a'.repeat(81)})).status,400)
 assert.equal((await call(path,'PATCH',{name:' TAKEN NAME '})).status,409)
 assert.equal((await call('/api/admin/watermarks/'+crypto.randomUUID(),'PATCH',{name:'New name'})).status,404)
 const renamed = await call(path,'PATCH',{name:' Updated name '})
 assert.equal(renamed.status,200)
 assert.deepEqual(await renamed.json(),{name:'Updated name'})
 assert.equal((await call(path,'PATCH',{name:'UPDATED NAME'})).status,200)
 const library = await (await call('/api/admin/watermarks')).json() as any
 const item = library.watermarks.find((asset:any)=>asset.id===id)
 assert.equal(item.name,'UPDATED NAME')
 assert.equal(item.url,path)
 assert.equal(item.defaults.scale,.51)
})

test('resetting range-only mileage retains exact and unrecorded mileage', () => {
 const insert = sql.prepare("INSERT INTO vehicles(id,name,make,year,mileage,mileage_band,updated_at) VALUES(?,?,'Toyota',2020,?,?,'2026-01-01T00:00:00.000Z')")
 insert.run('range','Range only',null,150000)
 insert.run('exact','Exact mileage',128500,null)
 insert.run('unknown','No mileage',null,null)
 const migration = readFileSync(new URL('../migrations/0011_reset_range_only_mileage.sql',import.meta.url),'utf8')
 sql.exec(migration)
 const row = (id: string) => sql.prepare('SELECT mileage,mileage_band,updated_at FROM vehicles WHERE id=?').get(id)
 const changed = row('range')!
 assert.equal(changed.mileage,0)
 assert.equal(changed.mileage_band,null)
 assert.notEqual(changed.updated_at,'2026-01-01T00:00:00.000Z')
 assert.equal(row('exact')?.mileage,128500)
 assert.equal(row('unknown')?.mileage,null)
 sql.exec(migration)
 assert.equal(row('range')?.updated_at,changed.updated_at)
})

test('vehicle makes are canonicalized on save and grouped case-insensitively for existing stock', async () => {
 const base = {name:'Make test',year:2020,status:'draft'}
 const post = async (make: string) => {
  const response = await call('/api/admin/vehicles','POST',{...base,make})
  assert.equal(response.status,201)
  return await response.json() as {id:string;make:string}
 }
 const exact = await post(' PERODUA ')
 assert.equal(exact.make,'Perodua')
 const custom = await post('Example Motors')
 assert.equal((await post('example   MOTORS')).make,custom.make)
 const edited = await call('/api/admin/vehicles/'+exact.id,'PUT',{...base,make:'bMw'})
 assert.equal((await edited.json() as {make:string}).make,'BMW')
 sql.prepare('UPDATE vehicles SET make=? WHERE id=?').run('pErOdUa',exact.id)
 const migration = readFileSync(new URL('../migrations/0012_normalize_vehicle_makes.sql',import.meta.url),'utf8')
 sql.exec(migration)
 assert.equal(sql.prepare('SELECT make FROM vehicles WHERE id=?').get(exact.id)?.make,'Perodua')
})

test('localized vehicle templates are protected defaults and published as independent vehicle copies', async () => {
 const settings = '/api/admin/vehicle-template'
 const defaults = {en:'Visit us.',ms:'Kunjungi kami.',zh:'欢迎到店。'}
 assert.equal((await call(settings,'GET',undefined,false)).status,401)
 assert.equal((await call(settings,'PUT',defaults,true,'https://attacker.test')).status,403)
 assert.deepEqual(await (await call(settings)).json(),{en:'',ms:'',zh:''})
 assert.equal((await call(settings,'PUT',{...defaults,zh:123})).status,400)
 assert.deepEqual(await (await call(settings,'PUT',defaults)).json(),defaults)
 assert.deepEqual(await (await call(settings)).json(),defaults)

 const car = {name:'Template car',make:'Toyota',year:2020,description:'Original vehicle description',status:'draft'}
 const createId = crypto.randomUUID()
 const form = new FormData()
 form.set('vehicle',JSON.stringify({...car,createId,photoOrder:[],description_template:{...defaults,en:'Car-specific English'}}))
 const created = await call('/api/admin/vehicles','POST',form)
 assert.equal(created.status,201)
 assert.equal((await call('/api/admin/vehicles/'+createId,'PUT',car)).status,200)
 await call(settings,'PUT',{...defaults,en:'Future listings only'})
 sql.prepare("UPDATE vehicles SET status='available' WHERE id=?").run(createId)
 const published = await (await call('/api/vehicles/'+createId,'GET',undefined,false)).json() as any
 assert.equal(published.description,car.description)
 assert.deepEqual(published.description_template,{...defaults,en:'Car-specific English'})
 const legacy = await call('/api/admin/vehicles','POST',car)
 const old = await legacy.json() as any
 assert.equal(old.description,car.description)
 assert.equal(old.description_template,null)
})
