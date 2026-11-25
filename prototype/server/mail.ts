import {HttpError,json,limitedText,type Env} from './auth'
export const mailboxes=['sales@sengguanauto.com.my','admin@sengguanauto.com.my']
const site='https://sengguanauto.com.my'
async function keyHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
const validEmail=(v:string)=>v.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(v)
export function mailAddress(value:unknown) {if(typeof value!=='string'||!mailboxes.includes(value))throw new HttpError(400,'Invalid company mailbox.');return value}
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
type Content={text:string|null;html:string|null;message_id?:string;reply_to?:string[];attachments:Attachment[]}
type Message={id:string;direction:'inbound'|'outbound';mailbox:string;sender:string;recipients:string;subject:string;received_at:string;content_key:string;read_at:string|null;status:string;reply_id:string|null;provider_id:string|null;created_at:string}
async function resend<T>(env:Env,path:string,options:RequestInit={}) {
 if(!env.RESEND_API_KEY)throw new HttpError(503,'Mail service is not connected yet.')
 let response:Response
 try{response=await fetch('https://api.resend.com'+path,{...options,headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)})}catch{throw new HttpError(503,'Mail provider is temporarily unavailable. Please retry.')}
 if(!response.ok){await response.body?.cancel();throw new HttpError(response.status===429?429:502,'Mail provider could not complete the request. Please retry.')}
 return await response.json() as T
}
async function input(request:Request) {if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Expected JSON.');try{return JSON.parse(await limitedText(request,100000)) as Record<string,unknown>}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid request.')}}
async function content(env:Env,row:Message) {const object=await env.PHOTOS.get(row.content_key);if(!object)throw new HttpError(503,'Email content is temporarily unavailable.');return await object.json<Content>()}
async function message(env:Env,id:string) {const row=await env.DB.prepare('SELECT * FROM mail_messages WHERE id=?').bind(id).first<Message>();if(!row)throw new HttpError(404,'Email not found.');return row}
async function settings(env:Env){const s=await env.DB.prepare('SELECT enabled,recipients FROM mail_settings WHERE id=1').first<{enabled:number;recipients:string}>();return {enabled:!!s?.enabled,recipients:s?JSON.parse(s.recipients) as string[]:[]}}
export async function notifyMail(env:Env,id:string) {
 const rows=await env.DB.prepare("SELECT recipient,first_attempt_at FROM mail_notifications WHERE message_id=? AND status!='sent'").bind(id).all<{recipient:string;first_attempt_at:string|null}>()
 if(!rows.results.length)return
 const row=await message(env,id)
 for(const n of rows.results) {
  // Resend idempotency keys expire after 24h: do not automatically repeat ambiguous older sends.
  if(n.first_attempt_at&&Date.now()-Date.parse(n.first_attempt_at)>23*3600000)throw new HttpError(409,'An older notification needs delivery review before retrying.')
  await env.DB.prepare("UPDATE mail_notifications SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE message_id=? AND recipient=?").bind(new Date().toISOString(),id,n.recipient).run()
  await resend(env,'/emails',{method:'POST',headers:{'Idempotency-Key':`mail-notify/${id}/${await keyHash(n.recipient)}`},body:JSON.stringify({from:'Seng Guan Auto <admin@sengguanauto.com.my>',to:[n.recipient],subject:'[Seng Guan Auto] New email: '+row.subject.replace(/[\r\n]/g,' ').slice(0,180),text:`You have received a new email.\n\nFrom: ${row.sender}\nTo: ${JSON.parse(row.recipients).join(', ')}\nSubject: ${row.subject}\nReceived: ${row.received_at}\n\nView email (administrator sign-in required):\n${site}/admin?section=mail&message=${encodeURIComponent(id)}\n\nManage these notifications in the admin mail settings.`})})
  await env.DB.prepare("UPDATE mail_notifications SET status='sent',sent_at=? WHERE message_id=? AND recipient=?").bind(new Date().toISOString(),id,n.recipient).run()
 }
}
async function bytesFromDownload(url:string) {
 const parsed=new URL(url)
 if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new HttpError(502,'Invalid attachment download URL.')
 // Only called with URLs returned by the authenticated Resend attachment API, never inbound headers or HTML.
 const response=await fetch(parsed,{redirect:'error',signal:AbortSignal.timeout(20000)})
 if(!response.ok||Number(response.headers.get('content-length'))>40*1024*1024)throw new HttpError(502,'Attachment could not be downloaded.')
 const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'Empty attachment download.')
 const chunks:Uint8Array[]=[];let size=0
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>40*1024*1024){await reader.cancel();throw new HttpError(502,'Attachment exceeds the storage limit.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes
}
export async function receiveMail(request:Request,env:Env) {
 if(request.method!=='POST')throw new HttpError(405,'Method not allowed.')
 if(!env.RESEND_WEBHOOK_SECRET)throw new HttpError(503,'Receiving is not configured.')
 const raw=await limitedText(request,200000)
 if(!await verifyMailSignature(raw,request.headers,env.RESEND_WEBHOOK_SECRET))throw new HttpError(401,'Invalid webhook signature.')
 let event:{type?:string;data?:{email_id?:string}};try{event=JSON.parse(raw)}catch{throw new HttpError(400,'Invalid webhook payload.')}
 if(event.type!=='email.received')return json({ok:true})
 const id=event.data?.email_id
 if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw new HttpError(400,'Invalid email identifier.')
 if(await env.DB.prepare('SELECT id FROM mail_messages WHERE id=?').bind(id).first()){await notifyMail(env,id);return json({ok:true})}
 const received=await resend<Content&{id:string;to:string[];cc?:string[];bcc?:string[];received_for?:string[];from:string;subject:string;created_at:string}>(env,'/emails/receiving/'+encodeURIComponent(id))
 const recipients=[...new Set([...(received.to||[]),...(received.cc||[]),...(received.bcc||[]),...(received.received_for||[])].map(v=>v.trim().toLowerCase()))]
 const mailbox=mailboxes.filter(m=>recipients.includes(m)).join(',')
 if(!mailbox)return json({ok:true,ignored:true})
 const attachments:Attachment[]=[]
 for(const item of received.attachments||[]) {
  const file=await resend<{download_url:string}>(env,`/emails/receiving/${encodeURIComponent(id)}/attachments/${encodeURIComponent(item.id)}`)
  const key=`mail/${id}/attachments/${encodeURIComponent(item.id)}`
  await env.PHOTOS.put(key,await bytesFromDownload(file.download_url))
  attachments.push({...item,key})
 }
 const contentKey=`mail/${id}/content.json`
 await env.PHOTOS.put(contentKey,JSON.stringify({text:received.text,html:received.html,message_id:received.message_id,reply_to:received.reply_to,attachments}))
 const prefs=await settings(env)
 // Index insertion and notification creation commit together, so webhook retries cannot lose notices.
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO mail_messages(id,direction,mailbox,sender,recipients,subject,received_at,content_key,provider_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'inbound',mailbox,received.from,JSON.stringify(recipients),received.subject||'(No subject)',received.created_at,contentKey,id),
  ...prefs.enabled?prefs.recipients.map(to=>env.DB.prepare('INSERT OR IGNORE INTO mail_notifications(message_id,recipient) VALUES(?,?)').bind(id,to)):[]
 ])
 await notifyMail(env,id)
 return json({ok:true})
}
export async function mailApi(request:Request,env:Env,parts:string[]) {
 const url=new URL(request.url),action=parts[0]||''
 if(action==='settings') {
  if(request.method==='GET')return json({...await settings(env),connected:!!env.RESEND_API_KEY,receiving:!!env.RESEND_WEBHOOK_SECRET,mailboxes})
  if(request.method==='PUT'){const value=await input(request);if(typeof value.enabled!=='boolean')throw new HttpError(400,'Invalid notification setting.');const recipients=notificationRecipients(value.recipients);await env.DB.prepare('UPDATE mail_settings SET enabled=?,recipients=? WHERE id=1').bind(value.enabled?1:0,JSON.stringify(recipients)).run();return json(await settings(env))}
 }
 if(action==='send'&&request.method==='POST') {
  const value=await input(request),from=mailAddress(value.from)
  const to=typeof value.to==='string'?value.to.trim().toLowerCase():''
  const subject=typeof value.subject==='string'?value.subject.trim():''
  const text=typeof value.text==='string'?value.text:''
  const id=typeof value.id==='string'?value.id:''
  if(!validEmail(to)||!subject||subject.length>250||/[\r\n]/.test(subject)||!text.trim()||text.length>50000||!/^out-[0-9a-f-]{36}$/.test(id))throw new HttpError(400,'Check recipient, subject and message.')
  if(!env.RESEND_API_KEY)throw new HttpError(503,'Mail service is not connected yet.')
  let row=await env.DB.prepare('SELECT * FROM mail_messages WHERE id=?').bind(id).first<Message>()
  if(row){const stored=await content(env,row);if(row.mailbox!==from||row.recipients!==JSON.stringify([to])||row.subject!==subject||stored.text!==text)throw new HttpError(409,'Use a new send identifier for a different email.');if(row.status==='sent')return json({id,status:'sent'});if(Date.now()-Date.parse(row.created_at)>23*3600000)throw new HttpError(409,'Please review delivery before resending this older email.')}
  if(!row) {
   let replyId:string|null=null,messageId:string|undefined
   if(typeof value.replyId==='string'&&value.replyId){const original=await message(env,value.replyId);if(original.direction!=='inbound'||!original.mailbox.split(',').includes(from))throw new HttpError(400,'Reply mailbox does not match.');replyId=original.id;messageId=(await content(env,original)).message_id}
   const key=`mail/${id}/content.json`
   await env.PHOTOS.put(key,JSON.stringify({text,html:null,message_id:messageId,attachments:[],from,to,subject,replyId}),{onlyIf:{etagDoesNotMatch:'*'}})
   const savedObject=await env.PHOTOS.get(key)
   const saved=await savedObject?.json<{text:string;from:string;to:string;subject:string;replyId:string|null}>()
   if(!saved||saved.text!==text||saved.from!==from||saved.to!==to||saved.subject!==subject||saved.replyId!==replyId)throw new HttpError(409,'A different email already uses this send identifier.')
   await env.DB.prepare("INSERT OR IGNORE INTO mail_messages(id,direction,mailbox,sender,recipients,subject,received_at,content_key,status,reply_id) VALUES(?,'outbound',?,?,?,?,?,?,'pending',?)").bind(id,from,from,JSON.stringify([to]),subject,new Date().toISOString(),key,replyId).run()
   row=await message(env,id)
  }
  const stored=await content(env,row)
  if(row.mailbox!==from||row.recipients!==JSON.stringify([to])||row.subject!==subject||stored.text!==text)throw new HttpError(409,'A different email already uses this send identifier.')
  const provider=await resend<{id:string}>(env,'/emails',{method:'POST',headers:{'Idempotency-Key':'mail-send/'+id},body:JSON.stringify({from:`Seng Guan Auto <${from}>`,to:[to],subject,text,reply_to:from,...row.reply_id&&stored.message_id?{headers:{'In-Reply-To':stored.message_id,References:stored.message_id}}:{}})})
  await env.DB.prepare("UPDATE mail_messages SET status='sent',provider_id=? WHERE id=?").bind(provider.id,id).run()
  return json({id,status:'sent'})
 }
 if(!action&&request.method==='GET') {
  const direction=url.searchParams.get('folder')==='sent'?'outbound':'inbound'
  const mailbox=url.searchParams.get('mailbox');if(mailbox)mailAddress(mailbox)
  const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new HttpError(400,'Invalid page.')
  const rows=await env.DB.prepare('SELECT id,direction,mailbox,sender,recipients,subject,received_at,read_at,status FROM mail_messages WHERE direction=?'+(mailbox?' AND instr(mailbox,?)>0':'')+' ORDER BY received_at DESC,id DESC LIMIT 31 OFFSET ?').bind(direction,...mailbox?[mailbox]:[],offset).all()
  return json({messages:rows.results.slice(0,30),hasMore:rows.results.length>30})
 }
 if(action&&/^[a-zA-Z0-9-]{1,100}$/.test(action)) {
  const row=await message(env,action)
  if(parts[1]==='retry-notifications'&&request.method==='POST'){await notifyMail(env,row.id);return json({ok:true})}
  if(parts[1]==='attachments'&&parts[2]&&request.method==='GET') {
   const file=(await content(env,row)).attachments.find(a=>a.id===parts[2]);if(!file?.key)throw new HttpError(404,'Attachment not found.')
   const object=await env.PHOTOS.get(file.key);if(!object)throw new HttpError(404,'Attachment not found.')
   const filename=(file.filename||'attachment').replace(/[\r\n"\\]/g,'_')
   return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
  }
  if(parts.length===1&&request.method==='GET') {
   const data=await content(env,row)
   const readAt=new Date().toISOString();await env.DB.prepare('UPDATE mail_messages SET read_at=? WHERE id=?').bind(readAt,row.id).run()
   const notifications=await env.DB.prepare('SELECT recipient,status,sent_at FROM mail_notifications WHERE message_id=?').bind(row.id).all()
   return json({...row,read_at:readAt,...data,attachments:data.attachments.map(({key:_,...a})=>a),notifications:notifications.results})
  }
 }
 throw new HttpError(405,'Method not allowed.')
}
