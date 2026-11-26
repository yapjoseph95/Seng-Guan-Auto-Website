import {test} from 'node:test'
import assert from 'node:assert/strict'
import {verifyMailSignature,mailAddress,notificationRecipients} from '../server/mail.ts'
const secret='whsec_'+btoa('test-secret-for-signature')
async function signed(body:string, time=String(Math.floor(Date.now()/1000))) {
 const id='msg_test'
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-secret-for-signature'),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${id}.${time}.${body}`))
 return new Headers({'svix-id':id,'svix-timestamp':time,'svix-signature':'v1,'+btoa(String.fromCharCode(...new Uint8Array(bytes)))})
}
test('only company sender addresses are accepted',()=>{assert.equal(mailAddress('sales@sengguanauto.com.my'),'sales@sengguanauto.com.my');assert.throws(()=>mailAddress('evil@example.com'));assert.throws(()=>mailAddress('sales@sengguanauto.com.my\r\nBcc:x@y.com'))})
test('valid raw webhook verifies; forged, modified and expired payloads fail',async()=>{const body='{"type":"email.received"}';assert.equal(await verifyMailSignature(body,await signed(body),secret),true);assert.equal(await verifyMailSignature(body+' ',await signed(body),secret),false);assert.equal(await verifyMailSignature(body,await signed(body,'1'),secret),false);assert.equal(await verifyMailSignature(body,new Headers(),secret),false)})
test('notification recipients are normalized, deduplicated and cannot create loops',()=>{assert.deepEqual(notificationRecipients([' A@HOTMAIL.COM ','a@hotmail.com']),['a@hotmail.com']);assert.throws(()=>notificationRecipients(['sales@sengguanauto.com.my']));assert.throws(()=>notificationRecipients(['bad']));assert.throws(()=>notificationRecipients([]))})

import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {onRequest} from '../functions/api/[[path]].ts'
import {mailApi,receiveMail} from '../server/mail.ts'
const db=new DatabaseSync(':memory:')
db.exec(readFileSync(new URL('../migrations/0016_mail_center.sql',import.meta.url),'utf8'))
db.exec(readFileSync(new URL('../migrations/0017_mail_features.sql',import.meta.url),'utf8'))
db.exec(readFileSync(new URL('../migrations/0018_resend_inboxes.sql',import.meta.url),'utf8'))
db.exec(readFileSync(new URL('../migrations/0019_mail_signatures.sql',import.meta.url),'utf8'))
db.exec(readFileSync(new URL('../migrations/0020_mail_drafts.sql',import.meta.url),'utf8'))
db.exec(readFileSync(new URL('../migrations/0021_mail_branding.sql',import.meta.url),'utf8'))
db.exec(readFileSync(new URL('../migrations/0022_mail_footer.sql',import.meta.url),'utf8'))
class Stmt{constructor(public sql:string,public params:unknown[]=[]){}bind(...p:unknown[]){return new Stmt(this.sql,p)}async first(){return db.prepare(this.sql).get(...this.params as any[])||null}async all(){return {results:db.prepare(this.sql).all(...this.params as any[])}}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.params as any[]).changes)}}}}
const storage=new Map<string,string|Uint8Array>()
const env={DB:{prepare:(s:string)=>new Stmt(s),batch:async(stmts:Stmt[])=>{db.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}},PHOTOS:{head:async(k:string)=>{const v=storage.get(k);return v?{size:typeof v==='string'?new TextEncoder().encode(v).length:v.length}:null},put:async(k:string,v:string|Uint8Array|ArrayBuffer,opts?:any)=>{if(opts?.onlyIf&&storage.has(k))return null;storage.set(k,v instanceof ArrayBuffer?new Uint8Array(v):v);return {}},get:async(k:string)=>{const v=storage.get(k);return v?{json:async()=>JSON.parse(String(v)),body:v,arrayBuffer:async()=>typeof v==='string'?new TextEncoder().encode(v).buffer:(v as Uint8Array).slice().buffer}:null}},RESEND_API_KEY:'test',RESEND_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test',ADMIN_EMAILS:'owner@example.com'} as any
const originalFetch=globalThis.fetch
const sends:{key:string;body:any}[]=[]
let failSecond=false
let failDownload=false
const mailId='12345678-1234-1234-1234-123456789abc'
const nativeThread='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const nativeEmail={id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',direction:'inbound',from:'customer@example.com',to:['sales@sengguanauto.com.my'],cc:[],bcc:[],reply_to:[],subject:'Thread',text:'First message',html:null,attachments:[],read:false,received_at:'2026-11-25T10:00:00Z'}
const nativeRequests:any[]=[];const nativeLabels:Record<string,any[]>={}
let listingPages:Record<string,any[]>|null=null
let nativeDrafts=0;const nativeDraftPayloads:any[]=[];const nativeSends:any[]=[]
let fetched=0
globalThis.fetch=(async(input:any,init:any)=>{
 const url=String(input)
 if(url==='https://api.resend.com/emails/receiving/bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb/attachments/native-file')return Response.json({download_url:'https://files.example.com/final'})
 if(url==='https://files.example.com/final')return new Response(new Uint8Array([7,8,9]))
 if(url.startsWith('https://api.resend.com/inboxes/')){
  const path=url.slice('https://api.resend.com'.length)
  nativeRequests.push({path,method:init?.method||'GET',body:init?.body?JSON.parse(init.body):null})
  const box=decodeURIComponent(new URL(url).pathname.split('/')[2])
  if(path.endsWith('/labels')&&!path.includes('/threads/')){if(init?.method==='POST'){const label={id:'12341234-1234-4234-8234-123412341234',...JSON.parse(init.body)};(nativeLabels[box]??=[]).push(label);return Response.json({id:label.id})}return Response.json({data:nativeLabels[box]||[]})}
  if(/\/labels\/[0-9a-f-]+$/.test(path)){const id=path.split('/').at(-1);nativeLabels[box]=(nativeLabels[box]||[]).filter(c=>c.id!==id);return Response.json({id,deleted:true})}
  if(path.includes('/threads/search?'))return Response.json({data:[],has_more:false})
  if(path.endsWith('/labels')&&init?.method==='PUT')return Response.json({data:[]})
  if(path==='/inboxes/cccccccc-cccc-4ccc-cccc-cccccccccccc')return Response.json({email_address:'admin@sengguanauto.com.my'})
  if(path==='/inboxes/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')return Response.json({email_address:'sales@sengguanauto.com.my'})
  if(path.includes('/emails/bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb')&&!path.endsWith('/forward'))return Response.json(nativeEmail)
  if(path.includes('/emails?'))return Response.json({data:[nativeEmail,{...nativeEmail,id:'cccccccc-cccc-4ccc-cccc-cccccccccccc',text:'Second message'}],has_more:false})
  if(path.includes('/threads?')&&listingPages){const parsed=new URL(url),box=decodeURIComponent(parsed.pathname.split('/')[2]),all=listingPages[box]||[],after=parsed.searchParams.get('after'),index=after?all.findIndex(t=>t.id===after)+1:0;return Response.json({data:all.slice(index,index+30),has_more:all.length>index+30})}
  if(path.includes('/threads?'))return Response.json({data:[{id:nativeThread,subject:'Thread',from:'customer@example.com',to:['sales@sengguanauto.com.my'],read:false,received_at:'2026-11-25T10:00:00Z',email_count:2}],has_more:true})
  if(init?.method==='PATCH')return Response.json({ok:true})
  if(path.endsWith('/drafts')){nativeDrafts++;nativeDraftPayloads.push(JSON.parse(init.body));return Response.json({id:'dddddddd-dddd-4ddd-dddd-dddddddddddd'})}
  if(path.endsWith('/send')||path.endsWith('/forward')){nativeSends.push({path,body:JSON.parse(init.body),key:init.headers['Idempotency-Key']});return Response.json({id:'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee'})}
 }

 if(url==='https://test.supabase.co/auth/v1/user')return Response.json({email:'owner@example.com',email_confirmed_at:'2026-11-01'})
 if(url==='https://api.resend.com/emails/receiving/'+mailId){fetched++;return Response.json({id:mailId,from:'Customer <customer@example.com>',to:['sales@sengguanauto.com.my','admin@sengguanauto.com.my'],subject:'A question',created_at:'2026-11-25T10:00:00Z',text:'Hello',html:null,message_id:'<customer-message@example.com>',attachments:[]})}
 if(url==='https://api.resend.com/emails/receiving/attachment-mail')return Response.json({id:'attachment-mail',from:'customer@example.com',to:['sales@sengguanauto.com.my'],subject:'With image',created_at:'2026-11-25T10:00:00Z',text:'Image attached',attachments:[{id:'image',filename:'photo.jpg',content_type:'image/jpeg',size:4}]})
 if(url==='https://api.resend.com/emails/receiving/attachment-mail/attachments/image')return Response.json({download_url:'https://files.resend.com/download',size:4})
 if(url==='https://files.resend.com/download'){if(failDownload)throw new Error('simulated download failure');return new Response(null,{status:302,headers:{Location:'https://files.resend.com/final'}})}
 if(url==='https://files.resend.com/final')return new Response(new Uint8Array([1,2,3,4]))
 if(url==='https://api.resend.com/emails'){const body=JSON.parse(init.body);if(failSecond&&body.to[0]==='sengguanauto.bos@hotmail.com')return new Response('unavailable',{status:503});sends.push({key:new Headers(init.headers).get('Idempotency-Key')!,body});return Response.json({id:'provider-id'})}
 throw new Error('Unexpected request '+url)
}) as typeof fetch
test('webhook retry preserves mail and retries only failed notifications; duplicate event is a no-op',async()=>{
 const raw=JSON.stringify({type:'email.received',data:{email_id:mailId}})
 const request=async()=>new Request('https://sengguanauto.com.my/api/mail-webhook',{method:'POST',body:raw,headers:await signed(raw)})
 failSecond=true;
 async function run(){return receiveMail(await request(),env)}
 // Fail the second destination after the first notification was accepted.
 await assert.rejects(run)
 assert.equal(db.prepare('SELECT count(*) AS n FROM mail_messages').get()?.n,1)
 assert.equal(sends.length,1)
 failSecond=false;await run();await run()
 assert.equal(fetched,1);assert.equal(sends.length,2)
 assert.deepEqual(sends.map(s=>s.body.to[0]),['sengguanauto.app@hotmail.com','sengguanauto.bos@hotmail.com'])
 assert(sends[0].body.text.includes('/admin?section=mail&message='+mailId))
 assert(!sends[0].body.text.includes('Hello'))
 const detail=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/'+mailId),env,[mailId])).json() as any
 assert.equal(detail.text,'Hello');assert.equal(detail.notifications.length,2);assert(detail.notifications.every((n:any)=>n.status==='sent'))
})
test('mail routes require login, same origin and signed webhook; arbitrary company senders fail',async()=>{
 const response=await onRequest({request:new Request('https://sengguanauto.com.my/api/admin/mail'),env} as any);assert.equal(response.status,401)
 const cross=await onRequest({request:new Request('https://sengguanauto.com.my/api/admin/mail/settings',{method:'PUT',headers:{Cookie:'__Host-sga_access=valid',Origin:'https://evil.example'},body:'{}'}),env} as any);assert.equal(cross.status,403)
 const forged=await onRequest({request:new Request('https://sengguanauto.com.my/api/mail-webhook',{method:'POST',body:'{}'}),env} as any);assert.equal(forged.status,401)
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'attacker@example.com'})}),env,['send']))
})
test('outbound retry uses one fixed idempotency key and records sent state; reply retains thread headers',async()=>{
 const id='out-12345678-1234-1234-1234-123456789abc'
 const payload={id,from:'sales@sengguanauto.com.my',to:'customer@example.com',subject:'Re: A question',text:'Thanks for your email.',replyId:mailId}
 const request=()=>new Request('https://sengguanauto.com.my/api/admin/mail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
 const before=sends.length;await mailApi(request(),env,['send']);await mailApi(request(),env,['send']);assert.equal(sends.length,before+1)
 assert.equal(sends.at(-1)?.key,'mail-send/'+id)
 assert.equal(sends.at(-1)?.body.headers['In-Reply-To'],'<customer-message@example.com>')
 payload.text='Different message';await assert.rejects(()=>mailApi(request(),env,['send']))
})
test('concurrent payload collisions leave a consistent retryable outbox',async()=>{
 const id='out-22345678-1234-1234-1234-123456789abc'
 const payload={id,from:'sales@sengguanauto.com.my',to:'customer@example.com',subject:'Concurrent',text:'First'}
 const send=(p:any)=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}),env,['send'])
 const results=await Promise.allSettled([send(payload),send({...payload,text:'Second',subject:'Different'})])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 const row=db.prepare('SELECT * FROM mail_messages WHERE id=?').get(id) as any
 const saved=JSON.parse(String(storage.get(row.content_key)))
 const winning=JSON.parse(saved.send_payload)
 assert.equal(row.subject,winning.subject)
 assert.equal(row.status,'sent')
 await send({...payload,text:winning.text,subject:winning.subject})
})
test('long valid notification targets use bounded idempotency keys',async()=>{
 const target='a'.repeat(64)+'@'+'b'.repeat(60)+'.'+'c'.repeat(60)+'.example.com'
 db.prepare('INSERT INTO mail_notifications(message_id,recipient) VALUES(?,?)').run(mailId,target)
 const {notifyMail}=await import('../server/mail.ts');await notifyMail(env,mailId)
 assert(sends.at(-1)!.key.length<=256)
})
test('failed attachment download still preserves the email and retry follows HTTPS redirects',async()=>{
 const raw=JSON.stringify({type:'email.received',data:{email_id:'attachment-mail'}})
 const run=async()=>receiveMail(new Request('https://sengguanauto.com.my/api/mail-webhook',{method:'POST',body:raw,headers:await signed(raw)}),env)
 failDownload=true;await assert.rejects(run)
 const pending=db.prepare('SELECT * FROM mail_messages WHERE id=?').get('attachment-mail') as any
 assert(pending,'email must already be visible even when attachment fetch fails')
 assert.equal(pending.status,'attachments_pending')
 failDownload=false;await run()
 const row=db.prepare('SELECT * FROM mail_messages WHERE id=?').get('attachment-mail') as any
 assert.equal(row.status,'received')
 const attachment=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/attachment-mail/attachments/image'),env,['attachment-mail','attachments','image'])
 assert.deepEqual([...new Uint8Array(await attachment.arrayBuffer())],[1,2,3,4])
})
test('CC and BCC are validated, saved and passed to Resend',async()=>{
 const payload={id:'out-32345678-1234-1234-1234-123456789abc',from:'sales@sengguanauto.com.my',to:'one@example.com, two@example.com',cc:'copy@example.com',bcc:'private@example.com',subject:'Copies',text:'Hi'}
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),env,['send'],'owner@example.com')
 assert.deepEqual(sends.at(-1)?.body.to,['one@example.com','two@example.com'])
 assert.deepEqual(sends.at(-1)?.body.cc,['copy@example.com']);assert.deepEqual(sends.at(-1)?.body.bcc,['private@example.com'])
 const row=db.prepare('SELECT cc,bcc FROM mail_messages WHERE id=?').get(payload.id) as any
 assert.deepEqual(JSON.parse(row.bcc),['private@example.com'])
 const bad={...payload,id:'out-42345678-1234-1234-1234-123456789abc',cc:'bad\r\nBcc: attacker@example.com'}
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bad)}),env,['send']))
})
test('history suggestions are scoped to the authenticated administrator',async()=>{
 const request=new Request('https://sengguanauto.com.my/api/admin/mail/history')
 const own=await (await mailApi(request,env,['history'],'owner@example.com')).json() as any
 assert(own.addresses.includes('copy@example.com'))
 const other=await (await mailApi(request,env,['history'],'other@example.com')).json() as any
 assert.deepEqual(other.addresses,[])
})
test('sales mail only notifies app and forwarding includes the stored original attachment',async()=>{
 const notificationTargets=db.prepare('SELECT recipient FROM mail_notifications WHERE message_id=?').all('attachment-mail') as any[]
 assert.deepEqual(notificationTargets.map(r=>r.recipient),['sengguanauto.app@hotmail.com'])
 const payload={id:'out-52345678-1234-1234-1234-123456789abc',from:'sales@sengguanauto.com.my',to:'forward@example.com',subject:'Fwd: With image',text:'Forwarded message',forwardId:'attachment-mail'}
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),env,['send'],'owner@example.com')
 assert.deepEqual(sends.at(-1)?.body.attachments,[{filename:'photo.jpg',content:'AQIDBA=='}])
})
test('admin-only mail creates only the bos notification task',async()=>{
 const routes=(await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/settings'),env,['settings'])).json() as any).routes
 assert.deepEqual(routes['admin@sengguanauto.com.my'],['sengguanauto.bos@hotmail.com'])
 assert.deepEqual(routes['sales@sengguanauto.com.my'],['sengguanauto.app@hotmail.com'])
})
test('address suggestions filter history and replace only the current token',async()=>{
 const {matchingHistory,insertHistoryAddress}=await import('../shared/mail.ts')
 assert.deepEqual(matchingHistory(['one@example.com','two@example.com'],'one@example.com, tw'),['two@example.com'])
 assert.deepEqual(matchingHistory(['one@example.com','two@example.com'],'one@example.com, '),['two@example.com'])
 assert.equal(insertHistoryAddress('one@example.com, tw','two@example.com'),'one@example.com, two@example.com')
})
test.after(()=>{globalThis.fetch=originalFetch;db.close()})

test('legacy mail details expose CC and BCC as arrays',async()=>{
 const row=db.prepare('SELECT * FROM mail_messages WHERE id=?').get(mailId) as any
 const stored=JSON.parse(String(storage.get(row.content_key)));delete stored.cc;delete stored.bcc;storage.set(row.content_key,JSON.stringify(stored))
 const response=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/'+mailId),env,[mailId]);const detail=await response.json() as any
 assert.deepEqual(detail.cc,[]);assert.deepEqual(detail.bcc,[])
})

test('a stored attachment is downloadable even if another attachment remains unavailable',async()=>{
 const row=db.prepare('SELECT * FROM mail_messages WHERE id=?').get(mailId) as any
 const data=JSON.parse(String(storage.get(row.content_key)));data.attachments=[{id:'ready',filename:'ready.jpg',content_type:'image/jpeg',size:4},{id:'missing',filename:'missing.jpg',content_type:'image/jpeg',size:4}];storage.set(row.content_key,JSON.stringify(data));storage.set('mail/'+mailId+'/attachments/ready',new Uint8Array([1,2,3,4]))
 failDownload=true
 try{const response=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/'+mailId+'/attachments/ready'),env,[mailId,'attachments','ready']);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3,4])}finally{failDownload=false}
})

test('native inbox adapter allowlists mailboxes and paginates threaded messages',async()=>{
 const list=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations?mailbox=sales@sengguanauto.com.my'),env,['conversations']);const value=await list.json() as any
 assert.equal(value.messages[0].id,'ib~sales~'+nativeThread);assert.equal(value.next,nativeThread);assert.equal(value.hasMore,true)
 const detail=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/ib~sales~'+nativeThread),env,['conversations','ib~sales~'+nativeThread]);const data=await detail.json() as any
 assert.equal(data.emails.length,2);assert.equal(data.emails[1].text,'Second message');assert.ok(data.read_at)
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations?mailbox=other@example.com'),env,['conversations']))
})
test('native sending retries one saved draft and rejects changed payload; forwarding uses native endpoint',async()=>{
 const payload={id:'out-ffffffff-ffff-4fff-ffff-ffffffffffff',from:'sales@sengguanauto.com.my',to:'customer@example.com',cc:'copy@example.com',bcc:'hidden@example.com',subject:'Hello',text:'Hi'}
 const send=(p:any)=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}),env,['conversations','send'],'owner@example.com')
 const before=nativeDrafts;await send(payload);await send(payload);assert.equal(nativeDrafts,before+1);assert.equal(nativeSends.at(-1).key,'mail-inbox/'+payload.id)
 await assert.rejects(()=>send({...payload,text:'changed'}))
 await send({...payload,id:'out-99999999-9999-4999-9999-999999999999',forwardId:'ib~sales~'+nativeThread+'~'+nativeEmail.id})
 assert.ok(nativeSends.at(-1).path.endsWith('/forward'));assert.deepEqual(nativeSends.at(-1).body.bcc,['hidden@example.com'])
 await assert.rejects(()=>send({...payload,id:'out-88888888-8888-4888-8888-888888888888',replyId:'ib~admin~'+nativeThread+'~'+nativeEmail.id}))
})
test('signed native receipt preserves private backup and sends only sales notification with thread link',async()=>{
 const raw=JSON.stringify({type:'inbox.email.received',data:{inbox_id:nativeThread,thread_id:nativeThread,email_id:nativeEmail.id}})
 await receiveMail(new Request('https://sengguanauto.com.my/api/mail-webhook',{method:'POST',headers:await signed(raw),body:raw}),env)
 const row=db.prepare('SELECT * FROM mail_messages WHERE id=?').get(nativeEmail.id) as any;assert.equal(row.mailbox,'sales@sengguanauto.com.my')
 const notice=sends.at(-1);assert.deepEqual(notice?.body.to,['sengguanauto.app@hotmail.com']);assert.ok(notice?.body.text.includes(encodeURIComponent('ib~sales~'+nativeThread)))
 const before=sends.length;await receiveMail(new Request('https://sengguanauto.com.my/api/mail-webhook',{method:'POST',headers:await signed(raw),body:raw}),env);assert.equal(sends.length,before)
})

test('native attachment download works without a backup row and rejects unrelated attachment IDs',async()=>{
 nativeEmail.attachments=[{id:'native-file',filename:'native.jpg',size:3}] as any
 const ref='ib~sales~'+nativeThread+'~'+nativeEmail.id
 const response=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/'+ref+'/attachments/native-file'),env,['conversations',ref,'attachments','native-file'])
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[7,8,9])
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/'+ref+'/attachments/other'),env,['conversations',ref,'attachments','other']))
 nativeEmail.attachments=[]
})

test('a second native inbox delivery preserves attempted notification links and adds only its matching notice',async()=>{
 const row=db.prepare('SELECT * FROM mail_messages WHERE id=?').get(nativeEmail.id) as any
 const body=JSON.parse(String(storage.get(row.content_key)));delete body.inbox_ref;storage.set(row.content_key,JSON.stringify(body))
 const raw=JSON.stringify({type:'inbox.email.received',data:{inbox_id:'cccccccc-cccc-4ccc-cccc-cccccccccccc',thread_id:nativeThread,email_id:nativeEmail.id}})
 const before=sends.length;await receiveMail(new Request('https://sengguanauto.com.my/api/mail-webhook',{method:'POST',headers:await signed(raw),body:raw}),env)
 assert.equal(sends.length,before+1);assert.deepEqual(sends.at(-1)?.body.to,['sengguanauto.bos@hotmail.com'])
 assert.ok(sends.at(-1)?.body.text.includes('message='+nativeEmail.id));assert.equal(JSON.parse(String(storage.get(row.content_key))).inbox_ref,undefined)
 const updated=db.prepare('SELECT mailbox FROM mail_messages WHERE id=?').get(nativeEmail.id) as any;assert.equal(updated.mailbox,'sales@sengguanauto.com.my,admin@sengguanauto.com.my')
 await receiveMail(new Request('https://sengguanauto.com.my/api/mail-webhook',{method:'POST',headers:await signed(raw),body:raw}),env);assert.equal(sends.length,before+1)
})

test('All mailboxes merge pages without dropping or duplicating interleaved conversations',async()=>{
 const make=(rank:number)=>({id:'10000000-0000-4000-8000-'+String(rank).padStart(12,'0'),subject:'Thread '+rank,from:'customer@example.com',to:[],read:rank%2===0,received_at:new Date(Date.parse('2026-11-25T10:00:00Z')-rank*1000).toISOString(),email_count:1})
 listingPages={'sales@sengguanauto.com.my':Array.from({length:35},(_,i)=>make(i*2)),'admin@sengguanauto.com.my':Array.from({length:35},(_,i)=>make(i*2+1))}
 try{let cursor='',ids:string[]=[]
  for(let page=0;page<3;page++){const response=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations?mailbox=&after='+encodeURIComponent(cursor)),env,['conversations']);const data=await response.json() as any;ids.push(...data.messages.map((r:any)=>r.id));cursor=data.next;assert.equal(data.hasMore,page<2)}
  assert.equal(ids.length,70);assert.equal(new Set(ids).size,70)
 }finally{listingPages=null}
})
test('mailbox signatures persist separately and reject oversized or incomplete settings',async()=>{
 const signatures={'sales@sengguanauto.com.my':'Sales team\nSeng Guan Auto','admin@sengguanauto.com.my':'Admin team'}
 const save=(body:any)=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/signatures',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,['signatures'],'owner@example.com')
 await save(signatures);const response=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/signatures'),env,['signatures']);assert.deepEqual(await response.json(),signatures)
 await assert.rejects(()=>save({...signatures,'sales@sengguanauto.com.my':'x'.repeat(4001)}));await assert.rejects(()=>save({}))
})
test('private attachment uploads work for new messages and replies and cannot be reused by another administrator',async()=>{
 const form=new FormData();form.set('file',new File(['hello attachment'], 'hello.txt',{type:'text/plain'}))
 const response=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/uploads',{method:'POST',body:form}),env,['conversations','uploads'],'owner@example.com');const file=await response.json() as any
 const payload={id:'out-77777777-7777-4777-7777-777777777777',from:'sales@sengguanauto.com.my',to:'customer@example.com',subject:'With attachment',text:'Please see attached.',uploads:[file.id]}
 const send=(body:any,owner='owner@example.com')=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,['conversations','send'],owner)
 await send(payload);assert.equal(nativeDraftPayloads.at(-1).attachments[0].filename,'hello.txt');assert.equal(atob(nativeDraftPayloads.at(-1).attachments[0].content),'hello attachment')
 await send({...payload,id:'out-66666666-6666-4666-6666-666666666666',replyId:'ib~sales~'+nativeThread+'~'+nativeEmail.id});assert.equal(nativeDraftPayloads.at(-1).reply_to_email_id,nativeEmail.id);assert.equal(nativeDraftPayloads.at(-1).attachments.length,1)
 await assert.rejects(()=>send({...payload,id:'out-55555555-5555-4555-5555-555555555555'},'other@example.com'))
 const empty=new FormData();empty.set('file',new File([], 'empty.txt'));await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/uploads',{method:'POST',body:empty}),env,['conversations','uploads'],'owner@example.com'))
})
test('mail change token advances when a new message is stored',async()=>{
 const read=async()=>JSON.stringify(await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/changes'),env,['changes'])).json())
 const before=await read();db.prepare("INSERT INTO mail_messages(id,direction,mailbox,sender,recipients,subject,received_at,content_key,status) VALUES('change-test','inbound','sales@sengguanauto.com.my','customer@example.com','[]','New','2026-11-25','new-key','received')").run();assert.notEqual(await read(),before)
})

test('All mailboxes cursors preserve provider ordering when activity timestamps are identical',async()=>{
 const rows=Array.from({length:35},(_,i)=>({id:'20000000-0000-4000-8000-'+String(99-i).padStart(12,'0'),subject:'Tie '+i,from:'c@example.com',to:[],read:false,received_at:'2026-11-25T10:00:00Z',email_count:1}))
 listingPages={'sales@sengguanauto.com.my':rows,'admin@sengguanauto.com.my':[]}
 try{const first=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations'),env,['conversations'])).json() as any;const second=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations?after='+encodeURIComponent(first.next)),env,['conversations'])).json() as any;assert.equal(first.messages[0].subject,'Tie 0');assert.equal(second.messages[0].subject,'Tie 30');assert.equal(new Set([...first.messages,...second.messages].map(r=>r.id)).size,35)}finally{listingPages=null}
})
test('pre-attachment native send identifiers remain safe to retry',async()=>{
 const id='out-44444444-4444-4444-4444-444444444444',payload={box:'sales@sengguanauto.com.my',to:['c@example.com'],cc:[],bcc:[],subject:'Old send',text:'Original',reply:null,forward:null}
 db.prepare('INSERT INTO mail_native_sends(id,payload,created_at,provider_id) VALUES(?,?,?,?)').run(id,JSON.stringify(payload),new Date().toISOString(),'existing-provider-id')
 const response=await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,from:payload.box,to:payload.to,subject:payload.subject,text:payload.text,uploads:[]})}),env,['conversations','send'],'owner@example.com');assert.equal((await response.json() as any).status,'sent')
})

test('search forwards text and scope to native search across mailboxes',async()=>{
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations?q=invoice&scope=all'),env,['conversations'])
 const request=nativeRequests.at(-1);assert.ok(request.path.includes('/threads/search?'));const url=new URL('https://api.resend.com'+request.path);assert.equal(url.searchParams.get('query'),'invoice');assert.equal(url.searchParams.get('folders'),'inbox,sent,archive,spam,trash');assert.equal(url.searchParams.get('labels'),null)
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations?q='+encodeURIComponent('word '.repeat(33))),env,['conversations']))
})
test('delete moves a conversation to recoverable Trash and Trash remains browsable',async()=>{
 const ref='ib~sales~'+nativeThread
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/'+ref,{method:'DELETE'}),env,['conversations',ref]);assert.equal(nativeRequests.at(-1).method,'PATCH');assert.equal(nativeRequests.at(-1).body.folder,'trash')
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations?mailbox=sales@sengguanauto.com.my&folder=trash'),env,['conversations']);assert.ok(nativeRequests.at(-1).path.includes('folders=trash'))
})
test('saved drafts keep partial recipients, attachments and send identifiers private, detect conflicts and support delete/restore',async()=>{
 const id='draft-33333333-3333-4333-8333-333333333333',payload={id,from:'sales@sengguanauto.com.my',to:'partial@',cc:'',bcc:'',subject:'Work in progress',body:'Draft body',bodyHtml:'<p><strong>Draft body</strong></p>',replyId:'',forwardId:'',includeSignature:true,uploads:[],sendId:'out-22222222-2222-4222-8222-222222222222',retryPayload:''}
 const save=(p:any)=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}),env,['drafts'],'owner@example.com')
 const first=await (await save(payload)).json() as any
 const get=(owner='owner@example.com')=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/drafts/'+id),env,['drafts',id],owner)
 assert.equal((await (await get()).json() as any).to,'partial@');assert.equal((await (await get()).json() as any).bodyHtml,payload.bodyHtml);await assert.rejects(()=>get('other@example.com'))
 const second=await (await save({...payload,body:'Edited draft',updatedAt:first.updatedAt})).json() as any;assert.notEqual(second.updatedAt,first.updatedAt)
 await assert.rejects(()=>save({...payload,body:'Stale overwrite',updatedAt:first.updatedAt}))
 const list=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/drafts?q=Edited'),env,['drafts'],'owner@example.com')).json() as any;assert.equal(list.messages.length,1)
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/drafts/'+id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({updatedAt:first.updatedAt})}),env,['drafts',id],'owner@example.com'));assert.equal((await (await get()).json() as any).body,'Edited draft')
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/drafts/'+id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({updatedAt:second.updatedAt})}),env,['drafts',id],'owner@example.com');await assert.rejects(()=>get())
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/drafts/'+id+'/restore',{method:'POST'}),env,['drafts',id,'restore'],'owner@example.com');assert.equal((await (await get()).json() as any).body,'Edited draft')
})

test('reply signatures are inserted before the editable original quote without changing the quote',async()=>{
 const {withMailSignature}=await import('../shared/mail.ts');const quote='\n\n---------- Original message ----------\nOriginal text',body='My response'+quote;assert.equal(withMailSignature(body,'Sales team'),'My response\n\nSales team'+quote);assert.equal(withMailSignature(body,''),body)
})

test('attachment reminder recognizes authored attachment wording and ignores original quotes',async()=>{
 const {mentionsMailAttachment}=await import('../shared/mail.ts')
 for(const word of ['attach','attachment','attachments','Attached','attaching'])assert.equal(mentionsMailAttachment('', 'Please see '+word),true)
 assert.equal(mentionsMailAttachment('Attachment for review','Hello'),true)
 assert.equal(mentionsMailAttachment('Hello','No extra files today.'),false)
 assert.equal(mentionsMailAttachment('Re: hello','Thanks.\n\n---------- Original message ----------\nPlease see attached.'),false)
 assert.equal(mentionsMailAttachment('Hello','A detachable part'),false)
})

test('a saved forward checks its exact source message rather than a newer thread reply',async()=>{
 const ref='ib~sales~'+nativeThread+'~'+nativeEmail.id
 const detail=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/'+ref),env,['conversations',ref])).json() as any
 assert.equal(detail.id,ref);assert.equal(detail.text,nativeEmail.text)
 assert.ok(nativeRequests.at(-1).path.endsWith('/emails/'+nativeEmail.id))
})

test('rich mail HTML preserves formatting and only own branding images, stripping active content and unsafe styles',async()=>{
 const {sanitizeMailHtml}=await import('../server/mail-formatting')
 const src='https://sengguanauto.com.my/api/mail-assets/11111111-1111-4111-8111-111111111111'
 const safe=sanitizeMailHtml('<p onclick="bad()" style="text-align:center;font-size:24px;background:url(https://evil.test)"><strong>Hello</strong><em>world</em></p><script>alert(1)</script><img src="'+src+'" onerror="bad()"><img src="https://evil.test/tracker"><svg><script>bad</script></svg>')
 assert.match(safe,/text-align:center;font-size:24px/);assert.match(safe,/<strong>Hello<\/strong>/);assert.match(safe,new RegExp(src));assert.doesNotMatch(safe,/onclick|onerror|evil|script|svg|background/)
 const {composeMailHtml}=await import('../shared/mail-html');const result=composeMailHtml('<p>Answer</p><p>---------- Original message ----------</p><p>Previous</p>','Answer','<p><img src="'+src+'"></p>','','<p>Header</p>')
 assert.match(result,/background-color:#111315;color:#ffffff/);assert.match(sanitizeMailHtml(result),/background-color:#111315;color:#ffffff;padding-top:8px;padding-bottom:8px;padding-left:24px;padding-right:24px/);assert.ok(result.indexOf('Header')<result.indexOf('Answer'));assert.ok(result.indexOf(src)<result.indexOf('Original message'))
})
test('mailbox rich signatures and headers persist atomically with their plain signature alternative',async()=>{
 const config=Object.fromEntries(['sales','admin'].map(name=>[name+'@sengguanauto.com.my',{signatureHtml:'<p><strong>'+name+'</strong></p>',signatureText:name+' team',headerHtml:'<p style="text-align:center">Seng Guan Auto</p>',headerEnabled:true}]))
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)}),env,['formatting'],'owner@example.com')
 const saved=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting'),env,['formatting'],'owner@example.com')).json() as any
 assert.equal(saved['sales@sengguanauto.com.my'].headerEnabled,true);assert.match(saved['admin@sengguanauto.com.my'].signatureHtml,/<strong>admin/)
 const plain=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/signatures'),env,['signatures'])).json() as any;assert.equal(plain['sales@sengguanauto.com.my'],'sales team')
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config,'admin@sengguanauto.com.my':{...config['admin@sengguanauto.com.my'],signatureText:'x'.repeat(4001)}})}),env,['formatting'],'owner@example.com'))
})
test('branding image uploads expose only bounded raster branding assets, never private attachments',async()=>{
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0])
 const saved=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting/images',{method:'POST',body:png}),env,['formatting','images'],'owner@example.com')).json() as any
 const publicImage=await onRequest({request:new Request(saved.url),env} as any);assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('Content-Type'),'image/png')
 await assert.rejects(()=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting/images',{method:'POST',body:'<svg>not a raster</svg>'}),env,['formatting','images'],'owner@example.com'))
 const missing=await onRequest({request:new Request('https://sengguanauto.com.my/api/mail-assets/'+nativeEmail.id),env} as any);assert.equal(missing.status,404)
})
test('HTML delivery keeps plain text and preserves native and legacy idempotency behavior',async()=>{
 const html='<p style="text-align:right;font-size:20px"><strong>Formatted</strong></p>'
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/conversations/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'out-20202020-2020-4020-8020-202020202020',from:'sales@sengguanauto.com.my',to:'admin@sengguanauto.com.my',subject:'Rich native',text:'Formatted',html,uploads:[]})}),env,['conversations','send'],'owner@example.com');assert.equal(nativeDraftPayloads.at(-1).html,(await import('../server/mail-formatting')).sanitizeMailHtml(html));assert.equal(nativeDraftPayloads.at(-1).text,'Formatted')
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'out-21212121-2121-4121-8121-212121212121',from:'sales@sengguanauto.com.my',to:'admin@sengguanauto.com.my',subject:'Rich legacy',text:'Formatted',html,uploads:[]})}),env,['send'],'owner@example.com');assert.equal(sends.at(-1).body.html,(await import('../server/mail-formatting')).sanitizeMailHtml(html))
})

test('older plain-signature clients clear the old HTML signature without losing header settings',async()=>{
 const signature={'sales@sengguanauto.com.my':'Updated plain sales','admin@sengguanauto.com.my':'Updated plain admin'}
 await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/signatures',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(signature)}),env,['signatures'])
 const value=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting'),env,['formatting'])).json() as any
 assert.equal(value['sales@sengguanauto.com.my'].signatureHtml,'');assert.equal(value['sales@sengguanauto.com.my'].headerEnabled,true)
})

test('compact paragraph spacing survives repeated sanitization and preserves intentional blank lines',async()=>{
 const {sanitizeMailHtml}=await import('../server/mail-formatting')
 const html=sanitizeMailHtml('<p>One</p><p style="text-align:right;font-size:20px">Two</p><p></p><p>Signature</p>')
 assert.match(html,/margin:0;padding:0px;line-height:1.5/);assert.match(html,/<br>/);assert.equal(sanitizeMailHtml(html),html)
})
test('mailbox footer settings persist and older clients preserve them when omitted',async()=>{
 const boxes=['sales@sengguanauto.com.my','admin@sengguanauto.com.my']
 const config=Object.fromEntries(boxes.map(box=>[box,{signatureHtml:'<p>Team</p>',headerHtml:'',headerEnabled:false,footerHtml:'<p>Footer company text</p>',footerEnabled:true,footerText:'Footer company text'}]))
 const save=(value:any)=>mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}),env,['formatting'])
 await save(config);await save(Object.fromEntries(boxes.map(box=>[box,{signatureHtml:'<p>Team</p>',headerHtml:'',headerEnabled:false}])))
 const result=await (await mailApi(new Request('https://sengguanauto.com.my/api/admin/mail/formatting'),env,['formatting'])).json() as any;assert.equal(result[boxes[0]].footerEnabled,true);assert.match(result[boxes[1]].footerHtml,/Footer company text/)
 const {composeMailHtml}=await import('../shared/mail-html');const html=composeMailHtml('<p>Body</p>','Body','<p>Signature</p>','Signature','','<p>Footer company text</p>');assert.ok(html.indexOf('Signature')<html.indexOf('Footer company text'))
})

test('logo header has compact vertical padding without sacrificing horizontal spacing',async()=>{
 const {composeMailHtml}=await import('../shared/mail-html');const {sanitizeMailHtml}=await import('../server/mail-formatting')
 const html=sanitizeMailHtml(composeMailHtml('<p>Message</p>','Message','','','<p><img src="https://sengguanauto.com.my/api/mail-assets/11111111-1111-4111-8111-111111111111"></p>'))
 assert.match(html,/padding-top:8px;padding-bottom:8px;padding-left:24px;padding-right:24px/)
 assert.equal(sanitizeMailHtml(html),html)
})
