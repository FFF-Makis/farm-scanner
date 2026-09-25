// Farm Scanner service worker
// Caches the app shell so it opens instantly and works with a weak/no
// signal at the farm. jsQR is cached the first time it loads over a
// real connection, then reused offline from then on.
var CACHE_NAME = "farm-scanner-v7"; // bump this on every deploy to force old caches out
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];
var JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL).catch(function(){ /* tolerate individual failures */ });
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  var url = req.url;

  // jsQR: cache-first (it's a pinned version, safe to reuse indefinitely offline)
  if(url === JSQR_URL){
    event.respondWith(
      caches.match(req).then(function(cached){
        if(cached) return cached;
        return fetch(req).then(function(res){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // App shell (same-origin GET): network-first so updates are picked up
  // when online, falling back to cache when offline.
  if(req.method === "GET" && url.indexOf(self.location.origin) === 0){
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(cached){ return cached || caches.match("./index.html"); });
      })
    );
  }
});
