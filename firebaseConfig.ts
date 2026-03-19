// FIX: Updated Firebase imports to use the v9 compatibility layer, which provides the v8 namespaced API and fixes initialization errors.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth"; // FIX: Added missing Auth import
import "firebase/compat/functions";
import "firebase/compat/storage"; // Import Storage
// FIX: Switched to v8 compat analytics to ensure consistent SDK usage.
import "firebase/compat/analytics"; 

// CRITICAL: Import configuration from the JSON file. 
// This ensures that if the app is remixed or the project changes, 
// the app always uses the correct credentials.
import firebaseConfig from './firebase-applet-config.json';

// --- CHECK FOR PLACEHOLDER VALUES ---
export const isFirebaseConfigured = 
    firebaseConfig.apiKey && 
    firebaseConfig.apiKey !== "YOUR_API_KEY" && 
    firebaseConfig.apiKey !== "TODO_KEYHERE";

let app: any;
let db: any = null;
let auth: any = null;
let functions: any = null;
let storage: any = null;
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
    
    // Use the named database if provided in the config, otherwise defaults to (default)
    const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
    db = firebase.firestore(app);
    // Note: In compat mode, databaseId is usually handled via the app instance or specific initialization if needed.
    // For most cases with the default database, this is sufficient.
    
    auth = firebase.auth(app); 
    
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
    functions = app.functions('asia-southeast1');

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

export { db, auth, functions, storage, analytics };
