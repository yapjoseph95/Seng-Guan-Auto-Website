import {outboundMailHtml,sanitizeMailHtml} from './mail-formatting'
import {HttpError,json,limitedText,type Env} from './auth'
import {mailboxes,defaultNotificationRoutes,splitAddresses} from '../shared/mail'
export {mailboxes} from '../shared/mail'
const site='https://sengguanauto.com.my'
export async function keyHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
const validEmail=(v:string)=>v.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(v)
export function mailAddress(value:unknown) {if(typeof value!=='string'||!mailboxes.some(m=>m===value))throw new HttpError(400,'Invalid company mailbox.');return value}
export function notificationRecipients(value:unknown):string[] {
 if(!Array.isArray(value)||!value.length||value.length>10)throw new HttpError(400,'Enter 1–10 notification email addresses.')
 const list=value.map(v=>typeof v==='string'?v.trim().toLowerCase():'')
 if(list.some(v=>!validEmail(v)||v.endsWith('@sengguanauto.com.my')))throw new HttpError(400,'Use valid external notification addresses.')
 return [...new Set(list)]
}
export async function verifyMailSignature(raw:string,headers:Headers,secret:string) {
 try {
  const id=headers.get('svix-id'),time=headers.get('svix-timestamp'),signatures=headers.get('svix-signature')
  if(!id||!time||!signatures||!/^\d+$/.test(time)||Math.abs(Date.now()/1000-Number(time))>300||!secret.startsWith('whsec_'))return false
  const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify'])
  for(const sig of signatures.split(' ')) {const [v,b64]=sig.split(',');if(v==='v1'&&b64&&await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),new TextEncoder().encode(`${id}.${time}.${raw}`)))return true}
 }catch{/* Invalid signatures are rejected. */}
 return false
}
type Attachment={id:string;filename:string;content_type:string;size:number;key?:string}
type Content={text:string|null;html:string|null;message_id?:string;reply_to?:string[];attachments:Attachment[];cc?:string[];bcc?:string[];forward_id?:string;send_payload?:string;inbox_ref?:string}
type Message={id:string;direction:'inbound'|'outbound';mailbox:string;sender:string;recipients:string;subject:string;received_at:string;content_key:string;read_at:string|null;status:string;reply_id:string|null;provider_id:string|null;created_at:string;cc:string;bcc:string}
export async function resend<T>(env:Env,path:string,options:RequestInit={}) {
 if(!env.RESEND_API_KEY)throw new HttpError(503,'Mail service is not connected yet.')
 let response:Response
 try{for(let attempt=0;;attempt++){
  response=await fetch('https://api.resend.com'+path,{...options,headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)})
  if(response.status!==429||attempt>=2)break
  const delay=Math.max(1000,Math.min(3000,(Number(response.headers.get('retry-after'))||1)*1000));await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,delay))
 }}catch{throw new HttpError(503,'Mail provider is temporarily unavailable. Please retry.')}
 if(!response.ok){await response.body?.cancel();throw new HttpError(response.status===429?429:502,'Mail provider could not complete the request. Please retry.')}
 return await response.json() as T
}
export async function input(request:Request,limit=100000) {if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Expected JSON.');try{return JSON.parse(await limitedText(request,limit)) as Record<string,unknown>}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid request.')}}
async function content(env:Env,row:Message) {const object=await env.PHOTOS.get(row.content_key);if(!object)throw new HttpError(503,'Email content is temporarily unavailable.');const data=await object.json<Content>();if(row.direction==='inbound')for(const a of data.attachments){if(a.key)continue;const key=`mail/${row.id}/attachments/${encodeURIComponent(a.id)}`;const saved=await env.PHOTOS.head(key);if(saved){a.key=key;a.size=saved.size}}return data}
async function message(env:Env,id:string) {const row=await env.DB.prepare('SELECT * FROM mail_messages WHERE id=?').bind(id).first<Message>();if(!row)throw new HttpError(404,'Email not found.');return row}
export function addressList(value:unknown,required=false):string[] {
 const list=Array.isArray(value)?value:typeof value==='string'?splitAddresses(value):value===undefined?[]:null
 if(!list||list.length>50||list.some(v=>typeof v!=='string'||!validEmail(v))||(required&&!list.length))throw new HttpError(400,'Enter valid email addresses separated by commas.')
 return [...new Set((list as string[]).map(v=>v.trim().toLowerCase()))]
}
function notificationRoutes(value:unknown):Record<string,string[]> {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'Set notification recipients for each mailbox.')
 return Object.fromEntries(mailboxes.map(box=>[box,notificationRecipients((value as Record<string,unknown>)[box])]))
}
async function settings(env:Env){
 const s=await env.DB.prepare('SELECT enabled,routes FROM mail_settings WHERE id=1').first<{enabled:number;routes:string}>()
 return {enabled:!!s?.enabled,routes:s?notificationRoutes(JSON.parse(s.routes)):defaultNotificationRoutes}
}
export async function remember(env:Env,owner:string,kind:'address'|'subject',values:string[]) {
 if(!owner||!values.length)return
 const now=new Date().toISOString()
 await env.DB.batch(values.map(value=>env.DB.prepare('INSERT INTO mail_history(owner,kind,value,used_at) VALUES(?,?,?,?) ON CONFLICT(owner,kind,value) DO UPDATE SET used_at=excluded.used_at').bind(owner,kind,value,now)))
 await env.DB.prepare('DELETE FROM mail_history WHERE owner=? AND kind=? AND value NOT IN (SELECT value FROM mail_history WHERE owner=? AND kind=? ORDER BY used_at DESC,value LIMIT 200)').bind(owner,kind,owner,kind).run()
}
export async function notifyMail(env:Env,id:string) {
 const rows=await env.DB.prepare("SELECT recipient,first_attempt_at FROM mail_notifications WHERE message_id=? AND status!='sent'").bind(id).all<{recipient:string;first_attempt_at:string|null}>()
 if(!rows.results.length)return
 const row=await message(env,id)
 const deepLink=(await content(env,row)).inbox_ref||id
 for(const n of rows.results) {
  // Resend idempotency keys expire after 24h: do not automatically repeat ambiguous older sends.
  if(n.first_attempt_at&&Date.now()-Date.parse(n.first_attempt_at)>23*3600000)throw new HttpError(409,'An older notification needs delivery review before retrying.')
  await env.DB.prepare("UPDATE mail_notifications SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE message_id=? AND recipient=?").bind(new Date().toISOString(),id,n.recipient).run()
  await resend(env,'/emails',{method:'POST',headers:{'Idempotency-Key':`mail-notify/${id}/${await keyHash(n.recipient)}`},body:JSON.stringify({from:'Seng Guan Auto <admin@sengguanauto.com.my>',to:[n.recipient],subject:'[Seng Guan Auto] New email: '+row.subject.replace(/[\r\n]/g,' ').slice(0,180),text:`You have received a new email.\n\nFrom: ${row.sender}\nTo: ${JSON.parse(row.recipients).join(', ')}\nSubject: ${row.subject}\nReceived: ${row.received_at}\n\nView email (administrator sign-in required):\n${site}/admin?section=mail&message=${encodeURIComponent(deepLink)}\n\nManage these notifications in the admin mail settings.`})})
  await env.DB.prepare("UPDATE mail_notifications SET status='sent',sent_at=? WHERE message_id=? AND recipient=?").bind(new Date().toISOString(),id,n.recipient).run()
 }
}
export async function bytesFromDownload(value:string) {
 let url:URL
 try{url=new URL(value)}catch{throw new HttpError(502,'Attachment download URL is unavailable. Retry later.')}
 // Follow only HTTPS redirects from URLs supplied by the authenticated Resend API.
 for(let hop=0;hop<5;hop++) {
  if(url.protocol!=='https:'||url.username||url.password)throw new HttpError(502,'Invalid attachment download URL.')
  let response:Response
  try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)})}catch{throw new HttpError(502,'Attachment download failed. Please retry.')}
  if([301,302,303,307,308].includes(response.status)) {
   const next=response.headers.get('location');await response.body?.cancel()
   if(!next)throw new HttpError(502,'Attachment download redirect is missing.')
   url=new URL(next,url);continue
  }
  if(!response.ok||Number(response.headers.get('content-length'))>40*1024*1024)throw new HttpError(502,'Attachment could not be downloaded.')
  const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'Empty attachment download.')
  const chunks:Uint8Array[]=[];let size=0
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>40*1024*1024){await reader.cancel();throw new HttpError(502,'Attachment exceeds the storage limit.')}chunks.push(value)}}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,'Attachment download was interrupted. Please retry.')}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes
 }
 throw new HttpError(502,'Attachment download redirected too many times.')
}
async function storeAttachments(env:Env,row:Message,requestedId?:string) {
 const data=await content(env,row)
 for(const attachment of data.attachments) {
  if(attachment.key||(requestedId&&attachment.id!==requestedId))continue
  const file=await resend<{download_url:string;size:number}>(env,`/emails/${row.direction==='inbound'?'receiving/':''}${encodeURIComponent(row.id)}/attachments/${encodeURIComponent(attachment.id)}`)
  const key=`mail/${row.id}/attachments/${encodeURIComponent(attachment.id)}`
  const bytes=await bytesFromDownload(file.download_url)
  await env.PHOTOS.put(key,bytes)
  attachment.key=key;attachment.size=file.size||bytes.byteLength
  // Each attachment has its own immutable progress object; concurrent retries cannot overwrite other keys.
 }
 if(row.direction==='inbound'&&data.attachments.every(a=>a.key))await env.DB.prepare("UPDATE mail_messages SET status='received' WHERE id=?").bind(row.id).run()
 return data
}
export async function receiveMail(request:Request,env:Env) {
 if(request.method!=='POST')throw new HttpError(405,'Method not allowed.')
 if(!env.RESEND_WEBHOOK_SECRET)throw new HttpError(503,'Receiving is not configured.')
 const raw=await limitedText(request,200000)
 if(!await verifyMailSignature(raw,request.headers,env.RESEND_WEBHOOK_SECRET))throw new HttpError(401,'Invalid webhook signature.')
 let event:{type?:string;data?:{email_id?:string;inbox_id?:string;thread_id?:string}};try{event=JSON.parse(raw)}catch{throw new HttpError(400,'Invalid webhook payload.')}
 if(event.type!=='email.received'&&event.type!=='inbox.email.received'&&event.type!=='inbox.email.sent')return json({ok:true})
 const id=event.data?.email_id
 if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw new HttpError(400,'Invalid email identifier.')
 const existing=await env.DB.prepare('SELECT * FROM mail_messages WHERE id=?').bind(id).first<Message>()
 if(existing){
  if(event.type?.startsWith('inbox.')){
   const inboxId=event.data?.inbox_id,thread=event.data?.thread_id
   if(!inboxId||!thread||! /^[0-9a-f-]{36}$/i.test(inboxId)||! /^[0-9a-f-]{36}$/i.test(thread))throw new HttpError(400,'Invalid inbox event.')
   const inbox=await resend<{email_address:string}>(env,'/inboxes/'+inboxId)
   if(!mailboxes.includes(inbox.email_address as typeof mailboxes[number]))return json({ok:true,ignored:true})
   const {inboxRef}=await import('./mail-inboxes');const saved=await content(env,existing)
   // An attempted notice must retain its original URL under its fixed idempotency key.
   const attempted=await env.DB.prepare('SELECT message_id FROM mail_notifications WHERE message_id=? AND first_attempt_at IS NOT NULL LIMIT 1').bind(id).first()
   if(!saved.inbox_ref&&!attempted){saved.inbox_ref=inboxRef(inbox.email_address,thread);await env.PHOTOS.put(existing.content_key,JSON.stringify(saved))}
   await env.DB.prepare("UPDATE mail_messages SET mailbox=CASE WHEN instr(','||mailbox||',',','||?||',')>0 THEN mailbox ELSE mailbox||','||? END WHERE id=?").bind(inbox.email_address,inbox.email_address,id).run()
   const prefs=await settings(env)
   if(prefs.enabled&&event.type==='inbox.email.received')await env.DB.batch(prefs.routes[inbox.email_address].map(to=>env.DB.prepare('INSERT OR IGNORE INTO mail_notifications(message_id,recipient) VALUES(?,?)').bind(id,to)))
  }
  await notifyMail(env,id);if(existing.status==='attachments_pending')await storeAttachments(env,existing);return json({ok:true})
 }
 let nativeRef:string|undefined;let direction:'inbound'|'outbound'='inbound'
 let nativeReceived:unknown
 if(event.type?.startsWith('inbox.')){
  const {inboxRef}=await import('./mail-inboxes')
  const inboxId=event.data?.inbox_id,thread=event.data?.thread_id
  if(!inboxId||!thread||! /^[0-9a-f-]{36}$/i.test(inboxId)||! /^[0-9a-f-]{36}$/i.test(thread))throw new HttpError(400,'Invalid inbox event.')
  const inbox=await resend<{email_address:string}>(env,'/inboxes/'+inboxId);if(!mailboxes.includes(inbox.email_address as typeof mailboxes[number]))return json({ok:true,ignored:true})
  const email=await resend<import('./mail-inboxes').InboxEmail>(env,`/inboxes/${inboxId}/threads/${thread}/emails/${id}`)
  direction=email.direction;nativeRef=inboxRef(inbox.email_address,thread)
  nativeReceived={...email,to:email.to,received_for:[inbox.email_address],created_at:email.received_at}
 }
 const received=(nativeReceived||await resend<Content&{id:string;to:string[];cc?:string[];bcc?:string[];received_for?:string[];from:string;subject:string;created_at:string}>(env,'/emails/receiving/'+encodeURIComponent(id))) as Content&{id:string;to:string[];cc?:string[];bcc?:string[];received_for?:string[];from:string;subject:string;created_at:string}
 const recipients=[...new Set([...(received.to||[]),...(received.cc||[]),...(received.bcc||[]),...(received.received_for||[])].map(v=>v.trim().toLowerCase()))]
 const mailbox=mailboxes.filter(m=>recipients.includes(m)).join(',')
 if(!mailbox)return json({ok:true,ignored:true})
 const attachments:Attachment[]=(received.attachments||[]).map(item=>({...item,filename:item.filename||'attachment',size:item.size||0}))
 const contentKey=`mail/${id}/content.json`
 await env.PHOTOS.put(contentKey,JSON.stringify({text:received.text,html:received.html,message_id:received.message_id,reply_to:received.reply_to,cc:received.cc||[],bcc:received.bcc||[],inbox_ref:nativeRef,attachments}),{onlyIf:{etagDoesNotMatch:'*'}})
 const prefs=await settings(env)
 // Index insertion and notification creation commit together, so webhook retries cannot lose notices.
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO mail_messages(id,direction,mailbox,sender,recipients,subject,received_at,content_key,provider_id,cc,bcc,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,direction,mailbox,received.from,JSON.stringify(received.to||[]),received.subject||'(No subject)',received.created_at,contentKey,id,JSON.stringify(received.cc||[]),JSON.stringify(received.bcc||[]),attachments.length?'attachments_pending':'received'),
  ...prefs.enabled&&direction==='inbound'?[...new Set(mailbox.split(',').flatMap(box=>prefs.routes[box]||[]))].map(to=>env.DB.prepare('INSERT OR IGNORE INTO mail_notifications(message_id,recipient) VALUES(?,?)').bind(id,to)):[]
 ])
 await notifyMail(env,id)
 if(attachments.length)await storeAttachments(env,await message(env,id))
 return json({ok:true})
}
export async function mailApi(request:Request,env:Env,parts:string[],owner='') {
 const url=new URL(request.url),action=parts[0]||''
 if(action==='formatting')return (await import('./mail-formatting')).formattingApi(request,env,parts.slice(1))
 if(action==='drafts')return (await import('./mail-drafts')).draftsApi(request,env,parts.slice(1),owner)
 if(action==='conversations')return (await import('./mail-inboxes')).inboxApi(request,env,parts.slice(1),owner)
 if(action==='changes'&&request.method==='GET')return json(url.searchParams.get('drafts')==='1'?await env.DB.prepare('SELECT COUNT(*) AS count,MAX(updated_at) AS latest FROM mail_saved_drafts WHERE owner=? AND deleted_at IS NULL').bind(owner).first():await env.DB.prepare('SELECT COUNT(*) AS count,MAX(created_at) AS latest FROM mail_messages').first())
 if(action==='signatures'){
  if(request.method==='GET'){const rows=await env.DB.prepare('SELECT mailbox,signature FROM mail_signatures').all<{mailbox:string;signature:string}>();return json(Object.fromEntries(rows.results.map(r=>[r.mailbox,r.signature])))}
  if(request.method==='PUT'){const value=await input(request);const signatures=mailboxes.map(box=>{const text=value[box];if(typeof text!=='string'||text.length>4000)throw new HttpError(400,'Signatures may contain up to 4,000 characters.');return [env.DB.prepare('UPDATE mail_signatures SET signature=? WHERE mailbox=?').bind(text,box),env.DB.prepare("UPDATE mail_branding SET signature_html='' WHERE mailbox=?").bind(box)]});await env.DB.batch(signatures.flat());return json({ok:true})}
 }
 if(action==='settings') {
  if(request.method==='GET')return json({...await settings(env),connected:!!env.RESEND_API_KEY,receiving:!!env.RESEND_WEBHOOK_SECRET,mailboxes})
  if(request.method==='PUT'){const value=await input(request);if(typeof value.enabled!=='boolean')throw new HttpError(400,'Invalid notification setting.');const routes=notificationRoutes(value.routes);await env.DB.prepare('UPDATE mail_settings SET enabled=?,routes=? WHERE id=1').bind(value.enabled?1:0,JSON.stringify(routes)).run();await remember(env,owner,'address',[...new Set(Object.values(routes).flat())]);return json(await settings(env))}
 }
 if(action==='history') {
  if(request.method==='GET'){
   const rows=await env.DB.prepare('SELECT kind,value FROM mail_history WHERE owner=? ORDER BY used_at DESC,value LIMIT 400').bind(owner).all<{kind:string;value:string}>()
   return json({addresses:rows.results.filter(r=>r.kind==='address').map(r=>r.value),subjects:rows.results.filter(r=>r.kind==='subject').map(r=>r.value)})
  }
  if(request.method==='POST'){
   if(!owner)throw new HttpError(403,'Administrator sign-in required.')
   const value=await input(request)
   if(value.kind==='address'){await remember(env,owner,'address',addressList(value.values));return json({ok:true})}
   if(value.kind==='subject'&&Array.isArray(value.values)&&value.values.length<=10&&value.values.every(v=>typeof v==='string'&&v.trim()&&v.length<=250&&!/[\r\n]/.test(v))){await remember(env,owner,'subject',value.values.map(v=>(v as string).trim()));return json({ok:true})}
   throw new HttpError(400,'Invalid history entry.')
  }
 }
 if(action==='send'&&request.method==='POST') {
  const value=await input(request,500000),from=mailAddress(value.from)
  const to=addressList(value.to,true),cc=addressList(value.cc),bcc=addressList(value.bcc)
  if(to.length+cc.length+bcc.length>50)throw new HttpError(400,'Use no more than 50 recipients in total.')
  const subject=typeof value.subject==='string'?value.subject.trim():''
  const text=typeof value.text==='string'?value.text:''
  const html=value.html===undefined?'':sanitizeMailHtml(value.html)
  const id=typeof value.id==='string'?value.id:''
  const replyId=typeof value.replyId==='string'&&value.replyId?value.replyId:null
  const forwardId=typeof value.forwardId==='string'&&value.forwardId?value.forwardId:null
  if(!subject||subject.length>250||/[\r\n]/.test(subject)||!text.trim()||text.length>50000||!/^out-[0-9a-f-]{36}$/.test(id)||replyId&&forwardId)throw new HttpError(400,'Check recipient, subject and message.')
  if(!env.RESEND_API_KEY)throw new HttpError(503,'Mail service is not connected yet.')
  const uploads=value.uploads===undefined?[]:value.uploads
  if(!Array.isArray(uploads)||uploads.length>20)throw new HttpError(400,'Use no more than 20 attachments.')
  const payload=JSON.stringify({from,to,cc,bcc,subject,text,replyId,forwardId,...html?{html}:{},...uploads.length?{uploads}:{}})
  let row=await env.DB.prepare('SELECT * FROM mail_messages WHERE id=?').bind(id).first<Message>()
  const same=(row:Message,stored:Content)=>stored.send_payload?stored.send_payload===payload:row.mailbox===from&&row.recipients===JSON.stringify(to)&&row.subject===subject&&stored.text===text&&JSON.stringify(stored.cc||[])===JSON.stringify(cc)&&JSON.stringify(stored.bcc||[])===JSON.stringify(bcc)&&!forwardId&&row.reply_id===replyId
  if(row){const stored=await content(env,row);if(!same(row,stored))throw new HttpError(409,'Use a new send identifier for a different email.');if(row.status==='sent')return json({id,status:'sent'});if(Date.now()-Date.parse(row.created_at)>23*3600000)throw new HttpError(409,'Please review delivery before resending this older email.')}
  if(!row) {
   let messageId:string|undefined;let attachments:Attachment[]=[]
   if(replyId){const original=await message(env,replyId);if(original.direction!=='inbound'||!original.mailbox.split(',').includes(from))throw new HttpError(400,'Reply mailbox does not match.');messageId=(await content(env,original)).message_id}
   if(forwardId){const original=await message(env,forwardId);if(original.direction!=='inbound')throw new HttpError(400,'Only received emails can be forwarded.');attachments=(await storeAttachments(env,original)).attachments}
   const uploaded=await (await import('./mail-inboxes')).loadMailUploads(env,owner,uploads);attachments.push(...uploaded.stored)
   const key=`mail/${id}/content.json`
   await env.PHOTOS.put(key,JSON.stringify({text,html:outboundMailHtml(html,text),message_id:messageId,attachments,cc,bcc,forward_id:forwardId,send_payload:payload}),{onlyIf:{etagDoesNotMatch:'*'}})
   const savedObject=await env.PHOTOS.get(key)
   const saved=await savedObject?.json<Content>()
   if(!saved||saved.send_payload!==payload)throw new HttpError(409,'A different email already uses this send identifier.')
   await env.DB.prepare("INSERT OR IGNORE INTO mail_messages(id,direction,mailbox,sender,recipients,subject,received_at,content_key,status,reply_id,cc,bcc) VALUES(?,'outbound',?,?,?,?,?,?,'pending',?,?,?)").bind(id,from,from,JSON.stringify(to),subject,new Date().toISOString(),key,replyId,JSON.stringify(cc),JSON.stringify(bcc)).run()
   row=await message(env,id)
  }
  const stored=await content(env,row)
  if(!same(row,stored))throw new HttpError(409,'A different email already uses this send identifier.')
  const attachments:{filename:string;content:string}[]=[];let total=0
  for(const file of stored.attachments){
   if(!file.key)throw new HttpError(503,'An attachment is not ready. Retry later.')
   const object=await env.PHOTOS.get(file.key);if(!object)throw new HttpError(503,'An attachment is unavailable. Retry later.')
   const bytes=new Uint8Array(await object.arrayBuffer());total+=bytes.length
   if(total>25*1024*1024)throw new HttpError(413,'Forwarded attachments exceed 25 MB.')
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
   attachments.push({filename:file.filename,content:btoa(binary)})
  }
  const provider=await resend<{id:string}>(env,'/emails',{method:'POST',headers:{'Idempotency-Key':'mail-send/'+id},body:JSON.stringify({from:`Seng Guan Auto <${from}>`,to,cc,bcc,subject,text,...stored.html?{html:stored.html}:{},reply_to:from,...attachments.length?{attachments}:{},...row.reply_id&&stored.message_id?{headers:{'In-Reply-To':stored.message_id,References:stored.message_id}}:{}})})
  await env.DB.prepare("UPDATE mail_messages SET status='sent',provider_id=? WHERE id=?").bind(provider.id,id).run()
  // History is useful but must never turn an accepted send into a reported failure.
  await remember(env,owner,'address',[...new Set([...to,...cc,...bcc])]).catch(()=>{})
  await remember(env,owner,'subject',[subject]).catch(()=>{})
  return json({id,status:'sent'})
 }
 if(!action&&request.method==='GET') {
  const direction=url.searchParams.get('folder')==='sent'?'outbound':'inbound'
  const mailbox=url.searchParams.get('mailbox');if(mailbox)mailAddress(mailbox)
  const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new HttpError(400,'Invalid page.')
  const search=(url.searchParams.get('q')||'').trim();if(search.length>256)throw new HttpError(400,'Search is too long.')
  const rows=await env.DB.prepare('SELECT id,direction,mailbox,sender,recipients,subject,received_at,read_at,status FROM mail_messages WHERE direction=? AND (?=\'\' OR instr(lower(sender||subject||recipients),lower(?))>0)'+(mailbox?' AND instr(mailbox,?)>0':'')+' ORDER BY received_at DESC,id DESC LIMIT 31 OFFSET ?').bind(direction,search,search,...mailbox?[mailbox]:[],offset).all()
  return json({messages:rows.results.slice(0,30),hasMore:rows.results.length>30})
 }
 if(action&&/^[a-zA-Z0-9-]{1,100}$/.test(action)) {
  const row=await message(env,action)
  if(parts[1]==='retry-attachments'&&request.method==='POST'){if(row.direction!=='inbound')throw new HttpError(400,'Only received emails can be retried.');await storeAttachments(env,row);return json({ok:true})}
  if(parts[1]==='retry-notifications'&&request.method==='POST'){await notifyMail(env,row.id);return json({ok:true})}
  if(parts[1]==='attachments'&&parts[2]&&request.method==='GET') {
   let data=await content(env,row);if(!data.attachments.some(a=>a.id===parts[2]))throw new HttpError(404,'Attachment not found.');if(row.direction==='inbound'&&!data.attachments.find(a=>a.id===parts[2])?.key)data=await storeAttachments(env,row,parts[2]);const file=data.attachments.find(a=>a.id===parts[2]);if(!file?.key)throw new HttpError(503,'Attachment is not ready. Retry later.')
   const object=await env.PHOTOS.get(file.key);if(!object)throw new HttpError(404,'Attachment not found.')
   const filename=(file.filename||'attachment').replace(/[\r\n"\\]/g,'_')
   return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
  }
  if(parts.length===1&&request.method==='GET') {
   const data=await content(env,row)
   const readAt=new Date().toISOString();await env.DB.prepare('UPDATE mail_messages SET read_at=? WHERE id=?').bind(readAt,row.id).run()
   const notifications=await env.DB.prepare('SELECT recipient,status,sent_at FROM mail_notifications WHERE message_id=?').bind(row.id).all()
   return json({...row,read_at:readAt,...data,cc:data.cc??JSON.parse(row.cc||'[]'),bcc:data.bcc??JSON.parse(row.bcc||'[]'),attachments:data.attachments.map(({key:_,...a})=>a),notifications:notifications.results})
  }
 }
 throw new HttpError(405,'Method not allowed.')
}
