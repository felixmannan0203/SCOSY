// ==================== SERVICE WORKER FOR PWA ==================== 

const CACHE_NAME = 'scosy-v1.0.0';
const STATIC_CACHE = 'scosy-static-v1.0.0';
const DYNAMIC_CACHE = 'scosy-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/responsive.js',
    '/sync-manager.js',
    '/manifest.json'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('✅ Static files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Failed to cache static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('🗑️ Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // Only handle GET requests for now
    if (request.method === 'GET') {
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    // Return cached version or fetch from network
                    return response || fetch(request);
                })
                .catch(() => {
                    // Return offline page for HTML requests
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                })
        );
    }
});

console.log('🚀 Service Worker loaded successfully');