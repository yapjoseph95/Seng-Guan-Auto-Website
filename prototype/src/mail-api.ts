export async function mailApi<T>(path:string,options:RequestInit={}):Promise<T>{
 const execute=()=>fetch('/api/admin/mail'+path,{...options,credentials:'same-origin',headers:{...typeof options.body==='string'?{'Content-Type':'application/json'}:{},...options.headers}})
 let r=await execute();if(r.status===401){const refresh=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(refresh.ok)r=await execute();else{window.dispatchEvent(new Event('admin-session-expired'));throw new Error('Please sign in again.')}}
 const data=await r.json().catch(()=>({error:'Unable to connect. Please try again.'}));if(!r.ok)throw new Error(data.error||'Unable to complete request.');return data
}
