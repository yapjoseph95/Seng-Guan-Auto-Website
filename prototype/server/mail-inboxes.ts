import {HttpError,json,type Env} from './auth'
import {resend,input,addressList,mailAddress,remember,bytesFromDownload} from './mail'
export type InboxEmail={id:string;direction:'inbound'|'outbound';from:string;to:string[];cc:string[];bcc:string[];reply_to:string[];subject:string|null;text:string|null;html:string|null;attachments:{id:string;filename:string|null;size:number|null}[];read:boolean;received_at:string;message_id?:string}
type Thread={id:string;subject:string|null;from:string|null;to:string[];read:boolean;received_at:string;email_count:number}
const uuid=(v:unknown):string=>{if(typeof v!=='string'||! /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v))throw new HttpError(400,'Invalid conversation identifier.');return v}
export const inboxRef=(box:string,thread:string,email?:string)=>['ib',box.split('@')[0],thread,...email?[email]:[]].join('~')
export function parseInboxRef(value:string){const [prefix,name,thread,email,...rest]=value.split('~');if(prefix!=='ib'||!['sales','admin'].includes(name)||rest.length)throw new HttpError(400,'Invalid conversation.');return {box:mailAddress(name+'@sengguanauto.com.my'),thread:uuid(thread),email:email?uuid(email):undefined}}
const root=(box:string)=>'/inboxes/'+encodeURIComponent(mailAddress(box))
export function inboxMessage(box:string,thread:string,e:InboxEmail){return {id:inboxRef(box,thread,e.id),thread_id:inboxRef(box,thread),direction:e.direction,mailbox:box,sender:e.from,recipients:JSON.stringify(e.to),subject:e.subject||'(No subject)',received_at:e.received_at,read_at:e.read?e.received_at:null,status:'received',text:e.text,html:e.html,cc:e.cc||[],bcc:e.bcc||[],reply_to:e.reply_to,attachments:e.attachments.map(a=>({...a,filename:a.filename||'attachment',size:a.size||0})),notifications:[]}}
export async function inboxApi(request:Request,env:Env,parts:string[],owner:string){
 const url=new URL(request.url),action=parts[0]||''
 if(!action&&request.method==='GET'){
  const box=mailAddress(url.searchParams.get('mailbox')||'sales@sengguanauto.com.my'),folder=url.searchParams.get('folder')||'inbox',after=url.searchParams.get('after')
  if(!['inbox','sent','archive','spam'].includes(folder))throw new HttpError(400,'Invalid folder.')
  const query=new URLSearchParams({folders:folder,limit:'30'});if(after)query.set('after',uuid(after))
  const result=await resend<{data:Thread[];has_more:boolean}>(env,root(box)+'/threads?'+query)
  return json({messages:result.data.map(t=>({id:inboxRef(box,t.id),direction:folder==='sent'?'outbound':'inbound',mailbox:box,sender:t.from||box,recipients:JSON.stringify(t.to),subject:t.subject||'(No subject)',received_at:t.received_at,read_at:t.read?t.received_at:null,status:'received',email_count:t.email_count})),hasMore:result.has_more,next:result.data.at(-1)?.id||''})
 }
 if(action==='send'&&request.method==='POST'){
  const value=await input(request),box=mailAddress(value.from),to=addressList(value.to,true),cc=addressList(value.cc),bcc=addressList(value.bcc)
  const subject=typeof value.subject==='string'?value.subject.trim():'',text=typeof value.text==='string'?value.text:''
  const id=typeof value.id==='string'?value.id:''
  if(!/^out-[0-9a-f-]{36}$/.test(id)||!subject||subject.length>250||/[\r\n]/.test(subject)||!text.trim()||text.length>50000||to.length+cc.length+bcc.length>50)throw new HttpError(400,'Check recipients, subject and message.')
  const reply=typeof value.replyId==='string'&&value.replyId?parseInboxRef(value.replyId):null,forward=typeof value.forwardId==='string'&&value.forwardId?parseInboxRef(value.forwardId):null
  if(reply&&forward||(reply||forward)&&((reply||forward)!.box!==box||!(reply||forward)!.email))throw new HttpError(400,'The source mailbox does not match.')
  const payload=JSON.stringify({box,to,cc,bcc,subject,text,reply,forward})
  await env.DB.prepare('INSERT OR IGNORE INTO mail_native_sends(id,payload,created_at) VALUES(?,?,?)').bind(id,payload,new Date().toISOString()).run()
  let state=await env.DB.prepare('SELECT * FROM mail_native_sends WHERE id=?').bind(id).first<{payload:string;created_at:string;draft_id:string|null;provider_id:string|null}>()
  if(!state||state.payload!==payload)throw new HttpError(409,'Use a new send identifier for a different email.')
  if(state.provider_id)return json({id:reply?inboxRef(box,reply.thread):'',status:'sent'})
  if(Date.now()-Date.parse(state.created_at)>23*3600000)throw new HttpError(409,'Please review delivery before retrying this older email.')
  let path:string,body:Record<string,unknown>
  if(forward){path=root(box)+`/threads/${forward.thread}/emails/${forward.email}/forward`;body={to,cc,bcc,subject,text}}
  else {
   if(!state.draft_id){
    const draft=await resend<{id:string}>(env,root(box)+'/drafts',{method:'POST',body:JSON.stringify({to,cc,bcc,subject,text,...reply?{thread_id:reply.thread,reply_to_email_id:reply.email}:{}})})
    await env.DB.prepare('UPDATE mail_native_sends SET draft_id=? WHERE id=? AND draft_id IS NULL').bind(uuid(draft.id),id).run()
    state=await env.DB.prepare('SELECT * FROM mail_native_sends WHERE id=?').bind(id).first<typeof state>()
   }
   if(!state?.draft_id)throw new HttpError(503,'Draft could not be saved. Retry later.')
   path=root(box)+`/drafts/${state.draft_id}/send`;body={}
  }
  const result=await resend<{id:string}>(env,path,{method:'POST',headers:{'Idempotency-Key':'mail-inbox/'+id},body:JSON.stringify(body)})
  await env.DB.prepare('UPDATE mail_native_sends SET provider_id=? WHERE id=?').bind(result.id,id).run()
  await remember(env,owner,'address',[...to,...cc,...bcc]).catch(()=>{});await remember(env,owner,'subject',[subject]).catch(()=>{})
  return json({id:reply?inboxRef(box,reply.thread):'',status:'sent'})
 }
 const ref=parseInboxRef(action),path=root(ref.box)+`/threads/${ref.thread}`
 if(parts[1]==='attachments'&&parts[2]&&request.method==='GET'){
  if(!ref.email)throw new HttpError(400,'Choose a message attachment.')
  const email=await resend<InboxEmail>(env,path+'/emails/'+ref.email),file=email.attachments.find(a=>a.id===parts[2])
  if(!file)throw new HttpError(404,'Attachment not found.')
  const key=`mail/${ref.email}/attachments/${encodeURIComponent(file.id)}`
  let saved=await env.PHOTOS.get(key)
  if(!saved){const metadata=await resend<{download_url:string}>(env,`/emails/${email.direction==='inbound'?'receiving/':''}${ref.email}/attachments/${encodeURIComponent(file.id)}`);await env.PHOTOS.put(key,await bytesFromDownload(metadata.download_url));saved=await env.PHOTOS.get(key)}
  if(!saved)throw new HttpError(503,'Attachment is temporarily unavailable.')
  return new Response(saved.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent((file.filename||'attachment').replace(/[\r\n]/g,'_'))}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
 }
 if(request.method==='PATCH'){
  const value=await input(request)
  if(!['inbox','archive','spam'].includes(String(value.folder)))throw new HttpError(400,'Invalid folder.')
  return json(await resend(env,path,{method:'PATCH',body:JSON.stringify({folder:value.folder})}))
 }
 if(request.method==='GET'){
  const query=new URLSearchParams({limit:'100'}),after=url.searchParams.get('after');if(after)query.set('after',uuid(after))
  const result=await resend<{data:InboxEmail[];has_more:boolean}>(env,path+'/emails?'+query)
  if(!after)await resend(env,path,{method:'PATCH',body:JSON.stringify({read:true})})
  const data=result.data.map(e=>inboxMessage(ref.box,ref.thread,after?e:{...e,read:true}));const latest=data.at(-1)
  if(!latest)throw new HttpError(404,'Conversation is empty.')
  return json({...latest,thread_id:inboxRef(ref.box,ref.thread),emails:data,hasMore:result.has_more,next:result.data.at(-1)?.id||''})
 }
 throw new HttpError(405,'Method not allowed.')
}
