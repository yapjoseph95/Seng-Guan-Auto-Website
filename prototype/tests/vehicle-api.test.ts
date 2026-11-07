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
const objects=new Map<string,Uint8Array>()
const env={DB:{prepare:(query:string)=>new Statement(query),batch:async(stmts:Statement[])=>{sql.exec('BEGIN');try{const r=await Promise.all(stmts.map(s=>s.run()));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}},PHOTOS:{put:async(k:string,b:Uint8Array)=>objects.set(k,b),get:async(k:string)=>objects.has(k)?{body:objects.get(k)}:null,delete:async(keys:string|string[])=>{for(const k of Array.isArray(keys)?keys:[keys])objects.delete(k)}},SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_ANON_KEY:'test-publishable-key',ADMIN_EMAILS:'admin@example.test'}
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
 const created=await call('/api/admin/vehicles','POST',sample);assert.equal(created.status,201);const draft=await created.json() as any;assert.equal(draft.status,'draft')
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
 const adminPath='/api/admin/vehicles/'+draft.id
 assert.equal((await call(adminPath,'PUT',{...sample,status:'reserved'})).status,200)
 assert.equal((await call(adminPath,'PATCH',{status:'reserved'},false)).status,401)
 assert.equal((await call(adminPath,'PATCH',{status:'reserved'},true,'https://attacker.test')).status,403)
 assert.equal((await call(adminPath,'PATCH',{status:'invalid'})).status,400)
 for (const status of ['reserved','sold','available']) {
  const response=await call(adminPath,'PATCH',{status,name:'Ignored'})
  assert.equal(response.status,200)
  const publicVehicle=await (await call('/api/vehicles/'+draft.id,'GET',undefined,false)).json() as any
  assert.equal(publicVehicle.status,status)
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
 globalThis.fetch=originalFetch
})
