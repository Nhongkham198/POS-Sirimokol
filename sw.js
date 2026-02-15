// Firebase Messaging Service Worker (This part remains the same)
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAYSFtniKpkFJlxK61Wos_ntpLMMtKxq2s",
  authDomain: "pos-sirimonkol.firebaseapp.com",
  projectId: "pos-sirimonkol",
  storageBucket: "pos-sirimonkol.firebasestorage.app",
  messagingSenderId: "727960850637",
  appId: "1:727960850637:web:282e94bfac7d6befa9d984",
  measurementId: "G-8TM5HEKF7E"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[sw.js] Received background message ', payload);
  const notificationTitle = payload.data?.title || 'มีออเดอร์ใหม่!';
  const notificationOptions = {
    body: payload.data?.body || 'มีรายการอาหารใหม่ส่งเข้าครัว',
    icon: payload.data?.icon || '/icon.svg',
    // Sound Note: Background sound support varies by browser/OS. 
    // We try to use the sound from payload or fallback.
    sound: payload.data?.sound || '/default-notification.mp3',
    vibrate: payload.data?.vibrate ? JSON.parse(payload.data.vibrate) : [200, 100, 200],
    // Essential for "waking up" the user when screen is off/app hidden
    tag: 'restaurant-pos-notification', // Keeps notifications grouped but allows renotify
    renotify: true, // Forces sound/vibration even if a notification with same tag exists
    requireInteraction: true, // Keeps notification on screen until user interacts
    data: {
        url: payload.data?.url || '/' // Target URL to open on click
    },
    timestamp: Date.now() // Adds a timestamp to help OS prioritize
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle Notification Click - Focuses existing window or opens new one
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification click received.');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // Check if the client matches our scope and is focusable
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});


// --- ADVANCED CACHING SERVICE WORKER ---

// Define cache names for better management
const STATIC_CACHE_NAME = 'restaurant-pos-static-v6'; // For app shell files
const IMAGE_CACHE_NAME = 'restaurant-pos-images-v1';  // Dedicated cache for images

// List of core app files to cache on install
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  // Note: External resources from CDNs are cached via the fetch handler, not pre-cached here.
];

// --- INSTALL EVENT ---
// Pre-cache the essential app shell files.
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[SW] Failed to pre-cache app shell:', error);
      })
  );
});

// --- ACTIVATE EVENT ---
// Clean up old caches to save space and ensure new versions are used.
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  const cacheWhitelist = [STATIC_CACHE_NAME, IMAGE_CACHE_NAME]; // Keep both current caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// --- FETCH EVENT ---
// This is the core logic that intercepts network requests.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignore non-GET requests and Firestore calls
  if (event.request.method !== 'GET' || url.hostname.includes('firestore.googleapis.com')) {
    return; // Let the browser handle it
  }

  // --- Image & Media Caching Strategy: Cache First, then Network Fallback ---
  // This strategy makes images/audio load instantly after the first time.
  const isMediaRequest = /\.(jpg|jpeg|png|gif|svg|webp|mp3|wav)$/i.test(url.pathname) || url.hostname.includes('firebasestorage.googleapis.com');

  if (isMediaRequest) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        // IMPORTANT: Ignore search parameters (like ?retry=1) when looking in cache.
        const cacheKey = event.request.url.split('?')[0];
        const cachedResponse = await cache.match(cacheKey);
        
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, fetch from network
        try {
          const fetchResponse = await fetch(event.request);
          // Check for a valid response
          if (fetchResponse.ok) {
            // Put a copy in the image cache for next time, using the URL without query params as the key.
            cache.put(cacheKey, fetchResponse.clone());
          }
          return fetchResponse;
        } catch (error) {
          console.error(`[SW] Failed to fetch media: ${event.request.url}`, error);
          // Optional: return a placeholder image on failure
          // return caches.match('/placeholder-image.svg');
        }
      })
    );
    return; // End execution for media requests
  }

  // --- App Shell & Other Requests Strategy: Stale-While-Revalidate ---
  // This strategy provides a fast "offline-first" experience for the app itself.
  event.respondWith(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      // Fetch in the background to get the latest version for the next visit.
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(error => {
        console.error(`[SW] Fetch failed for ${event.request.url}`, error);
        // Do not return anything here, rely on cached response if it exists.
      });

      // Return cached response immediately if available, otherwise wait for the network.
      return cachedResponse || fetchPromise;
    })
  );
});

// --- MESSAGE EVENT for Proactive Caching ---
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_IMAGES') {
    const urlsToCache = event.data.urls;
    console.log('[SW] Proactively caching images:', urlsToCache.length);

    event.waitUntil(
      caches.open(IMAGE_CACHE_NAME).then(cache => {
        const promises = urlsToCache.map(url => {
          // Create a new request to handle potential CORS issues for external images
          const request = new Request(url, { mode: 'no-cors' });
          const cacheKey = url.split('?')[0];
          
          return cache.match(cacheKey).then(cachedResponse => {
            if (!cachedResponse) { // Only fetch and cache if it's not already there
              return cache.add(request).catch(err => {
                console.warn(`[SW] Failed to proactively cache image: ${url}`, err);
              });
            }
          });
        });
        
        // After all cache attempts are done, notify the client.
        return Promise.all(promises).then(() => {
            console.log('[SW] Image caching process complete.');
            return self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'CACHE_IMAGES_COMPLETE' });
                });
            });
        });
      })
    );
  }
});