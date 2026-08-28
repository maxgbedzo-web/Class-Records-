# Learner Records

An offline-first Progressive Web App for teachers to keep learner records for
the academic year: grades, behavior/incident notes, and guardian contact
info, organized by class.

- Works fully offline — data is saved locally instantly and syncs to the
  cloud automatically when a connection is available.
- Installs on Android (and iOS/desktop) straight from the browser, no app
  store needed.
- No backend server to run — it's static files (HTML/CSS/JS) hosted on
  GitHub Pages, backed by a free Firebase project for auth + sync/backup.

## How it's built

| Piece | Choice | Why |
|---|---|---|
| UI | Vanilla HTML/CSS/JS, no build step | Deploys straight to GitHub Pages, nothing to compile |
| Offline data + sync | Firebase Firestore (offline persistence) | Firestore queues writes locally and syncs in the background — no custom sync engine to write |
| Auth | Firebase Authentication (email/password) | Keeps each teacher's data private |
| Installable app | Web App Manifest + Service Worker | Standard PWA install on Android |

Data is structured as `users/{teacherId}/classes/{classId}/learners/{learnerId}/grades|behavior`,
so each teacher's records are naturally scoped to their own account.

---

## 1. Create your Firebase project (free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Any name works, e.g. "learner-records".
2. Once created, click the **web icon (`</>`)** on the project overview page to register a web app. Give it any nickname. You don't need Firebase Hosting.
3. Firebase will show you a `firebaseConfig` object. Copy it — you'll need it in step 3.
4. In the left sidebar, go to **Build → Authentication → Get started**, and enable the **Email/Password** sign-in method.
5. Go to **Build → Firestore Database → Create database**. Start in **production mode**. Pick any region close to you.
6. Once the database is created, open the **Rules** tab and replace the contents with what's in `firestore.rules` in this repo, then click **Publish**. This ensures a teacher can only ever read or write their own data.

## 2. Add your config to the app

Open `js/firebase-config.js` and replace the placeholder values with the
`firebaseConfig` object Firebase gave you in step 1.3:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

This file has no secrets that need hiding — Firebase web config is safe to
be public; your Firestore **rules** are what actually protect the data.

## 3. Run it locally

Because the app uses ES modules and a service worker, you need to serve it
over `http://`, not open `index.html` directly as a file. From the project
folder:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080` in Chrome. Sign up with an email and
password to create your first teacher account, then add a class.

## 4. Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick your
   default branch (e.g. `main`) and the `/ (root)` folder, then **Save**.
4. GitHub will give you a URL like `https://yourname.github.io/your-repo/`
   within a minute or two.

Every time you push changes, bump `CACHE_NAME` in `service-worker.js` (e.g.
`learner-records-v2`) so installed devices pick up the update instead of
serving a stale cached version.

## 5. Install it on Android

1. Open your GitHub Pages URL in **Chrome** on an Android device.
2. Tap the **⋮** menu → **Add to Home screen** (or you'll see an **Install**
   prompt/banner automatically).
3. The app opens full-screen from the home screen icon, just like a native
   app, and keeps working offline.

---

## Notes & limits

- **Offline persistence** is configured single-tab (`persistentSingleTabManager`).
  If a teacher opens the app in two browser tabs at once, only the first tab
  will have offline access — this is a deliberate simplicity trade-off. If
  multi-tab support matters for your use case, swap it for
  `persistentMultipleTabManager()` in `js/firebase-config.js`.
- **Cascading deletes** (deleting a class or learner also deletes its
  nested grades/behavior notes) are done client-side in `js/db.js`. Fine for
  typical class sizes; if you ever manage very large rosters, consider a
  Cloud Function instead.
- **Password reset** is wired up in `js/auth.js` (`resetPassword`) but not
  yet hooked into the UI — add a "Forgot password?" link on the sign-in
  screen calling it if you want that flow.
- This is a single-teacher-per-account model. Sharing a class roster between
  co-teachers would need a data model change (e.g. a `sharedWith` field and
  updated security rules).

## Project structure

```
index.html            App shell
manifest.json         PWA manifest (name, icons, colors)
service-worker.js      Offline caching of the app shell
css/styles.css         All styles
js/firebase-config.js  Your Firebase project config + SDK init
js/auth.js              Sign up / sign in / sign out
js/db.js                Firestore reads/writes (classes, learners, grades, behavior)
js/router.js            Tiny hash-based router
js/utils.js             Formatting helpers, color palette
js/app.js               Screens, rendering, and event wiring
icons/                  App icons
firestore.rules         Security rules to paste into the Firebase console
```
