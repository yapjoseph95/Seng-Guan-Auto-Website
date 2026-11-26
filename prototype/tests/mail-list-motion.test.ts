import {test} from 'node:test'
import assert from 'node:assert/strict'
import {animateMailRows,mailRowPositions} from '../src/mail-list-motion'

test('new mail moves existing rows first, then slides new rows in; reduced motion skips both',()=>{
 const calls:{id:string;frames:Keyframe[];options:KeyframeAnimationOptions}[]=[]
 const row=(id:string,top:number)=>({dataset:{mailId:id},getBoundingClientRect:()=>({top}),animate:(frames:Keyframe[],options:KeyframeAnimationOptions)=>{calls.push({id,frames,options});return {cancel(){}}}})
 const oldList={querySelectorAll:()=>[row('old',20),row('steady',400)]} as unknown as HTMLElement
 const previous=mailRowPositions(oldList)
 const updated={querySelectorAll:()=>[row('new-1',20),row('new-2',120),row('old',220),row('steady',400)]} as unknown as HTMLElement
 assert.equal(animateMailRows(updated,previous,false).length,3)
 assert.equal(calls.find(c=>c.id==='old')?.frames[0].transform,'translateY(-200px)')
 assert.equal(calls.find(c=>c.id==='old')?.options.duration,260)
 assert.equal(calls.find(c=>c.id==='new-1')?.options.delay,260)
 assert.equal(calls.find(c=>c.id==='new-2')?.options.delay,310)
 assert.equal(calls.find(c=>c.id==='new-1')?.options.fill,'backwards')
 calls.length=0;assert.deepEqual(animateMailRows(updated,previous,true),[]);assert.equal(calls.length,0)
 assert.equal(mailRowPositions(null).size,0)
})
