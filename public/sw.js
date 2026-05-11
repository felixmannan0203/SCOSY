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
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
    '/api/auth/login',
    '/api/complaints/my',
    '/api/admin/stats'
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
    const url = new URL(request.url);
    
    // Handle different types of requests
    if (request.method === 'GET') {
        if (isStaticFile(url.pathname)) {
            // Static files - cache first strategy
            event.respondWith(handleStaticFile(request));
        } else if (isAPIRequest(url.pathname)) {
            // API requests - network first with cache fallback
            event.respondWith(handleAPIRequest(request));
        } else {
            // Other requests - network first
            event.respondWith(handleNetworkFirst(request));
        }
    } else if (request.method === 'POST' && isAPIRequest(url.pathname)) {
        // Handle POST requests for offline queue
        event.respondWith(handlePostRequest(request));
    }
});

// Check if request is for static file
function isStaticFile(pathname) {
    return pathname.endsWith('.css') || 
           pathname.endsWith('.js') || 
           pathname.endsWith('.html') || 
           pathname.endsWith('.png') || 
           pathname.endsWith('.jpg') || 
           pathname.endsWith('.ico') ||
           pathname === '/';
}

// Check if request is for API
function isAPIRequest(pathname) {
    return pathname.startsWith('/api/');
}

// Handle static files with cache-first strategy
async function handleStaticFile(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Error handling static file:', error);
        
        // Return offline page for HTML requests
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }
        
        throw error;
    }
}

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful GET responses
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache for:', request.url);
        
        // Try to get from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline response for specific endpoints
        if (request.url.includes('/api/complaints/my')) {
            return new Response(JSON.stringify([]), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        throw error;
    }
}

// Handle network-first strategy for other requests
async function handleNetworkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

// Handle POST requests for offline functionality
async function handlePostRequest(request) {
    try {
        return await fetch(request);
    } catch (error) {
        // Store failed POST requests for later sync
        const requestData = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: await request.text(),
            timestamp: Date.now()
        };
        
        await storeOfflineRequest(requestData);
        
        // Return a response indicating the request was queued
        return new Response(JSON.stringify({
            success: false,
            queued: true,
            message: 'Request queued for when online'
        }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Store offline requests in IndexedDB
async function storeOfflineRequest(requestData) {
    try {
        const db = await openOfflineDB();
        const transaction = db.transaction(['requests'], 'readwrite');
        const store = transaction.objectStore('requests');
        await store.add(requestData);
        console.log('📦 Stored offline request:', requestData.url);
    } catch (error) {
        console.error('Failed to store offline request:', error);
    }
}

// Open IndexedDB for offline storage
function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ScosyOfflineDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('requests')) {
                const store = db.createObjectStore('requests', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                store.createIndex('timestamp', 'timestamp');
            }
        };
    });
}

// Background sync event
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-offline-requests') {
        event.waitUntil(syncOfflineRequests());
    }
});

// Sync offline requests when back online
async function syncOfflineRequests() {
    try {
        const db = await openOfflineDB();
        const transaction = db.transaction(['requests'], 'readonly');
        const store = transaction.objectStore('requests');
        const requests = await store.getAll();
        
        console.log(`🔄 Syncing ${requests.length} offline requests`);
        
        for (const requestData of requests) {
            try {
                const response = await fetch(requestData.url, {
                    method: requestData.method,
                    headers: requestData.headers,
                    body: requestData.body
                });
                
                if (response.ok) {
                    // Remove successfully synced request
                    const deleteTransaction = db.transaction(['requests'], 'readwrite');
                    const deleteStore = deleteTransaction.objectStore('requests');
                    await deleteStore.delete(requestData.id);
                    
                    console.log('✅ Synced offline request:', requestData.url);
                }
            } catch (error) {
                console.error('Failed to sync request:', requestData.url, error);
            }
        }
    } catch (error) {
        console.error('Failed to sync offline requests:', error);
    }
}

// Push notification event
self.addEventListener('push', (event) => {
    console.log('📬 Push notification received');
    
    let notificationData = {
        title: 'SCOSY Notification',
        body: 'You have a new update',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'scosy-notification',
        requireInteraction: false
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = { ...notificationData, ...data };
        } catch (error) {
            console.error('Failed to parse push data:', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked');
    
    event.notification.close();
    
    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Otherwise, open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Message event for communication with main thread
self.addEventListener('message', (event) => {
    console.log('📨 Message received in SW:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;
                
            case 'GET_VERSION':
                event.ports[0].postMessage({ version: CACHE_NAME });
                break;
                
            case 'CLEAR_CACHE':
                clearAllCaches().then(() => {
                    event.ports[0].postMessage({ success: true });
                });
                break;
                
            case 'SYNC_OFFLINE_REQUESTS':
                syncOfflineRequests().then(() => {
                    event.ports[0].postMessage({ success: true });
                });
                break;
        }
    }
});

// Clear all caches
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('🗑️ All caches cleared');
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    console.log('⏰ Periodic sync triggered:', event.tag);
    
    if (event.tag === 'sync-complaints') {
        event.waitUntil(syncOfflineRequests());
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('❌ Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection in SW:', event.reason);
});

console.log('🚀 Service Worker loaded successfully');