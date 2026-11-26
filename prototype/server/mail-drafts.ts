import {HttpError,json,type Env} from './auth'
import {input,mailAddress,keyHash} from './mail'
const draftId=(value:string)=>{if(!/^draft-[0-9a-f-]{36}$/.test(value))throw new HttpError(400,'Invalid draft.');return value}
export async function draftsApi(request:Request,env:Env,parts:string[],owner:string){
 if(!owner)throw new HttpError(403,'Administrator sign-in required.')
 const id=parts[0],url=new URL(request.url)
 if(!id&&request.method==='GET'){
  const box=url.searchParams.get('mailbox')||'',query=(url.searchParams.get('q')||'').trim(),offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0))
  if(box)mailAddress(box);if(query.length>256)throw new HttpError(400,'Search is too long.')
  const rows=await env.DB.prepare("SELECT id,mailbox,payload,updated_at FROM mail_saved_drafts WHERE owner=? AND deleted_at IS NULL AND (?='' OR mailbox=?) AND (?='' OR instr(lower(payload),lower(?))>0) ORDER BY updated_at DESC,id LIMIT 31 OFFSET ?").bind(owner,box,box,query,query,offset).all<{id:string;mailbox:string;payload:string;updated_at:string}>()
  return json({messages:rows.results.slice(0,30).map(row=>{const p=JSON.parse(row.payload);return {id:row.id,direction:'draft',mailbox:row.mailbox,sender:owner,recipients:JSON.stringify(p.to?[p.to]:[]),subject:p.subject||'(No subject)',received_at:row.updated_at,read_at:row.updated_at,status:'draft'}}),hasMore:rows.results.length>30})
 }
 if(!id&&request.method==='POST'){
  const value=await input(request,1500000),key=draftId(String(value.id||'')),from=mailAddress(value.from)
  const fields=['to','cc','bcc','subject','body','bodyHtml','replyId','forwardId','sendId','retryPayload'] as const
  const payload:Record<string,unknown>={from,includeSignature:value.includeSignature!==false}
  for(const field of fields){const text=value[field]??'';const max=field==='bodyHtml'?200000:field==='body'?50000:field==='retryPayload'?600000:field==='subject'?250:4000;if(typeof text!=='string'||text.length>max)throw new HttpError(400,'Draft contains an invalid field.');payload[field]=text}
  if(!/^out-[0-9a-f-]{36}$/.test(String(payload.sendId)))throw new HttpError(400,'Invalid draft send identifier.')
  if(!Array.isArray(value.uploads)||value.uploads.length>50||value.uploads.some(v=>typeof v!=='string'||! /^[0-9a-f-]{36}$/.test(v)))throw new HttpError(400,'Invalid draft attachments.')
  payload.uploads=value.uploads
  const existing=await env.DB.prepare('SELECT owner,updated_at,deleted_at FROM mail_saved_drafts WHERE id=?').bind(key).first<{owner:string;updated_at:string;deleted_at:string|null}>()
  if(existing&&(existing.owner!==owner||existing.deleted_at||existing.updated_at!==value.updatedAt))throw new HttpError(409,'Draft changed in another window. Copy your text before reloading it.')
  const now=new Date(Math.max(Date.now(),existing?Date.parse(existing.updated_at)+1:0)).toISOString()
  const result=existing?await env.DB.prepare('UPDATE mail_saved_drafts SET mailbox=?,payload=?,updated_at=? WHERE id=? AND owner=? AND updated_at=? AND deleted_at IS NULL').bind(from,JSON.stringify(payload),now,key,owner,existing.updated_at).run():await env.DB.prepare('INSERT OR IGNORE INTO mail_saved_drafts(id,owner,mailbox,payload,updated_at) VALUES(?,?,?,?,?)').bind(key,owner,from,JSON.stringify(payload),now).run()
  if(!result.meta.changes)throw new HttpError(409,'Draft changed in another window. Copy your text before reloading it.')
  return json({id:key,updatedAt:now})
 }
 if(id){
  draftId(id)
  if(parts[1]==='restore'&&request.method==='POST'){
   const previous=await env.DB.prepare('SELECT updated_at,deleted_at FROM mail_saved_drafts WHERE id=? AND owner=?').bind(id,owner).first<{updated_at:string;deleted_at:string|null}>()
   if(!previous)throw new HttpError(404,'Draft not found.')
   if(!previous.deleted_at)return json({ok:true})
   const now=new Date(Math.max(Date.now(),Date.parse(previous.updated_at)+1)).toISOString()
   const result=await env.DB.prepare('UPDATE mail_saved_drafts SET deleted_at=NULL,updated_at=? WHERE id=? AND owner=? AND updated_at=? AND deleted_at IS NOT NULL').bind(now,id,owner,previous.updated_at).run()
   if(!result.meta.changes)throw new HttpError(409,'Draft changed in another window. Reload it before trying again.')
   return json({ok:true})
  }
  const row=await env.DB.prepare('SELECT * FROM mail_saved_drafts WHERE id=? AND owner=? AND deleted_at IS NULL').bind(id,owner).first<{payload:string;updated_at:string}>()
  if(!row)throw new HttpError(404,'Draft not found.')
  if(request.method==='DELETE'){const value=await input(request);if(value.updatedAt!==row.updated_at)throw new HttpError(409,'Draft changed in another window. Its newer edits were kept.');const now=new Date(Math.max(Date.now(),Date.parse(row.updated_at)+1)).toISOString();const result=await env.DB.prepare('UPDATE mail_saved_drafts SET deleted_at=?,updated_at=? WHERE id=? AND owner=? AND updated_at=? AND deleted_at IS NULL').bind(now,now,id,owner,row.updated_at).run();if(!result.meta.changes)throw new HttpError(409,'Draft changed in another window. Its newer edits were kept.');return json({ok:true})}
  if(request.method==='GET'){
   const data=JSON.parse(row.payload),attachments=[]
   for(const file of data.uploads){const object=await env.PHOTOS.get('mail-uploads/'+await keyHash(owner)+'/'+file+'.json');const meta=object?await object.json<{filename:string;size:number}>():{filename:'Unavailable attachment',size:0};attachments.push({id:file,...meta})}
   return json({...data,id,updatedAt:row.updated_at,attachments})
  }
 }
 throw new HttpError(405,'Method not allowed.')
}
