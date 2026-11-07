import { useLocale, LanguageSelect } from './locale'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, LoaderCircle, Mail, ShieldCheck } from 'lucide-react'
import logo from './assets/logo-dark.svg'
import Admin from './Admin'
import './AdminLogin.css'
async function auth(path:string,data?:unknown) {
 const r=await fetch('/api/auth/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)})
 let result
 try { result=await r.json() } catch { throw new Error('登录服务暂时无法连接。') }
 if(!r.ok)throw new Error(result.error||'登录失败，请稍后重试。')
 return result
}
export default function AdminLogin() {
  const { t } = useLocale()
 const [checking,setChecking]=useState(true)
 const [signedIn,setSignedIn]=useState(false)
 const [step,setStep]=useState<'email'|'code'>('email')
 const [email,setEmail]=useState('')
 const [code,setCode]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [cooldown,setCooldown]=useState(0)
 useEffect(()=>{
  let active=true
  const check=async()=>{try{await auth('session');if(active)setSignedIn(true)}catch{try{await auth('refresh',{});await auth('session');if(active)setSignedIn(true)}catch{/* Show the sign-in form. */}}finally{if(active)setChecking(false)}}
  void check()
  const expired=()=>{setSignedIn(false);setStep('email');setCode('');setError('登录已过期，请重新验证邮箱。')}
  window.addEventListener('admin-session-expired',expired)
  return()=>{active=false;window.removeEventListener('admin-session-expired',expired)}
 },[])
 useEffect(()=>{if(!cooldown)return;const timer=window.setTimeout(()=>setCooldown(s=>s-1),1000);return()=>window.clearTimeout(timer)},[cooldown])
 const send=async()=>{setBusy(true);setError('');try{await auth('request-code',{email:email.trim().toLowerCase()});setStep('code');setCode('');setCooldown(60)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const submit=async(e:FormEvent)=>{e.preventDefault();if(step==='email'){await send();return}setBusy(true);setError('');try{await auth('verify-code',{email:email.trim().toLowerCase(),code});setSignedIn(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(signedIn)return <Admin/>
 return <main className="admin-login">
  <LanguageSelect />
  <a href="/" className="login-back"><ArrowLeft size={16}/>{t("返回官网")}</a>
  <section className="login-brand"><img src={logo} alt="Seng Guan Auto Sdn. Bhd."/><p>{t("Your trusted partner in quality used cars since 1995.")}</p><div><span>{t("BUILT ON TRUST.")}</span><h1>{t("你的车行。")}<br/><em>{t("随时更新。")}</em></h1><p>{t("安全登录，管理车辆资料与照片，")}<br/>{t("让每一辆好车被看见。")}</p></div><small>{t("BANTING, SELANGOR · EST. 1995")}</small></section>
  <section className="login-panel" aria-labelledby="login-heading"><div className="login-card">
   <div className="login-security"><ShieldCheck size={18}/>{t("仅限授权管理员")}</div>
   <p className="login-eyebrow">{t("SENG GUAN AUTO / ADMIN")}</p>
   <h2 id="login-heading">{t(checking?'正在验证登录…':step==='email'?'欢迎回来。':'查收你的邮箱。')}</h2>
   <p className="login-intro">{checking?t('请稍候。'):step==='email'?t('使用已授权的邮箱，获取一次性登录验证码。无需记住密码。'):t('如果邮箱已获授权，验证码将发送至 {email}。请在下方输入邮件中的 6 位数字。',{email})}</p>
   {checking?<LoaderCircle className="login-spin" size={26}/>:<form onSubmit={submit}>
    {step==='email'?<label>{t("管理员邮箱")}<div className="login-input"><Mail size={18}/><input autoFocus autoComplete="email" type="email" required maxLength={254} placeholder="you@example.com" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></div></label>:<label>{t("邮箱验证码")}<input autoFocus className="login-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>}
    {error&&<p className="login-error" role="alert">{t(error)}</p>}
    <button className="login-submit" disabled={busy}>{busy?<LoaderCircle className="login-spin" size={18}/>:<>{t(step==='email'?'发送验证码':'验证并进入后台')}<ArrowRight size={18}/></>}</button>
    {step==='code'&&<div className="login-resend"><button type="button" disabled={busy||cooldown>0} onClick={()=>void send()}>{cooldown>0?t('{seconds} 秒后可重发',{seconds:cooldown}):t('重新发送验证码')}</button><button type="button" disabled={busy} onClick={()=>{setStep('email');setCode('');setError('')}}>{t("修改邮箱")}</button></div>}
   </form>}
   <p className="login-help">{t("验证码只用于本次登录。没有收到邮件？请检查垃圾邮件，或稍后重试。")}</p>
   <footer><ShieldCheck size={15}/>{t("你的管理会话受到安全保护")}</footer>
  </div></section>
 </main>
}
