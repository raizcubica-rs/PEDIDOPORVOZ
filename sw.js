// Service worker: guarda la app y sus librerías para que abra sin internet.
const CACHE="pedido-por-voz-v5-2026-11-26";
const CORE=["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","logo-proforma.png",
 "vendor/jspdf.umd.min.js","vendor/xlsx.full.min.js","vendor/pdf.min.js","vendor/pdf.worker.min.js"];
const LAZY=[];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(async c=>{await c.addAll(CORE);
  await Promise.all(LAZY.map(u=>c.add(u).catch(()=>{})))}).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  // La página: primero la red (para recibir actualizaciones), si no hay internet, la copia guardada.
  if(req.mode==="navigate"){e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put("index.html",cp));return r}).catch(()=>caches.match("index.html")));return}
  // Librerías, fuentes e iconos: la copia guardada, y si no existe, la red y se guarda.
  if(url.origin===location.origin||/fonts\.(googleapis|gstatic)\.com/.test(url.host)){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==="opaque"){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r})))}
});
