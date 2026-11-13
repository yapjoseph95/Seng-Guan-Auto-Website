// This Worker is called only through the Pages service binding; it has no public route.
export default {
 async fetch(request, env) {
  if (request.method !== 'POST' || !request.body) return new Response('Invalid request', {status:400})
  try {
   const result = await env.IMAGES.input(request.body)
    .transform({width:1200,height:1200,fit:'scale-down'})
    .output({format:'image/jpeg',quality:80})
   return result.response()
  } catch (error) {
   console.error('Photo resizing failed',String(error))
   return new Response('Photo temporarily unavailable', {status:503})
  }
 }
}
