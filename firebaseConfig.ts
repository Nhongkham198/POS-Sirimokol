
// FIX: Updated Firebase imports to use the v9 compatibility layer, which provides the v8 namespaced API and fixes initialization errors.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/functions";
import "firebase/compat/storage"; // Import Storage
import { getAnalytics } from "firebase/analytics";

// Updated configuration for 'pos-sirimonkol'
const firebaseConfig = {
  apiKey: "AIzaSyAYSFtniKpkFJlxK61Wos_ntpLMMtKxq2s",
  authDomain: "pos-sirimonkol.firebaseapp.com",
  projectId: "pos-sirimonkol",
  storageBucket: "pos-sirimonkol.firebasestorage.app",
  messagingSenderId: "727960850637",
  appId: "1:727960850637:web:282e94bfac7d6befa9d984",
  measurementId: "G-8TM5HEKF7E"
};

// --- CHECK FOR PLACEHOLDER VALUES ---
export const isFirebaseConfigured = 
    firebaseConfig.apiKey !== "YOUR_API_KEY" && 
    firebaseConfig.messagingSenderId !== "YOUR_MESSAGING_SENDER_ID" && 
    firebaseConfig.appId !== "YOUR_APP_ID";

let app;
let db: any = null; // Initialize db as null
let functions: any = null; // Initialize functions as null
let storage: any = null; // Initialize storage as null
let analytics: any = null;

if (isFirebaseConfigured) {
  try {
    // FIX: Switched to v8 initialization syntax to resolve module loading error.
    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }
    
    // Initialize Analytics if supported
    if (typeof window !== 'undefined') {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn("Firebase Analytics failed to initialize", e);
      }
    }

    db = firebase.firestore();
    
    // Removed experimentalForceLongPolling to fix "Detected an update time that is in the future" errors
    // and clock skew issues. Defaulting to auto-detected transport (WebSockets/LongPolling).
    
    storage = firebase.storage(); // Initialize Storage
    
    // --- ENABLE OFFLINE PERSISTENCE ---
    // This allows the app to work offline by caching data locally.
    // It acts as a local buffer, satisfying the requirement to store data locally before sending to Firebase.
    db.enablePersistence({ synchronizeTabs: true })
      .catch((err: any) => {
          if (err.code == 'failed-precondition') {
              console.warn('Persistence failed: Multiple tabs open. (Only one tab can work offline at a time)');
          } else if (err.code == 'unimplemented') {
              console.warn('Persistence failed: Browser not supported.');
          }
      });

    functions = firebase.functions();
  } catch (e) {
    console.error("Error initializing Firebase. Please check your config.", e);
    // isFirebaseConfigured should remain true, but db will be null, and errors will be caught.
  }
}

export { db, functions, storage, analytics };
