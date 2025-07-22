// PrivyPilot Service Worker
// Provides offline functionality and background sync for the PWA

const CACHE_NAME = 'privypilot-v1.0.0';
const STATIC_CACHE = 'privypilot-static-v1.0.0';
const DYNAMIC_CACHE = 'privypilot-dynamic-v1.0.0';
const API_CACHE = 'privypilot-api-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/map.js',
  '/static/js/voice.js',
  '/static/js/camera.js',
  '/static/js/van-tracking.js',
  '/static/images/logo.svg',
  '/static/manifest.json',
  '/login',
  '/register',
  '/emergency',
  '/washrooms',
  '/map',
  
  // External CDN resources
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/van_location/',
  '/washrooms',
  '/reviews/'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {
          credentials: 'same-origin'
        })));
      }),
      
      // Cache API responses
      caches.open(API_CACHE).then(cache => {
        console.log('Service Worker: Preparing API cache');
        return cache;
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      return self.skipWaiting();
    }).catch(error => {
      console.error('Service Worker: Installation failed', error);
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old cache versions
          if (cacheName.startsWith('privypilot-') && 
              cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== API_CACHE) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - network first with cache fallback
    event.respondWith(handleAPIRequest(request));
  } else if (url.pathname.startsWith('/static/') || STATIC_ASSETS.some(asset => url.pathname === asset)) {
    // Static assets - cache first
    event.respondWith(handleStaticRequest(request));
  } else if (url.origin === location.origin) {
    // Application pages - network first with cache fallback
    event.respondWith(handlePageRequest(request));
  } else {
    // External resources - cache first with network fallback
    event.respondWith(handleExternalRequest(request));
  }
});

// Handle API requests - network first, cache fallback
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses for van tracking and washroom data
      if (url.pathname.includes('/van_location/') || url.pathname === '/washrooms') {
        const cache = await caches.open(API_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: Network failed for API request', request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('Service Worker: Serving cached API response', request.url);
    return cachedResponse;
  }
  
  // Return error response for critical API calls
  if (url.pathname.includes('/van_location/')) {
    return new Response(JSON.stringify({
      error: 'Connection unavailable',
      offline: true,
      eta_minutes: 'Unknown',
      status: 'connection_lost'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Service Unavailable', { status: 503 });
}

// Handle static asset requests - cache first
async function handleStaticRequest(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache the response
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: Network failed for static asset', request.url);
  }
  
  // Return fallback for critical assets
  if (request.url.includes('logo.svg')) {
    return caches.match('/static/images/logo.svg');
  }
  
  return new Response('Asset not available', { status: 404 });
}

// Handle page requests - network first with cache fallback
async function handlePageRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful page responses
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: Network failed for page', request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return offline page for main navigation
  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname === '/emergency' || url.pathname === '/washrooms') {
    return caches.match('/').then(response => {
      return response || createOfflinePage(url.pathname);
    });
  }
  
  return createOfflinePage(url.pathname);
}

// Handle external requests - cache first with network fallback
async function handleExternalRequest(request) {
  // Try cache first for external resources
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache external resources
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: External resource failed', request.url);
  }
  
  return new Response('Resource not available', { status: 404 });
}

// Create offline page
function createOfflinePage(pathname) {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - PrivyPilot</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8fafc; }
        .container { max-width: 500px; margin: 0 auto; }
        .logo { width: 80px; height: 80px; margin: 20px auto; }
        .btn { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; margin: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">📍</div>
        <h1>You're Offline</h1>
        <p>PrivyPilot is not available right now. Please check your internet connection.</p>
        <p>Don't worry - some features may still work offline!</p>
        <a href="/" class="btn">Try Again</a>
        <button onclick="location.reload()" class="btn">Refresh</button>
      </div>
      <script>
        // Auto-refresh when online
        window.addEventListener('online', () => location.reload());
      </script>
    </body>
    </html>
  `;
  
  return new Response(offlineHTML, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Background sync for emergency requests
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'emergency-request') {
    event.waitUntil(handleEmergencySync());
  } else if (event.tag === 'van-location-update') {
    event.waitUntil(handleVanLocationSync());
  }
});

// Handle emergency request sync
async function handleEmergencySync() {
  console.log('Service Worker: Syncing emergency requests');
  
  try {
    // Get pending emergency requests from IndexedDB
    const pendingRequests = await getPendingEmergencyRequests();
    
    for (const request of pendingRequests) {
      try {
        const response = await fetch('/emergency', {
          method: 'POST',
          body: request.data
        });
        
        if (response.ok) {
          // Remove from pending requests
          await removePendingEmergencyRequest(request.id);
          
          // Notify user of successful sync
          self.registration.showNotification('Emergency Request Sent', {
            body: 'Your emergency request has been processed.',
            icon: '/static/images/logo.svg',
            badge: '/static/images/logo.svg',
            tag: 'emergency-sync-success'
          });
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync emergency request', error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Emergency sync failed', error);
  }
}

// Handle van location sync
async function handleVanLocationSync() {
  console.log('Service Worker: Syncing van location updates');
  
  try {
    // Update van locations for active tracking
    const activeRequests = await getActiveTrackingRequests();
    
    for (const requestId of activeRequests) {
      try {
        const response = await fetch(`/api/van_location/${requestId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Update cache
          const cache = await caches.open(API_CACHE);
          cache.put(`/api/van_location/${requestId}`, response.clone());
          
          // Notify clients of update
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'van-location-update',
              requestId: requestId,
              data: data
            });
          });
        }
      } catch (error) {
        console.error('Service Worker: Van location sync failed for request', requestId, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Van location sync failed', error);
  }
}

// Push notification handling
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {
    title: 'PrivyPilot',
    body: 'You have a new notification',
    icon: '/static/images/logo.svg',
    badge: '/static/images/logo.svg'
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (error) {
      console.error('Service Worker: Failed to parse push data', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Check if there's already a window open
      for (const client of clients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_NEW_ROUTE':
      event.waitUntil(
        caches.open(DYNAMIC_CACHE).then(cache => {
          return cache.add(data.url);
        })
      );
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        })
      );
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'REGISTER_BACKGROUND_SYNC':
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        self.registration.sync.register(data.tag);
      }
      break;
  }
});

// Utility functions for IndexedDB operations
async function getPendingEmergencyRequests() {
  // Placeholder for IndexedDB implementation
  return [];
}

async function removePendingEmergencyRequest(id) {
  // Placeholder for IndexedDB implementation
  console.log('Removing pending emergency request:', id);
}

async function getActiveTrackingRequests() {
  // Placeholder for IndexedDB implementation
  return [];
}

// Periodic background sync registration
self.addEventListener('periodicsync', event => {
  if (event.tag === 'van-location-sync') {
    event.waitUntil(handleVanLocationSync());
  }
});

console.log('Service Worker: PrivyPilot SW loaded successfully');
