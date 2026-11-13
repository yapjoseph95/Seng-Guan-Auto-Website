// This Worker is called only through the Pages service binding; it has no public route.
export default {
 async fetch(request, env) {
  if (request.method !== 'POST' || !request.body) return new Response('Invalid request', {status:400})
  try {
   const preview = new URL(request.url).searchParams.get('preview') === '1'
   const result = await env.IMAGES.input(request.body)
    .transform({width:preview?48:1200,height:preview?48:1200,fit:'scale-down'})
    .output({format:'image/jpeg',quality:preview?40:80})
   return result.response()
  } catch (error) {
   console.error('Photo resizing failed',String(error))
   return new Response('Photo temporarily unavailable', {status:503})
  }
 }
}
