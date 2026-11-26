export const mailImagePattern=/^https:\/\/sengguanauto\.com\.my\/api\/mail-assets\/[0-9a-f-]{36}$/
export function escapeMailHtml(text:string){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
export function plainMailHtml(text:string){return text.split('\n').map(line=>'<p>'+escapeMailHtml(line)+'</p>').join('')}
export function safeMailStyle(value:string){return value.split(';').flatMap(rule=>{const [name,...rest]=rule.split(':'),key=name.trim().toLowerCase(),v=rest.join(':').trim().toLowerCase();if(key==='margin'&&/^(0|0px)$/.test(v))return ['margin:0'];if(key==='line-height'&&/^1(?:\.\d+)?$/.test(v))return ['line-height:'+v];if(key==='border-top'&&/^1px solid #[0-9a-f]{6}$/.test(v))return [key+':'+v];if(/^padding-(top|bottom|left|right)$/.test(key)&&/^\d+px$/.test(v)&&parseInt(v)<=48)return [key+':'+v];if(['color','background-color'].includes(key)&&/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(v))return [key+':'+v];if(key==='padding'&&/^\d+px$/.test(v)&&parseInt(v)<=48)return [key+':'+v];if(key==='text-align'&&/^(left|center|right)$/.test(v))return [key+':'+v];if(key==='font-size'&&/^\d+(?:\.\d+)?px$/.test(v)&&parseFloat(v)>=9&&parseFloat(v)<=48)return [key+':'+v];return []}).join(';')}
export type MailBranding={signatureHtml:string;headerHtml:string;headerEnabled:boolean;footerHtml?:string;footerEnabled?:boolean;footerText?:string}
export type MailBrandingMap=Record<string,MailBranding>
export const mailBodyFontSize=24
export const mailFooterClass='mail-footer'
export function composeMailHtml(bodyHtml:string,body:string,signatureHtml:string,signature:string,headerHtml:string,footerHtml=''){
 let html=bodyHtml||plainMailHtml(body)
 const signatureBlock=signatureHtml||plainMailHtml(signature)
 if(signatureBlock&&(signature||signatureHtml)){
  // Insert the signature above the editable original-message quote, matching plain text.
  const marker=html.indexOf('---------- Original message ----------')
  const paragraph=marker>=0?html.lastIndexOf('<p',marker):-1
  html=paragraph>=0?html.slice(0,paragraph)+signatureBlock+html.slice(paragraph):html+signatureBlock
 }
 const header=headerHtml?'<div style="background-color:#111315;color:#ffffff;padding-top:8px;padding-bottom:8px;padding-left:24px;padding-right:24px">'+headerHtml+'</div>':''
 const bodyStyle=`padding-left:24px;padding-right:24px;font-size:${mailBodyFontSize}px;line-height:1.5${headerHtml?';padding-top:36px':''}`
 const footer=footerHtml?`<div class="${mailFooterClass}" style="border-top:1px solid #d9dde1;padding-top:16px;color:#697178;font-size:12px;line-height:1.5">${footerHtml}</div>`:''
 return `<div style="padding:24px">${header}<div style="${bodyStyle}">${html}</div>${footer}</div>`
}
