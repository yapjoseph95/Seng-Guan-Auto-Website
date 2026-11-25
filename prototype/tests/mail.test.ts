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
class Stmt{constructor(public sql:string,public params:unknown[]=[]){}bind(...p:unknown[]){return new Stmt(this.sql,p)}async first(){return db.prepare(this.sql).get(...this.params as any[])||null}async all(){return {results:db.prepare(this.sql).all(...this.params as any[])}}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.params as any[]).changes)}}}}
const storage=new Map<string,string|Uint8Array>()
const env={DB:{prepare:(s:string)=>new Stmt(s),batch:async(stmts:Stmt[])=>{db.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}},PHOTOS:{put:async(k:string,v:string|Uint8Array,opts?:any)=>{if(opts?.onlyIf&&storage.has(k))return null;storage.set(k,v);return {}},get:async(k:string)=>{const v=storage.get(k);return v?{json:async()=>JSON.parse(String(v)),body:v}:null}},RESEND_API_KEY:'test',RESEND_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test',ADMIN_EMAILS:'owner@example.com'} as any
const originalFetch=globalThis.fetch
const sends:{key:string;body:any}[]=[]
let failSecond=false
const mailId='12345678-1234-1234-1234-123456789abc'
let fetched=0
globalThis.fetch=(async(input:any,init:any)=>{
 const url=String(input)
 if(url==='https://test.supabase.co/auth/v1/user')return Response.json({email:'owner@example.com',email_confirmed_at:'2026-11-01'})
 if(url==='https://api.resend.com/emails/receiving/'+mailId){fetched++;return Response.json({id:mailId,from:'Customer <customer@example.com>',to:['sales@sengguanauto.com.my'],subject:'A question',created_at:'2026-11-25T10:00:00Z',text:'Hello',html:null,message_id:'<customer-message@example.com>',attachments:[]})}
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
 assert.equal(row.subject,saved.subject)
 assert.equal(row.status,'sent')
 await send({...payload,text:saved.text,subject:saved.subject})
})
test('long valid notification targets use bounded idempotency keys',async()=>{
 const target='a'.repeat(64)+'@'+'b'.repeat(60)+'.'+'c'.repeat(60)+'.example.com'
 db.prepare('INSERT INTO mail_notifications(message_id,recipient) VALUES(?,?)').run(mailId,target)
 const {notifyMail}=await import('../server/mail.ts');await notifyMail(env,mailId)
 assert(sends.at(-1)!.key.length<=256)
})
test.after(()=>{globalThis.fetch=originalFetch;db.close()})
