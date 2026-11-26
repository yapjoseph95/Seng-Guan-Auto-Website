export const mailImagePattern=/^https:\/\/sengguanauto\.com\.my\/api\/mail-assets\/[0-9a-f-]{36}$/
export function escapeMailHtml(text:string){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
export function plainMailHtml(text:string){return text.split('\n').map(line=>'<p>'+escapeMailHtml(line)+'</p>').join('')}
export function safeMailStyle(value:string){return value.split(';').flatMap(rule=>{const [name,...rest]=rule.split(':'),key=name.trim().toLowerCase(),v=rest.join(':').trim().toLowerCase();if(['color','background-color'].includes(key)&&/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(v))return [key+':'+v];if(key==='padding'&&/^\d+px$/.test(v)&&parseInt(v)<=48)return [key+':'+v];if(key==='text-align'&&/^(left|center|right)$/.test(v))return [key+':'+v];if(key==='font-size'&&/^\d+(?:\.\d+)?px$/.test(v)&&parseFloat(v)>=9&&parseFloat(v)<=48)return [key+':'+v];return []}).join(';')}
export type MailBranding={signatureHtml:string;headerHtml:string;headerEnabled:boolean}
export type MailBrandingMap=Record<string,MailBranding>
export function composeMailHtml(bodyHtml:string,body:string,signatureHtml:string,signature:string,headerHtml:string){
 let html=bodyHtml||plainMailHtml(body)
 const footer=signatureHtml||plainMailHtml(signature)
 if(footer&&(signature||signatureHtml)){
  // Insert the signature above the editable original-message quote, matching plain text.
  const marker=html.indexOf('---------- Original message ----------')
  const paragraph=marker>=0?html.lastIndexOf('<p',marker):-1
  html=paragraph>=0?html.slice(0,paragraph)+footer+html.slice(paragraph):html+footer
 }
 return '<!doctype html><html><body style="margin:0;background:#ffffff;color:#20252a;font-family:Arial,sans-serif;font-size:16px;line-height:1.5"><div style="max-width:640px;margin:0 auto;padding:24px">'+(headerHtml?'<div style="background-color:#111315;color:#ffffff;padding:24px">'+headerHtml+'</div>':'')+html+'</div></body></html>'
}
