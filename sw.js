// sw.js - Service Worker

const CACHE_NAME = 'lofi-drive-cache-v1';
const ASSETS_TO_CACHE = [
    './', // Alias for index.html
    './index.html',
    './main.js',
    'https://unpkg.com/three@0.158.0/build/three.module.js', // Three.js library
    'https://unpkg.com/three@0.158.0/examples/jsm/loaders/GLTFLoader.js', // If using GLTFLoader from CDN

    // Placeholder for actual 3D model assets if/when they are added and loaded from files
    // './assets/car.glb',
    // './assets/road_segment.glb',

    // Placeholder for actual skybox image assets (assuming they are in ./assets/skybox/)
    // These should be uncommented and verified when enableSkyboxLoading = true in main.js
    './assets/skybox/px.jpg',
    './assets/skybox/nx.jpg',
    './assets/skybox/py.jpg',
    './assets/skybox/ny.jpg',
    './assets/skybox/pz.jpg', // Corrected: removed dot from assets.skybox
    './assets/skybox/nz.jpg',

    // Add any other crucial assets like CSS files, fonts, or icons here
    // e.g., './style.css', './assets/icon.png'
];

// Install event: Cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Opened cache:', CACHE_NAME);
                // Add all assets to cache. If any fail, the SW install fails.
                // Using addAll which fetches and caches.
                // For external URLs (like unpkg), ensure CORS is enabled on their responses.
                // unpkg typically has CORS enabled.
                return cache.addAll(ASSETS_TO_CACHE.map(url => new Request(url, { mode: 'cors' })))
                    .catch(error => {
                        console.error('[Service Worker] Failed to cache one or more assets during install:', error);
                        // It's important to understand why caching might fail here.
                        // Common reasons: typos in URLs, network errors, or files not found.
                        // If a critical asset fails to cache, the SW might not install correctly.
                    });
            })
            .then(() => {
                console.log('[Service Worker] All specified assets cached successfully.');
                return self.skipWaiting(); // Activate the new service worker immediately
            })
            .catch(error => {
                console.error('[Service Worker] Caching failed during install phase:', error);
            })
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activated and old caches cleaned.');
            return self.clients.claim(); // Take control of all open clients
        })
    );
});

// Fetch event: Serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', (event) => {
    // We only want to cache GET requests for http/https
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // console.log('[Service Worker] Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                // console.log('[Service Worker] Fetching from network:', event.request.url);
                return fetch(event.request).then((networkResponse) => {
                    // Check if we received a valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                        return networkResponse;
                    }

                    // IMPORTANT: Clone the response. A response is a stream
                    // and because we want the browser to consume the response
                    // as well as the cache consuming the response, we need
                    // to clone it so we have two streams.
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            // console.log('[Service Worker] Caching new resource:', event.request.url);
                            cache.put(event.request, responseToCache);
                        });

                    return networkResponse;
                }).catch(error => {
                    console.error('[Service Worker] Fetch failed; returning offline fallback or error for:', event.request.url, error);
                    // Optionally, return a custom offline fallback page or resource here
                    // For example, if it's an image request and it fails, return a placeholder image.
                    // if (event.request.destination === 'image') {
                    //    return caches.match('./assets/offline-placeholder.png');
                    // }
                });
            })
    );
});
