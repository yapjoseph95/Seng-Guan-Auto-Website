import {useState,type FormEvent} from 'react'
import {useLocale,LanguageSelect} from './locale'
import './AdminLogin.css'

export default function AdminResetPassword({token,invitation}:{token:string|null;invitation:boolean}){
 const {t}=useLocale()
 const [password,setPassword]=useState('')
 const [confirmation,setConfirmation]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [finished,setFinished]=useState(false)
 const [expired,setExpired]=useState(!token)
 const submit=async(event:FormEvent)=>{
  event.preventDefault()
  if(!token||busy)return
  if(password!==confirmation){setError('The passwords do not match.');return}
  setBusy(true)
  setError('')
  try{
   const response=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({password})})
   if(response.status===401){setExpired(true);return}
   if(!response.ok){
    const data=await response.json().catch(()=>null)
    throw new Error(data?.error||'Password reset is temporarily unavailable. Try again.')
   }
   setPassword('')
   setConfirmation('')
   setFinished(true)
  }catch(error){setError((error as Error).message)}
  finally{setBusy(false)}
 }
 return <main className="admin-login admin-login--reset">
  <LanguageSelect />
  <section className="login-panel" aria-labelledby="reset-password-title"><div className="login-card">
   <h2 id="reset-password-title">{t(invitation?'Set your administrator password':'Reset administrator password')}</h2>
   {finished?<p role="status">{t(invitation?'Password set. Sign in with your password and email code.':'Password updated. Sign in with your new password and email code.')}</p>
    :expired?<p role="alert">{t(invitation?'This invitation has expired. Ask the administrator for a new link.':'This link has expired. Ask the administrator for a new one.')}</p>
    :<form onSubmit={submit}>
      <label>{t('New password')}<div className="login-input"><input type="password" autoComplete="new-password" required minLength={8} maxLength={512} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></div></label>
      <label>{t('Confirm new password')}<div className="login-input"><input type="password" autoComplete="new-password" required minLength={8} maxLength={512} value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></div></label>
      {error&&<p className="login-error" role="alert">{t(error)}</p>}
      <button className="login-submit" disabled={busy}>{t('Save new password')}</button>
     </form>}
    {(finished||expired)&&<a href="/admin">{t('Back to administrator sign-in')}</a>}
  </div></section>
 </main>
}
