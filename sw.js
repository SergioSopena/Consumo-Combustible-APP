// Service worker: la app funciona sin conexión y, con conexión, siempre carga la última versión.
const V='consumo-v2',A=['./','index.html','calc.js','sync.js','app.js','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url),mine=u.origin==location.origin,cdn=u.hostname=='cdn.jsdelivr.net';
 // Solo GET de la propia app y de la librería. Las llamadas a Supabase van directas a la red.
 if(r.method!='GET'||(!mine&&!cdn))return;
 e.respondWith((async()=>{
  const c=await caches.open(V);
  try{
   const res=await fetch(mine?r.url:r,mine?{cache:'no-cache'}:undefined); // red primero (actualizaciones inmediatas)
   if(res.ok)c.put(r,res.clone());
   return res;
  }catch(err){
   const hit=await c.match(r,{ignoreSearch:true})||await c.match('index.html');
   if(hit)return hit;
   throw err;
  }
 })());
});
