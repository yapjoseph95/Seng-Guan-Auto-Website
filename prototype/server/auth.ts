export type Env = Cloudflare.Env
export class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }
export function json(data: unknown, status = 200, extra: HeadersInit = {}) {
 const headers = new Headers(extra); headers.set('Cache-Control','no-store'); headers.set('X-Content-Type-Options','nosniff')
 return Response.json(data,{status,headers})
}
export function configured(env: Env) {
 if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ADMIN_EMAILS) throw new HttpError(503,'登录服务尚未配置完成。')
 const base = new URL(env.SUPABASE_URL)
 if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) throw new HttpError(503,'登录服务配置有误。')
 return base.origin
}
export function allowed(email: string, env: Env) { return (env.ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).includes(email.toLowerCase()) }
export function cookie(request: Request, name: string) {
 const raw=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)
 try { return raw ? decodeURIComponent(raw) : '' } catch { return '' }
}
export async function limitedText(request: Request, limit: number) {
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Request body required.')
 let size=0;const chunks:Uint8Array[]=[]
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new HttpError(413,'Request too large.')};chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 return new TextDecoder().decode(bytes)
}
export async function administrator(request: Request, env: Env) {
 const base=configured(env)
 const token=cookie(request,'__Host-sga_access')
 if(!token)throw new HttpError(401,'请先登录后台。')
 let response: Response
 try { response=await fetch(base+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+token}}) } catch { throw new HttpError(503,'登录服务暂时无法连接，请稍后重试。') }
 if(!response.ok)throw new HttpError(response.status>=500?503:401,'登录已过期，请重新验证邮箱。')
 const user=await response.json() as {email?:string;email_confirmed_at?:string}
 if(!user.email || !user.email_confirmed_at || !allowed(user.email,env)) throw new HttpError(403,'此邮箱没有后台管理权限。')
 return user.email.toLowerCase()
}
export function sameOrigin(request: Request) {
 if(request.headers.get('Origin')!==new URL(request.url).origin || request.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'请在本站完成此操作。')
}
function sessionCookies(access:string,refresh:string,maxAge:number) {
 const headers=new Headers()
 headers.append('Set-Cookie',`__Host-sga_access=${encodeURIComponent(access)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.min(maxAge,3600)}`)
 headers.append('Set-Cookie',`__Host-sga_refresh=${encodeURIComponent(refresh)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${refresh?604800:0}`)
 return headers
}
async function rateLimit(env: Env,request:Request,key:string,limit:number) {
 const now=Math.floor(Date.now()/1000)
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
 const result=await env.DB.prepare('INSERT INTO auth_limits(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start < ? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start < ? THEN ? ELSE window_start END WHERE count < ? OR window_start < ? RETURNING count').bind(hash,now,now-3600,now-3600,now,limit,now-3600).first()
 if(!result)throw new HttpError(429,'尝试次数太多，请稍后再试。')
 await env.DB.prepare('DELETE FROM auth_limits WHERE window_start < ?').bind(now-86400).run()
 void request
}
export async function authentication(request: Request,env: Env,action:string) {
 const base=configured(env)
 if(action==='session'&&request.method==='GET')return json({email:await administrator(request,env)})
 if(request.method!=='POST')throw new HttpError(405,'Method not allowed.')
 sameOrigin(request)
 const headers={apikey:env.SUPABASE_ANON_KEY,'Content-Type':'application/json'}
 if(action==='logout') {
  const token=cookie(request,'__Host-sga_access')
  if(token)await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{...headers,Authorization:'Bearer '+token}}).catch(()=>{})
  return json({ok:true},200,sessionCookies('','',0))
 }
 if(action==='refresh') {
  const refresh=cookie(request,'__Host-sga_refresh');if(!refresh)throw new HttpError(401,'请重新登录。')
  const r=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers,body:JSON.stringify({refresh_token:refresh})})
  if(!r.ok)return json({error:'请重新登录。'},401,sessionCookies('','',0))
  const data=await r.json() as {access_token:string;refresh_token:string;expires_in:number;user:{email:string;email_confirmed_at:string}}
  if(!data.user?.email_confirmed_at||!allowed(data.user.email,env))return json({error:'此邮箱没有后台管理权限。'},403,sessionCookies('','',0))
  return json({email:data.user.email},200,sessionCookies(data.access_token,data.refresh_token,data.expires_in))
 }
 if(!['request-code','verify-code'].includes(action))throw new HttpError(404,'Not found.')
 if(!request.headers.get('Content-Type')?.includes('application/json'))throw new HttpError(415,'Invalid request.')
 if(Number(request.headers.get('Content-Length'))>2048)throw new HttpError(413,'Request too large.')
 const text=await limitedText(request,2048)
 let input:{email?:string;code?:string};try{input=JSON.parse(text)}catch{throw new HttpError(400,'请输入有效邮箱。')}
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():''
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new HttpError(400,'请输入有效邮箱。')
 const ip=request.headers.get('CF-Connecting-IP')||'unknown'
 await rateLimit(env,request,action+':ip:'+ip,action==='request-code'?10:25)
 if(action==='request-code') {
  if(!allowed(email,env))return json({ok:true})
  await rateLimit(env,request,'send:email:'+email,6)
  const r=await fetch(base+'/auth/v1/otp',{method:'POST',headers,body:JSON.stringify({email,create_user:false})})
  if(!r.ok)throw new HttpError(r.status===429?429:503,r.status===429?'验证码发送过于频繁，请稍后重试。':'验证码暂时无法发送，请稍后重试。')
  return json({ok:true})
 }
 if(!allowed(email,env)||!/^\d{6}$/.test(String(input.code||'')))throw new HttpError(400,'邮箱或验证码不正确。')
 const r=await fetch(base+'/auth/v1/verify',{method:'POST',headers,body:JSON.stringify({email,token:input.code,type:'email'})})
 if(!r.ok)throw new HttpError(400,'验证码不正确或已过期，请重新获取。')
 const data=await r.json() as {access_token:string;refresh_token:string;expires_in:number;user:{email:string;email_confirmed_at:string}}
 if(!data.user?.email_confirmed_at||!allowed(data.user.email,env))throw new HttpError(403,'此邮箱没有后台管理权限。')
 return json({email:data.user.email},200,sessionCookies(data.access_token,data.refresh_token,data.expires_in))
}
