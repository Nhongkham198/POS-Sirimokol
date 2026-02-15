// FIX: Updated Firebase imports to use the v9 compatibility layer, which provides the v8 namespaced API and fixes initialization errors.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/functions";
import "firebase/compat/storage"; // Import Storage
// FIX: Switched to v8 compat analytics to ensure consistent SDK usage.
import "firebase/compat/analytics"; 

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
    
    // ** DEFINITIVE FIX: Explicitly pass the initialized 'app' instance to ALL Firebase services **
    // This resolves any ambiguity or context conflicts, especially with non-default regions.
    
    db = firebase.firestore(app);
    
    // --- ENABLE OFFLINE PERSISTENCE ---
    db.enablePersistence({ synchronizeTabs: true })
      .catch((err: any) => {
          if (err.code == 'failed-precondition') {
              console.warn('Persistence failed: Multiple tabs open. (Only one tab can work offline at a time)');
          } else if (err.code == 'unimplemented') {
              console.warn('Persistence failed: Browser not supported.');
          }
      });
    
    // Explicitly initialize other services with the 'app' context.
    storage = firebase.storage(app); 
    
    // Also specify region for Functions to match Firestore Database location.
    functions = firebase.functions(app, 'asia-southeast1');

    // Initialize Analytics if supported, also with the explicit 'app' context.
    if (typeof window !== 'undefined') {
      try {
        analytics = firebase.analytics(app);
      } catch (e) {
        console.warn("Firebase Analytics failed to initialize", e);
      }
    }

  } catch (e) {
    console.error("Error initializing Firebase. Please check your config.", e);
  }
}

export { db, functions, storage, analytics };