import {HttpError,json,type Env} from './auth'
import {resend,input,mailAddress} from './mail'
import {mailboxes} from '../shared/mail'
export async function categoriesApi(request:Request,env:Env){
 const url=new URL(request.url)
 if(request.method==='GET'){
  const selected=url.searchParams.get('mailbox'),boxes=selected?[mailAddress(selected)]:mailboxes,labels=[]
  for(const box of boxes){const result=await resend<{data:{id:string;name:string;color:string}[]}>(env,'/inboxes/'+encodeURIComponent(box)+'/labels');labels.push(...result.data.map(label=>({...label,mailbox:box})))}
  return json({categories:labels})
 }
 const value=await input(request),box=mailAddress(value.mailbox),id=value.id
 if(id!==undefined&&(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id)))throw new HttpError(400,'Invalid category.')
 if(request.method==='DELETE'&&id)return json(await resend(env,'/inboxes/'+encodeURIComponent(box)+'/labels/'+id,{method:'DELETE'}))
 if(request.method==='POST'||request.method==='PATCH'&&id){
  const name=typeof value.name==='string'?value.name.trim():'',color=value.color
  if(!name||name.length>64||typeof color!=='string'||! /^#[0-9a-f]{6}$/i.test(color))throw new HttpError(400,'Use a category name up to 64 characters and a valid color.')
  return json(await resend(env,'/inboxes/'+encodeURIComponent(box)+'/labels'+(id?'/'+id:''),{method:request.method,body:JSON.stringify({name,color})}))
 }
 throw new HttpError(405,'Method not allowed.')
}
