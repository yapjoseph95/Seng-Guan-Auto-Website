import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

type Page<T> = { vehicles:T[]; hasMore:boolean; counts?:Record<string,number>; facets?:{make:string;year:number;body:string}[] }

/** The server applies filtering and sorting before slicing, so later matches are never hidden. */
export function useVehiclePages<T extends {id:string|number}>(key:string, fetchPage:(query:string,signal:AbortSignal)=>Promise<Page<T>>,enabled=true, pageSize=6, canLoadMore: (items:T[])=>boolean=()=>true) {
 const [items,setItems]=useState<T[]>([])
 const [loading,setLoading]=useState(true)
 const [hasMore,setHasMore]=useState(false)
 const [error,setError]=useState('')
 const [counts,setCounts]=useState<Record<string,number>>({})
 const [facets,setFacets]=useState<{make:string;year:number;body:string}[]>([])
 const [revision,setRevision]=useState(0)
 const [activated,setActivated]=useState(false)
 const [nearEnd,setNearEnd]=useState(false)
 const sentinel=useRef<HTMLDivElement>(null)
 const generation=useRef(0)
 const activeController=useRef<AbortController|null>(null)
 const inFlight=useRef(false)
 const offset=useRef(0)
 const more=useRef(false)
 const fetchRef=useRef(fetchPage)
 fetchRef.current=fetchPage
 const load=useCallback(async (initial:boolean, signal:AbortSignal, version:number) => {
  if(inFlight.current || signal.aborted)return
  inFlight.current=true
  setLoading(true);setError('')
  try {
   const params=new URLSearchParams(key)
   params.set('limit',String(pageSize));params.set('offset',String(initial?0:offset.current))
   const page=await fetchRef.current(params.toString(),signal)
   if(signal.aborted || generation.current!==version)return
   offset.current=(initial?0:offset.current)+page.vehicles.length
   more.current=page.hasMore
   setHasMore(page.hasMore)
   setItems(previous=>initial?page.vehicles:[...previous,...page.vehicles.filter(item=>!previous.some(old=>old.id===item.id))])
   if(page.counts)setCounts(page.counts)
   if(page.facets)setFacets(page.facets)
  } catch(e) {
   if(!signal.aborted && generation.current===version)setError(e instanceof Error?e.message:'Unable to load vehicles.')
  } finally {
   if(generation.current===version){inFlight.current=false;setLoading(false)}
  }
 },[key,pageSize])
 useEffect(()=>{
  if(!enabled){setLoading(false);return}
  const controller=new AbortController(), version=++generation.current
  activeController.current=controller
  inFlight.current=false;offset.current=0;more.current=false
  setItems([]);setHasMore(false);setLoading(true)
  void load(true,controller.signal,version)
  return()=>controller.abort()
 },[load,revision,enabled])
 useEffect(()=>{
  setActivated(false)
  const activate=()=>setActivated(true)
  window.addEventListener('scroll',activate,{passive:true,once:true})
  return()=>window.removeEventListener('scroll',activate)
 },[key,revision])
 const ready=canLoadMore(items)
 useEffect(()=>{
  const node=sentinel.current
  if(!node || !activated || !hasMore || error)return
  const observer=new IntersectionObserver(entries=>setNearEnd(Boolean(entries[0]?.isIntersecting)),{rootMargin:`${window.innerHeight}px 0px`})
  observer.observe(node)
  return()=>{observer.disconnect();setNearEnd(false)}
 },[activated,hasMore,error,revision])
 useEffect(()=>{
  if(!nearEnd || !ready || loading || !hasMore || error)return
  const controller=activeController.current
  if(controller && more.current)void load(false,controller.signal,generation.current)
 },[nearEnd,ready,loading,hasMore,error,load])
 const waiting=activated && nearEnd && hasMore && !ready && !error

 return {items,setItems:setItems as Dispatch<SetStateAction<T[]>>,loading,waiting,hasMore,error,counts,setCounts,facets,sentinel,reload:()=>setRevision(value=>value+1)}
}
