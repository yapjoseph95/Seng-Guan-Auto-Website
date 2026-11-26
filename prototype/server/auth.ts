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
const idleTimeout=2*24*60*60
const idleCookie='__Host-sga_idle'
const loginChallengeCookie='__Host-sga_login'
const loginChallengeAge=600
function loginChallengeHeader(id:string){
 return `${loginChallengeCookie}=${id}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${id?loginChallengeAge:0}`
}
const nowSeconds=()=>Math.floor(Date.now()/1000)
async function activeSession(request:Request,env:Env){
 const id=cookie(request,idleCookie)
 if(!id)throw new HttpError(401,'请重新登录。')
 const session=await env.DB.prepare('SELECT email FROM admin_idle_sessions WHERE id=? AND last_activity>?').bind(id,nowSeconds()-idleTimeout).first<{email:string}>()
 if(!session)throw new HttpError(401,'请重新登录。')
 return session
}
export async function administrator(request: Request, env: Env) {
 const base=configured(env)
 const token=cookie(request,'__Host-sga_access')
 if(!token)throw new HttpError(401,'请先登录后台。')
 const session=await activeSession(request,env)
 let response: Response
 try { response=await fetch(base+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+token}}) } catch { throw new HttpError(503,'登录服务暂时无法连接，请稍后重试。') }
 if(!response.ok)throw new HttpError(response.status>=500?503:401,'登录已过期，请重新验证邮箱。')
 const user=await response.json() as {email?:string;email_confirmed_at?:string}
 if(!user.email || !user.email_confirmed_at || !allowed(user.email,env)) throw new HttpError(403,'此邮箱没有后台管理权限。')
 if(user.email.toLowerCase()!==session.email)throw new HttpError(401,'请重新登录。')
 return session.email
}
export function sameOrigin(request: Request) {
 if(request.headers.get('Origin')!==new URL(request.url).origin || request.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'请在本站完成此操作。')
}
function sessionCookies(access:string,refresh:string,maxAge:number,id?:string) {
 const headers=new Headers()
 headers.append('Set-Cookie',`__Host-sga_access=${encodeURIComponent(access)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.min(maxAge,3600)}`)
 headers.append('Set-Cookie',`__Host-sga_refresh=${encodeURIComponent(refresh)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${refresh?604800:0}`)
 if(id!==undefined)headers.append('Set-Cookie',`${idleCookie}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${id?604800:0}`)
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
 if(action==='reset-password'){
  if(!request.headers.get('Content-Type')?.includes('application/json'))throw new HttpError(415,'Invalid request.')
  let input:{password?:unknown};try{input=JSON.parse(await limitedText(request,4096))}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'Invalid request.')}
  if(typeof input?.password!=='string'||input.password.length<8||input.password.length>512)throw new HttpError(400,'Use a password with at least 8 characters.')
  const authorization=request.headers.get('Authorization')||''
  if(!/^Bearer [A-Za-z0-9_.-]{1,8192}$/.test(authorization))throw new HttpError(401,'This reset link has expired. Request a new one.')
  const userHeaders={...headers,Authorization:authorization}
  const userResponse=await fetch(base+'/auth/v1/user',{headers:userHeaders})
  if(userResponse.status===429||userResponse.status>=500)throw new HttpError(503,'Password reset is temporarily unavailable. Try again.')
  if(!userResponse.ok)throw new HttpError(401,'This reset link has expired. Request a new one.')
  const user=await userResponse.json() as {email?:string;email_confirmed_at?:string}
  if(!user.email||!user.email_confirmed_at||!allowed(user.email,env))throw new HttpError(403,'This account cannot access the admin dashboard.')
  const updated=await fetch(base+'/auth/v1/user',{method:'PUT',headers:userHeaders,body:JSON.stringify({password:input.password})})
  if(updated.status===401||updated.status===403)throw new HttpError(401,'This reset link has expired. Request a new one.')
  if(updated.status===429||updated.status>=500)throw new HttpError(503,'Password reset is temporarily unavailable. Try again.')
  if(!updated.ok)throw new HttpError(400,'Choose a different password and try again.')
  const email=user.email.toLowerCase()
  await env.DB.batch([
   env.DB.prepare('DELETE FROM admin_idle_sessions WHERE email=?').bind(email),
   env.DB.prepare('DELETE FROM admin_login_challenges WHERE email=?').bind(email),
  ])
  return json({ok:true},200,sessionCookies('','',0,''))
 }
 if(action==='activity'){
  const id=cookie(request,idleCookie),now=nowSeconds()
  if(!id)throw new HttpError(401,'请重新登录。')
  const session=await env.DB.prepare('UPDATE admin_idle_sessions SET last_activity=MAX(last_activity,?) WHERE id=? AND last_activity>? RETURNING email').bind(now,id,now-idleTimeout).first<{email:string}>()
  if(!session||!allowed(session.email,env))throw new HttpError(401,'请重新登录。')
  return json({ok:true})
 }
 if(action==='logout') {
  const id=cookie(request,idleCookie)
  if(id)await env.DB.prepare('DELETE FROM admin_idle_sessions WHERE id=?').bind(id).run()
  const token=cookie(request,'__Host-sga_access')
  if(token)await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{...headers,Authorization:'Bearer '+token}}).catch(()=>{})
  return json({ok:true},200,sessionCookies('','',0,''))
 }
 if(action==='refresh') {
  const session=await activeSession(request,env)
  const refresh=cookie(request,'__Host-sga_refresh');if(!refresh)throw new HttpError(401,'请重新登录。')
  const r=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers,body:JSON.stringify({refresh_token:refresh})})
  if(!r.ok)return json({error:'请重新登录。'},401,sessionCookies('','',0,''))
  const data=await r.json() as {access_token:string;refresh_token:string;expires_in:number;user:{email:string;email_confirmed_at:string}}
  if(!data.user?.email_confirmed_at||!allowed(data.user.email,env))return json({error:'此邮箱没有后台管理权限。'},403,sessionCookies('','',0,''))
  if(data.user.email.toLowerCase()!==session.email)throw new HttpError(401,'请重新登录。')
  return json({email:data.user.email},200,sessionCookies(data.access_token,data.refresh_token,data.expires_in,cookie(request,idleCookie)))
 }
 if(!['request-code','resend-code','verify-code'].includes(action))throw new HttpError(404,'Not found.')
 if(!request.headers.get('Content-Type')?.includes('application/json'))throw new HttpError(415,'Invalid request.')
 let input:{email?:string;code?:string;password?:string}
 try{input=JSON.parse(await limitedText(request,4096))||{}}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'Invalid request.')}
 const ip=request.headers.get('CF-Connecting-IP')||'unknown'
 await rateLimit(env,request,action+':ip:'+ip,action==='verify-code'?25:10)
 const challengeId=cookie(request,loginChallengeCookie)
 const sendCode=async(email:string)=>{
  await rateLimit(env,request,'send:email:'+email,6)
  const response=await fetch(base+'/auth/v1/otp',{method:'POST',headers,body:JSON.stringify({email,create_user:false})})
  if(!response.ok)throw new HttpError(response.status===429?429:503,response.status===429?'验证码发送过于频繁，请稍后重试。':'验证码暂时无法发送，请稍后重试。')
 }
 if(action==='request-code'){
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():''
  const invalidCredentials='邮箱或密码不正确。'
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof input.password!=='string'||!input.password||input.password.length>512)throw new HttpError(400,invalidCredentials)
  await rateLimit(env,request,'password:email:'+email,10)
  if(!allowed(email,env))throw new HttpError(400,invalidCredentials)
  const passwordResponse=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password:input.password})})
  if(passwordResponse.status===429)throw new HttpError(429,'尝试次数太多，请稍后再试。')
  if(passwordResponse.status>=500)throw new HttpError(503,'登录服务暂时无法连接，请稍后重试。')
  if(!passwordResponse.ok)throw new HttpError(400,invalidCredentials)
  const passwordSession=await passwordResponse.json() as {access_token:string;user?:{email?:string;email_confirmed_at?:string}}
  if(!passwordSession.access_token||passwordSession.user?.email?.toLowerCase()!==email||!passwordSession.user.email_confirmed_at)throw new HttpError(400,invalidCredentials)
  const revoke=await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{...headers,Authorization:'Bearer '+passwordSession.access_token}})
  if(!revoke.ok)throw new HttpError(503,'登录服务暂时无法连接，请稍后重试。')
  await sendCode(email)
  const id=crypto.randomUUID(),created=nowSeconds()
  await env.DB.batch([
   env.DB.prepare('DELETE FROM admin_login_challenges WHERE expires_at<=? OR id=?').bind(created,challengeId),
   env.DB.prepare('INSERT INTO admin_login_challenges(id,email,expires_at) VALUES(?,?,?)').bind(id,email,created+loginChallengeAge),
  ])
  return json({ok:true},200,{'Set-Cookie':loginChallengeHeader(id)})
 }
 const challenge=challengeId?await env.DB.prepare('SELECT email FROM admin_login_challenges WHERE id=? AND expires_at>?').bind(challengeId,nowSeconds()).first<{email:string}>():null
 if(!challenge||!allowed(challenge.email,env))throw new HttpError(401,'登录验证已过期，请重新输入邮箱和密码。')
 const {email}=challenge
 if(action==='resend-code'){await sendCode(email);return json({ok:true})}
 if(typeof input.code!=='string'||!/^[0-9]{6}$/.test(input.code))throw new HttpError(400,'验证码不正确或已过期，请重新获取。')
 await rateLimit(env,request,'verify:email:'+email,12)
 const r=await fetch(base+'/auth/v1/verify',{method:'POST',headers,body:JSON.stringify({email,token:input.code,type:'email'})})
 if(!r.ok)throw new HttpError(400,'验证码不正确或已过期，请重新获取。')
 const data=await r.json() as {access_token:string;refresh_token:string;expires_in:number;user:{email:string;email_confirmed_at:string}}
 if(!data.user?.email_confirmed_at||!allowed(data.user.email,env))throw new HttpError(403,'此邮箱没有后台管理权限。')
 if(data.user.email.toLowerCase()!==email)throw new HttpError(403,'此邮箱没有后台管理权限。')
 const consumed=await env.DB.prepare('DELETE FROM admin_login_challenges WHERE id=? AND expires_at>? RETURNING id').bind(challengeId,nowSeconds()).first()
 if(!consumed)throw new HttpError(401,'登录验证已过期，请重新输入邮箱和密码。')
 const id=crypto.randomUUID(),now=nowSeconds()
 await env.DB.batch([
  env.DB.prepare('DELETE FROM admin_idle_sessions WHERE last_activity<=? OR id=?').bind(now-idleTimeout,cookie(request,idleCookie)),
  env.DB.prepare('INSERT INTO admin_idle_sessions(id,email,last_activity) VALUES(?,?,?)').bind(id,email,now),
 ])
 const cookies=sessionCookies(data.access_token,data.refresh_token,data.expires_in,id)
 cookies.append('Set-Cookie',loginChallengeHeader(''))
 return json({email:data.user.email},200,cookies)
}
