import {useEffect,useRef} from 'react'
import {adminTurnstileAction,adminTurnstileSiteKey} from '../shared/admin-turnstile'
import {useLocale} from './locale'

type TurnstileApi={
 render(container:HTMLElement,options:{
  sitekey:string;action:string;theme:'dark'| 'light';size:'flexible';
  callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void;
 }):string
 remove(widget:string):void
}
const widgetApi=()=>(window as Window & {turnstile?:TurnstileApi}).turnstile

export default function AdminTurnstile({onToken,onError}:{onToken:(token:string)=>void;onError:()=>void}){
 const {t}=useLocale()
 const container=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  let widget:string|undefined
  const render=()=>{
   if(!container.current||widget!==undefined)return
   widget=widgetApi()?.render(container.current,{
    sitekey:adminTurnstileSiteKey,action:adminTurnstileAction,theme:'dark',size:'flexible',
    callback:onToken,'expired-callback':()=>onToken(''),'error-callback':onError,
   })
  }
  if(widgetApi()){render();return()=>{if(widget!==undefined)widgetApi()?.remove(widget)}}
  let script=document.querySelector<HTMLScriptElement>('script[data-admin-turnstile]')
  if(!script){
   script=document.createElement('script')
   script.dataset.adminTurnstile='true'
   script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
   script.async=true
   document.head.appendChild(script)
  }
  script.addEventListener('load',render)
  script.addEventListener('error',onError)
  return()=>{
   script.removeEventListener('load',render)
   script.removeEventListener('error',onError)
   if(widget!==undefined)widgetApi()?.remove(widget)
  }
 },[onError,onToken])
 return <div className="login-turnstile" ref={container} aria-label={t('Human verification')}/>
}
