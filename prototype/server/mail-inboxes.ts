import {HttpError,json,type Env} from './auth'
import {resend,input,addressList,mailAddress,remember,bytesFromDownload,keyHash} from './mail'
export type InboxEmail={id:string;direction:'inbound'|'outbound';from:string;to:string[];cc:string[];bcc:string[];reply_to:string[];subject:string|null;text:string|null;html:string|null;attachments:{id:string;filename:string|null;size:number|null}[];read:boolean;received_at:string;message_id?:string}
type Thread={id:string;subject:string|null;from:string|null;to:string[];read:boolean;received_at:string;email_count:number;labels?:{id:string;name:string;color:string}[]}
const uuid=(v:unknown):string=>{if(typeof v!=='string'||! /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v))throw new HttpError(400,'Invalid conversation identifier.');return v}
export const inboxRef=(box:string,thread:string,email?:string)=>['ib',box.split('@')[0],thread,...email?[email]:[]].join('~')
export function parseInboxRef(value:string){const [prefix,name,thread,email,...rest]=value.split('~');if(prefix!=='ib'||!['sales','admin'].includes(name)||rest.length)throw new HttpError(400,'Invalid conversation.');return {box:mailAddress(name+'@sengguanauto.com.my'),thread:uuid(thread),email:email?uuid(email):undefined}}
const root=(box:string)=>'/inboxes/'+encodeURIComponent(mailAddress(box))
export function inboxMessage(box:string,thread:string,e:InboxEmail){return {id:inboxRef(box,thread,e.id),thread_id:inboxRef(box,thread),direction:e.direction,mailbox:box,sender:e.from,recipients:JSON.stringify(e.to),subject:e.subject||'(No subject)',received_at:e.received_at,read_at:e.read?e.received_at:null,status:'received',text:e.text,html:e.html,cc:e.cc||[],bcc:e.bcc||[],reply_to:e.reply_to,attachments:e.attachments.map(a=>({...a,filename:a.filename||'attachment',size:a.size||0})),notifications:[]}}
export async function inboxApi(request:Request,env:Env,parts:string[],owner:string){
 const url=new URL(request.url),action=parts[0]||''
 if(!action&&request.method==='GET'){
  const selected=url.searchParams.get('mailbox')||'',folder=url.searchParams.get('folder')||'inbox',after=url.searchParams.get('after')||''
  if(!['inbox','sent','archive','spam','trash'].includes(folder))throw new HttpError(400,'Invalid folder.')
  const search=(url.searchParams.get('q')||'').trim(),category=url.searchParams.get('category')||''
  if(search.length>256||search.split(/\s+/).filter(Boolean).length>32)throw new HttpError(400,'Use up to 256 characters and 32 search words.')
  let categoryBox='',categoryId=''
  if(category){const [name,id]=category.split('~');categoryBox=mailAddress(name+'@sengguanauto.com.my');categoryId=uuid(id)}
  const boxes=selected?[mailAddress(selected)]:['sales@sengguanauto.com.my','admin@sengguanauto.com.my']
  let cursors:Record<string,string>={}
  if(after){if(selected)cursors[selected]=uuid(after);else{try{if(after.length>512)throw new Error();const value=JSON.parse(atob(after));for(const box of boxes)cursors[box]=value[box]?uuid(value[box]):''}catch{throw new HttpError(400,'Invalid mailbox page.')}}}
  const pages:{box:string;data:Thread[];has_more:boolean}[]=[]
  for(const box of boxes){if(categoryBox&&categoryBox!==box)continue;const query=new URLSearchParams({folders:search&&url.searchParams.get('scope')!=='folder'?'inbox,sent,archive,spam,trash':folder,limit:'30'});if(search)query.set('query',search);if(categoryId)query.set('labels',categoryId);if(cursors[box])query.set('after',cursors[box]);const page=await resend<{data:Thread[];has_more:boolean}>(env,root(box)+'/threads'+(search?'/search':'')+'?'+query);pages.push({box,...page})}
  const merged=pages.flatMap(page=>page.data.map(t=>({box:page.box,t}))).sort((a,b)=>Date.parse(b.t.received_at)-Date.parse(a.t.received_at)||a.box.localeCompare(b.box)).slice(0,30)
  for(const {box,t} of merged)cursors[box]=t.id
  return json({messages:merged.map(({box,t})=>({id:inboxRef(box,t.id),direction:folder==='sent'?'outbound':'inbound',mailbox:box,sender:t.from||box,recipients:JSON.stringify(t.to),subject:t.subject||'(No subject)',received_at:t.received_at,read_at:t.read?t.received_at:null,status:'received',email_count:t.email_count,labels:t.labels||[]})),hasMore:pages.some(p=>p.has_more||p.data.length>merged.filter(v=>v.box===p.box).length),next:selected?cursors[selected]||'':btoa(JSON.stringify(cursors))})
 }
 if(action==='uploads'&&request.method==='POST'){
  if(!owner)throw new HttpError(403,'Administrator sign-in required.')
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new HttpError(415,'Choose an attachment to upload.')
  const max=25*1024*1024,reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Attachment is missing.')
  const chunks:Uint8Array[]=[];let size=0
  while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>max+65536){await reader.cancel();throw new HttpError(413,'Attachments must total no more than 25 MB.')}chunks.push(next.value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  let form:FormData;try{form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')!},body:bytes}).formData()}catch{throw new HttpError(400,'Invalid attachment upload.')}
  const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>max||!file.name||file.name.length>255||/[\r\n\0]/.test(file.name))throw new HttpError(400,'Choose a non-empty file up to 25 MB.')
  const id=crypto.randomUUID(),prefix='mail-uploads/'+await keyHash(owner)+'/'+id
  await env.PHOTOS.put(prefix,await file.arrayBuffer())
  await env.PHOTOS.put(prefix+'.json',JSON.stringify({filename:file.name,content_type:file.type||'application/octet-stream',size:file.size}))
  return json({id,filename:file.name,size:file.size})
 }
 if(action==='send'&&request.method==='POST'){
  const value=await input(request),box=mailAddress(value.from),to=addressList(value.to,true),cc=addressList(value.cc),bcc=addressList(value.bcc)
  const subject=typeof value.subject==='string'?value.subject.trim():'',text=typeof value.text==='string'?value.text:''
  const id=typeof value.id==='string'?value.id:''
  if(!/^out-[0-9a-f-]{36}$/.test(id)||!subject||subject.length>250||/[\r\n]/.test(subject)||(!text.trim()&&!value.forwardId)||text.length>50000||to.length+cc.length+bcc.length>50)throw new HttpError(400,'Check recipients, subject and message.')
  const reply=typeof value.replyId==='string'&&value.replyId?parseInboxRef(value.replyId):null,forward=typeof value.forwardId==='string'&&value.forwardId?parseInboxRef(value.forwardId):null
  if(reply&&forward||(reply||forward)&&((reply||forward)!.box!==box||!(reply||forward)!.email))throw new HttpError(400,'The source mailbox does not match.')
  const uploads=value.uploads===undefined?[]:value.uploads
  if(!Array.isArray(uploads)||uploads.length>50||new Set(uploads).size!==uploads.length)throw new HttpError(400,'Use no more than 50 attachments.')
  uploads.forEach(uuid)
  const payload=JSON.stringify({box,to,cc,bcc,subject,text,reply,forward,...uploads.length?{uploads}:{}})
  await env.DB.prepare('INSERT OR IGNORE INTO mail_native_sends(id,payload,created_at) VALUES(?,?,?)').bind(id,payload,new Date().toISOString()).run()
  let state=await env.DB.prepare('SELECT * FROM mail_native_sends WHERE id=?').bind(id).first<{payload:string;created_at:string;draft_id:string|null;provider_id:string|null}>()
  if(!state||state.payload!==payload)throw new HttpError(409,'Use a new send identifier for a different email.')
  if(state.provider_id)return json({id:reply?inboxRef(box,reply.thread):'',status:'sent'})
  if(Date.now()-Date.parse(state.created_at)>23*3600000)throw new HttpError(409,'Please review delivery before retrying this older email.')
  const {files:attachments}=await loadMailUploads(env,owner,uploads)
  let path:string,body:Record<string,unknown>
  if(forward){path=root(box)+`/threads/${forward.thread}/emails/${forward.email}/forward`;body={to,cc,bcc,subject,text,attachments}}
  else {
   if(!state.draft_id){
    const draft=await resend<{id:string}>(env,root(box)+'/drafts',{method:'POST',body:JSON.stringify({to,cc,bcc,subject,text,attachments,...reply?{thread_id:reply.thread,reply_to_email_id:reply.email}:{}})})
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
 if(request.method==='DELETE')return json(await resend(env,path,{method:'PATCH',body:JSON.stringify({folder:'trash'})}))
 if(request.method==='PATCH'){
  const value=await input(request)
  if(Array.isArray(value.labels)){if(value.labels.length>100)throw new HttpError(400,'Too many categories.');value.labels.forEach(uuid);return json(await resend(env,path+'/labels',{method:'PUT',body:JSON.stringify({labels:value.labels})}))}
  if(!['inbox','archive','spam','trash'].includes(String(value.folder)))throw new HttpError(400,'Invalid folder.')
  return json(await resend(env,path,{method:'PATCH',body:JSON.stringify({folder:value.folder})}))
 }
 if(request.method==='GET'){
  const query=new URLSearchParams({limit:'100'}),after=url.searchParams.get('after');if(after)query.set('after',uuid(after))
  const result=await resend<{data:InboxEmail[];has_more:boolean}>(env,path+'/emails?'+query)
  const summary=await resend<{labels:{id:string;name:string;color:string}[];folder:string}>(env,path,{method:'PATCH',body:JSON.stringify({read:true})})
  const data=result.data.map(e=>inboxMessage(ref.box,ref.thread,after?e:{...e,read:true}));const latest=data.at(-1)
  if(!latest)throw new HttpError(404,'Conversation is empty.')
  return json({...latest,labels:summary.labels||[],folder:summary.folder,thread_id:inboxRef(ref.box,ref.thread),emails:data,hasMore:result.has_more,next:result.data.at(-1)?.id||''})
 }
 throw new HttpError(405,'Method not allowed.')
}

export async function loadMailUploads(env:Env,owner:string,uploads:unknown){
 if(!Array.isArray(uploads)||uploads.length>50||new Set(uploads).size!==uploads.length)throw new HttpError(400,'Use no more than 50 attachments.')
 uploads.forEach(uuid)
 const ownerHash=await keyHash(owner)
 const attachments:{filename:string;content_type:string;content:string}[]=[];let total=0
 for(const upload of uploads){
   if(!owner)throw new HttpError(403,'Administrator sign-in required.')
   const prefix='mail-uploads/'+await keyHash(owner)+'/'+upload,meta=await env.PHOTOS.get(prefix+'.json'),file=await env.PHOTOS.get(prefix)
   if(!meta||!file)throw new HttpError(400,'An attachment is unavailable. Upload it again.')
   const info=await meta.json<{filename:string;content_type:string;size:number}>(),bytes=new Uint8Array(await file.arrayBuffer());total+=bytes.length
   if(total>25*1024*1024)throw new HttpError(413,'Attachments must total no more than 25 MB.')
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
   attachments.push({filename:info.filename,content_type:info.content_type,content:btoa(binary)})
  }
 return {files:attachments,total,stored:uploads.map((id,index)=>({id:String(id),filename:attachments[index].filename,content_type:attachments[index].content_type,size:Math.floor(attachments[index].content.length*3/4)-(attachments[index].content.endsWith('==')?2:attachments[index].content.endsWith('=')?1:0),key:'mail-uploads/'+ownerHash+'/'+id}))}
}
