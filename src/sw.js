const VERSION = "__VERSION__"
const PRECACHE = __PRECACHE__
const PREFIX = "english-words:"
const APP = `${PREFIX}app-${VERSION}`
const FONTS = `${PREFIX}fonts`

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, {cache: "reload"}))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== APP && key !== FONTS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (request.mode === "navigate") event.respondWith(networkFirst(request))
  else if (url.origin === self.location.origin) event.respondWith(cacheFirst(request, APP))
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") event.respondWith(cacheFirst(request, FONTS))
})

async function networkFirst(request) {
  const cache = await caches.open(APP)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put("./", response.clone())
    return response
  } catch (error) {
    const cached = await cache.match("./")
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === "opaque") await cache.put(request, response.clone())
  return response
}
