export const mailboxes=['sales@sengguanauto.com.my','admin@sengguanauto.com.my'] as const
export const defaultNotificationRoutes:Record<string,string[]>={
 'sales@sengguanauto.com.my':['sengguanauto.app@hotmail.com'],
 'admin@sengguanauto.com.my':['sengguanauto.bos@hotmail.com'],
}
export function splitAddresses(value:string){return [...new Set(value.split(/[,;\n]+/).map(s=>s.trim().toLowerCase()).filter(Boolean))]}
export function matchingHistory(history:string[],value:string){const term=value.split(/[,;\n]/).at(-1)?.trim().toLowerCase()||'';const used=new Set(splitAddresses(value.split(/[,;\n]/).slice(0,-1).join(',')));return history.filter(v=>!used.has(v.toLowerCase())&&(!term||v.toLowerCase().includes(term))).slice(0,8)}
export function insertHistoryAddress(value:string,address:string){const parts=value.split(/[,;\n]/);parts[parts.length-1]=address;return parts.map(s=>s.trim()).filter(Boolean).join(', ')}

export function withMailSignature(body:string,signature:string){if(!signature)return body;const quote=body.indexOf('\n\n---------- Original message ----------');return quote>=0?body.slice(0,quote)+'\n\n'+signature+body.slice(quote):body+'\n\n'+signature}
