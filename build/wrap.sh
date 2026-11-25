#!/bin/zsh
# Wraps app.html into a standalone, installable, offline-capable docs/ folder.
cd "${0:A:h}/.."
{
cat <<'H'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Chasing Aurora">
<meta name="application-name" content="Chasing Aurora">
<meta name="theme-color" content="#060a16">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{padding-top:env(safe-area-inset-top,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
</head>
<body>
H
cat app.html
cat <<'H'
<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}</script>
</body>
</html>
H
} > docs/index.html
cat > docs/manifest.webmanifest <<'H'
{"id":"./","name":"Chasing Aurora","short_name":"Chasing Aurora","description":"Your 13-day Finland, Norway and Sweden aurora trip: live plan, flights, map and emergency numbers.","start_url":"./","scope":"./","display":"standalone","orientation":"portrait","background_color":"#060a16","theme_color":"#060a16","icons":[{"src":"icon-180.png","sizes":"180x180","type":"image/png"},{"src":"icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
H
cat > docs/sw.js <<'H'
const C='aurora-v4',T='aurora-tiles-v1';
const CORE=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!==T).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request,u=new URL(req.url);
  if(req.method!=='GET')return;
  // live data (weather, aurora) always goes to the network; the page keeps its own saved copy
  // map tiles: saved as you browse (capped), so viewed areas work offline
  if(/basemaps\.cartocdn\.com$|arcgisonline\.com$/.test(u.hostname)){
    e.respondWith(caches.open(T).then(c=>c.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==='opaque'){c.put(req,r.clone());c.keys().then(k=>{if(k.length>1500)k.slice(0,300).forEach(x=>c.delete(x))})}return r}))));
    return;
  }
  if(u.origin!==location.origin&&!/fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(u.hostname))return;
  if(req.mode==='navigate'){
    // fresh page when online (3 s limit), saved copy when not
    e.respondWith(caches.open(C).then(c=>{
      const net=fetch(req).then(r=>{if(r.ok)c.put('index.html',r.clone());return r});
      const slow=new Promise(res=>setTimeout(res,3000)).then(()=>c.match('index.html'));
      return Promise.race([net.catch(()=>c.match('index.html')),slow.then(r=>r||net)]);
    }));
    return;
  }
  e.respondWith(caches.open(C).then(c=>c.match(req,{ignoreSearch:true}).then(hit=>{
    const net=fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}).catch(()=>hit);
    return hit||net;
  })));
});
H
