/* LIFE offline app shell. Only caches same-origin static files.
   No background sync, analytics, APIs, or remote model requests. */
const VERSION="life-offline-v1";
const FILES=["./","./index.html","./style.css","./life.js","./journal.js","./story.js",
 "./scene.js","./app.js","./art/manifest.js","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES.map(f=>new URL(f,self.registration.scope)))));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("life-offline-")&&k!==VERSION).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin)return;
 event.respondWith(
  fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy)).catch(()=>{});}
   return response;
  }).catch(async()=>{
   const cached=await caches.match(request);
   if(cached)return cached;
   if(request.mode==="navigate"){
    const index=await caches.match(new URL("./index.html",self.registration.scope));
    if(index)return index;
   }
   return Response.error();
  })
 );
});
