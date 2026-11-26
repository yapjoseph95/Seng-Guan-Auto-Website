import {parseFragment} from 'parse5'
import {HttpError,json,type Env} from './auth'
import {input,mailAddress} from './mail'
import {mailboxes} from '../shared/mail'
import {escapeMailHtml,plainMailHtml,mailHeaderClass,mailFooterClass,mailImagePattern,safeMailStyle,type MailBrandingMap} from '../shared/mail-html'
const mailBrandingClasses=[mailHeaderClass,mailFooterClass]
type HtmlNode={nodeName:string;value?:string;attrs?:{name:string;value:string}[];childNodes?:HtmlNode[]}
export function sanitizeMailHtml(value:unknown,max=200000){
 if(typeof value!=='string'||value.length>max)throw new HttpError(400,'Email formatting is too large.')
 const allowed=new Set(['p','br','div','span','strong','b','em','i','u','s','ul','ol','li','blockquote','h1','h2','h3','hr','img'])
 const visit=(node:HtmlNode):string=>{
  if(node.nodeName==='#text')return escapeMailHtml(node.value||'')
  const tag=node.nodeName
  if(['script','style','svg','math','iframe','object','template','form'].includes(tag))return ''
  const children=(node.childNodes||[]).map(visit).join('')
  if(!allowed.has(tag))return children
  const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]))
  if(tag==='img'){
   if(!mailImagePattern.test(attrs.src||''))return ''
   const width=Math.max(24,Math.min(600,Number(attrs.width)||200))
   return `<img src="${attrs.src}" alt="${escapeMailHtml((attrs.alt||'').slice(0,200))}" width="${width}" style="max-width:100%;height:auto;border:0">`
  }
  const styles=safeMailStyle(attrs.style||'').split(';').filter(Boolean)
  if(tag==='p'){for(const property of ['margin','padding','line-height']){const index=styles.findIndex(style=>style.startsWith(property+':'));if(index>=0)styles.splice(index,1)}styles.unshift('margin:0','padding:0px','line-height:1.5')}
  const style=styles.join(';')
  const content=tag==='p'&&!children?'<br>':children
  const brandingClass=tag==='div' && mailBrandingClasses.includes(attrs.class) ? ` class="${attrs.class}"` : ''
  return '<'+tag+brandingClass+(style?' style="'+style+'"':'')+'>'+content+(['br','hr'].includes(tag)?'':'</'+tag+'>')
 }
 return visit(parseFragment(value))
}
export function outboundMailHtml(html:string,text:string){
 const body=html||plainMailHtml(text.replace(/\r\n?/g,'\n'))
 const logoSelectors=mailBrandingClasses.filter(name=>body.includes(`<div class="${name}"`)).map(name=>`.${name} img`).join(',')
 const mobileLogos=logoSelectors ? `<style>@media screen and (max-width:480px){${logoSelectors}{max-width:120px!important;height:auto!important}}</style>` : ''
 return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;700&amp;display=swap">${mobileLogos}</head><body><div style="font-family:'Google Sans',Arial,Helvetica,sans-serif">${body}</div></body></html>`
}
export async function formattingApi(request:Request,env:Env,parts:string[]){
 if(parts[0]==='images'&&request.method==='POST'){
  const length=Number(request.headers.get('Content-Length')||0);if(length>2200000)throw new HttpError(413,'Branding images must be smaller than 2 MB.')
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Choose an image.')
  const chunks:Uint8Array[]=[];let total=0
  try{for(;;){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>2*1024*1024){await reader.cancel();throw new HttpError(413,'Branding images must be smaller than 2 MB.')}chunks.push(chunk.value)}}finally{reader.releaseLock()}
  if(total<12)throw new HttpError(400,'Upload a PNG, JPEG or WebP image.')
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const type=rasterType(new Uint8Array(bytes));if(!type)throw new HttpError(400,'Upload a PNG, JPEG or WebP image.')
  const id=crypto.randomUUID();await env.PHOTOS.put('mail-branding/'+id,bytes,{httpMetadata:{contentType:type}})
  return json({url:'https://sengguanauto.com.my/api/mail-assets/'+id},201)
 }
 if(parts.length)throw new HttpError(404,'Not found.')
 if(request.method==='GET'){
  const rows=await env.DB.prepare('SELECT mailbox,signature_html,header_html,header_enabled,footer_html,footer_enabled,footer_text FROM mail_branding').all<{mailbox:string;signature_html:string;header_html:string;header_enabled:number;footer_html:string;footer_enabled:number;footer_text:string}>()
  return json(Object.fromEntries(rows.results.map(row=>[row.mailbox,{signatureHtml:row.signature_html,headerHtml:row.header_html,headerEnabled:!!row.header_enabled,footerHtml:row.footer_html,footerEnabled:!!row.footer_enabled,footerText:row.footer_text}])))
 }
 if(request.method==='PUT'){
  const value=await input(request,500000),statements=[]
  for(const mailbox of mailboxes){mailAddress(mailbox);const config=(value as MailBrandingMap)[mailbox];if(!config||typeof config.headerEnabled!=='boolean')throw new HttpError(400,'Check the mailbox formatting settings.')
   const signatureText=(value[mailbox] as Record<string,unknown>).signatureText
   if(signatureText!==undefined){if(typeof signatureText!=='string'||signatureText.length>4000)throw new HttpError(400,'Signatures may contain up to 4,000 characters.');statements.push(env.DB.prepare('UPDATE mail_signatures SET signature=? WHERE mailbox=?').bind(signatureText,mailbox))}
   const signature=sanitizeMailHtml(config.signatureHtml,50000),header=sanitizeMailHtml(config.headerHtml,50000)
   const previous=await env.DB.prepare('SELECT footer_html,footer_enabled,footer_text FROM mail_branding WHERE mailbox=?').bind(mailbox).first<{footer_html:string;footer_enabled:number;footer_text:string}>()
   if(config.footerEnabled!==undefined&&typeof config.footerEnabled!=='boolean')throw new HttpError(400,'Check the footer setting.')
   const footer=config.footerHtml===undefined?previous?.footer_html||'':sanitizeMailHtml(config.footerHtml,50000),footerEnabled=config.footerEnabled===undefined?previous?.footer_enabled||0:config.footerEnabled?1:0,footerText=config.footerText===undefined?previous?.footer_text||'':config.footerText
   if(typeof footerText!=='string'||footerText.length>10000)throw new HttpError(400,'Footer text is too long.')
   statements.push(env.DB.prepare('INSERT INTO mail_branding(mailbox,signature_html,header_html,header_enabled,footer_html,footer_enabled,footer_text) VALUES(?,?,?,?,?,?,?) ON CONFLICT(mailbox) DO UPDATE SET signature_html=excluded.signature_html,header_html=excluded.header_html,header_enabled=excluded.header_enabled,footer_html=excluded.footer_html,footer_enabled=excluded.footer_enabled,footer_text=excluded.footer_text').bind(mailbox,signature,header,config.headerEnabled?1:0,footer,footerEnabled,footerText))
  }
  await env.DB.batch(statements);return json({ok:true})
 }
 throw new HttpError(405,'Method not allowed.')
}
function rasterType(bytes:Uint8Array){if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return 'image/png';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';return ''}
export async function mailBrandImage(request:Request,env:Env,id:string){
 if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'Method not allowed.')
 if(!/^[0-9a-f-]{36}$/.test(id))throw new HttpError(404,'Image not found.')
 const object=await env.PHOTOS.get('mail-branding/'+id);if(!object)throw new HttpError(404,'Image not found.')
 const bytes=await object.arrayBuffer(),type=rasterType(new Uint8Array(bytes));if(!type)throw new HttpError(404,'Image not found.')
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':type,'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'; sandbox"}})
}
