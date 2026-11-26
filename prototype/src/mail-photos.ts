export async function compressMailPhoto(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return file
 if(file.size>50*1024*1024)throw new Error('Choose photos smaller than 50 MB before compression.')
 const bitmap=await createImageBitmap(file)
 try{
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
  const context=canvas.getContext('2d');if(!context)throw new Error('This browser cannot compress photos.')
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height)
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Photo compression failed.')),'image/jpeg',.85))
  return blob.size<file.size?new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified}):file
 }finally{bitmap.close()}
}
