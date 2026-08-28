// ---------------------------------------------------------------------------
// Fill this in with YOUR Firebase project's config (Project settings > your
// web app > SDK setup and configuration). See README.md for step-by-step
// instructions on creating a free Firebase project.
// ---------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
// Keep the teacher signed in across app restarts, offline included.
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Firestore's offline persistence is what makes this app "offline-first":
// reads/writes hit a local cache immediately and sync in the background
// whenever a connection is available.
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({})
  })
});
