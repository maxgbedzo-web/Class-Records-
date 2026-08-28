import { watchAuth, signIn, signUp, logOut, authErrorMessage } from "./auth.js";
import * as store from "./db.js";
import { navigate, onRouteChange, startRouter, currentRoute } from "./router.js";
import {
  colorForIndex, initials, fullName, escapeHtml, formatDate,
  todayInputValue, percentGrade, gradeStampClass, behaviorStampClass
} from "./utils.js";

const screenEl = document.getElementById("screen");
const sheetRoot = document.getElementById("sheetRoot");
const syncBanner = document.getElementById("syncBanner");
const syncBannerText = document.getElementById("syncBannerText");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  user: null,
  authMode: "signin", // "signin" | "signup"
  classes: [],
  learnersByClass: new Map(), // classId -> learners[]
  learner: null,
  grades: [],
  behaviorNotes: [],
  activeTab: "grades"
};

const unsub = { classes: null, learners: null, learner: null, grades: null, behavior: null };

function stopListener(key) {
  if (unsub[key]) { unsub[key](); unsub[key] = null; }
}

// ---------------------------------------------------------------------------
// Online / offline banner
// ---------------------------------------------------------------------------
function updateSyncBanner() {
  const offline = !navigator.onLine;
  syncBanner.classList.toggle("is-visible", offline);
  if (offline) syncBannerText.textContent = "Offline — changes are saved and will sync automatically";
}
window.addEventListener("online", updateSyncBanner);
window.addEventListener("offline", updateSyncBanner);

// ---------------------------------------------------------------------------
// Sheet (bottom modal) helpers
// ---------------------------------------------------------------------------
function openSheet(innerHtml) {
  sheetRoot.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet__handle"></div>
        ${innerHtml}
      </div>
    </div>`;
  sheetRoot.querySelector(".sheet").addEventListener("click", (e) => e.stopPropagation());
}
function closeSheet() { sheetRoot.innerHTML = ""; }

sheetRoot.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-sheet]")) closeSheet();
});

// ---------------------------------------------------------------------------
// Auth screen
// ---------------------------------------------------------------------------
function renderAuth() {
  const isSignUp = state.authMode === "signup";
  screenEl.innerHTML = `
    <div class="auth-screen">
      <div class="auth-screen__mark"></div>
      <h1>Learner Records</h1>
      <p class="auth-screen__tagline">Grades, behavior notes, and guardian contacts for your classes — works offline, syncs when you're back online.</p>
      <div id="authError"></div>
      <form id="authForm">
        ${isSignUp ? `
        <div class="field">
          <label for="authName">Your name</label>
          <input id="authName" type="text" autocomplete="name" required />
        </div>` : ""}
        <div class="field">
          <label for="authEmail">Email</label>
          <input id="authEmail" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="authPassword">Password</label>
          <input id="authPassword" type="password" autocomplete="${isSignUp ? "new-password" : "current-password"}" minlength="6" required />
        </div>
        <button type="submit" class="btn btn-primary btn-block">${isSignUp ? "Create account" : "Sign in"}</button>
      </form>
      <p class="auth-toggle">
        ${isSignUp ? "Already have an account?" : "New here?"}
        <button type="button" class="btn-text" id="authToggle">${isSignUp ? "Sign in" : "Create an account"}</button>
      </p>
    </div>`;

  document.getElementById("authToggle").addEventListener("click", () => {
    state.authMode = isSignUp ? "signin" : "signup";
    renderAuth();
  });

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("authError");
    errEl.innerHTML = "";
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      if (isSignUp) {
        const name = document.getElementById("authName").value.trim();
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      // onAuthStateChanged will pick this up and re-render.
    } catch (err) {
      errEl.innerHTML = `<div class="field-error">${escapeHtml(authErrorMessage(err))}</div>`;
      submitBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Topbar helper
// ---------------------------------------------------------------------------
function topbar({ title, back, action, icon }) {
  return `
    <div class="topbar">
      ${back ? `<button class="topbar__back" data-action="back" aria-label="Back">&larr;</button>` : ""}
      <div class="topbar__title">${escapeHtml(title)}</div>
      ${icon ? `<button class="topbar__icon-btn" data-action="${icon.action}" aria-label="${escapeHtml(icon.label)}">${icon.symbol}</button>` : ""}
      ${action ? `<button class="topbar__action" data-action="${action.action}">${escapeHtml(action.label)}</button>` : ""}
    </div>`;
}

// ---------------------------------------------------------------------------
// Classes screen
// ---------------------------------------------------------------------------
function renderClasses() {
  const rows = state.classes.map((c, i) => `
    <div class="class-card" data-action="open-class" data-id="${c.id}">
      <div class="class-card__swatch" style="background:${colorForIndex(c.colorIndex ?? i)}">${escapeHtml((c.name || "?")[0] || "?")}</div>
      <div class="class-card__body">
        <div class="class-card__name">${escapeHtml(c.name)}</div>
        <div class="class-card__meta">${escapeHtml([c.subject, c.year].filter(Boolean).join(" · ") || "No subject set")}</div>
      </div>
      <button class="topbar__icon-btn" data-action="class-menu" data-id="${c.id}" aria-label="Class options">&#8942;</button>
    </div>`).join("");

  screenEl.innerHTML = `
    ${topbar({
      title: "Classes",
      icon: { action: "account-menu", label: "Account", symbol: "&#9881;" },
      action: { action: "add-class", label: "+ Class" }
    })}
    <main>
      ${state.classes.length ? rows : `
        <div class="empty-state">
          <div class="empty-state__title">No classes yet</div>
          <div class="empty-state__body">Add your first class to start keeping records for this academic year.</div>
          <button class="btn btn-primary" data-action="add-class">Add a class</button>
        </div>`}
    </main>`;
}

function accountMenuSheet() {
  openSheet(`
    <div class="sheet__title">Account</div>
    <p class="field-hint" style="margin-bottom:16px;">Signed in as ${escapeHtml(state.user?.email || "")}</p>
    <button class="btn btn-danger btn-block" data-action="sign-out">Sign out</button>
  `);
}

function classFormSheet(existing) {
  const colors = [0, 1, 2, 3, 4, 5];
  const selected = existing ? (existing.colorIndex ?? 0) : 0;
  openSheet(`
    <div class="sheet__title">${existing ? "Edit class" : "Add a class"}</div>
    <form id="classForm">
      <div class="field">
        <label for="className">Class name</label>
        <input id="className" type="text" placeholder="e.g. Grade 6 Blue" value="${escapeHtml(existing?.name || "")}" required />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="classSubject">Subject</label>
          <input id="classSubject" type="text" placeholder="e.g. Mathematics" value="${escapeHtml(existing?.subject || "")}" />
        </div>
        <div class="field">
          <label for="classYear">Academic year</label>
          <input id="classYear" type="text" placeholder="e.g. 2026" value="${escapeHtml(existing?.year || new Date().getFullYear())}" />
        </div>
      </div>
      <div class="field">
        <label>Color</label>
        <div style="display:flex;gap:10px;">
          ${colors.map((i) => `
            <button type="button" class="color-swatch${i === selected ? " is-selected" : ""}" data-color="${i}"
              style="width:32px;height:32px;border-radius:50%;background:${colorForIndex(i)};border:3px solid ${i === selected ? "#1E2A24" : "transparent"};"></button>
          `).join("")}
        </div>
      </div>
      <div class="sheet__actions">
        <button type="button" class="btn btn-secondary" data-close-sheet>Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? "Save" : "Add class"}</button>
      </div>
    </form>`);

  let colorIndex = selected;
  sheetRoot.querySelectorAll(".color-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      colorIndex = Number(btn.dataset.color);
      sheetRoot.querySelectorAll(".color-swatch").forEach((b) => b.style.borderColor = "transparent");
      btn.style.borderColor = "#1E2A24";
    });
  });

  document.getElementById("classForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById("className").value.trim(),
      subject: document.getElementById("classSubject").value.trim(),
      year: document.getElementById("classYear").value.trim(),
      colorIndex
    };
    if (!data.name) return;
    if (existing) {
      await store.updateClass(state.user.uid, existing.id, data);
    } else {
      await store.addClass(state.user.uid, data);
    }
    closeSheet();
  });
}

function classActionSheet(cls) {
  openSheet(`
    <div class="sheet__title">${escapeHtml(cls.name)}</div>
    <button class="btn btn-secondary btn-block" style="margin-bottom:10px;" data-action="edit-class" data-id="${cls.id}">Edit class</button>
    <button class="btn btn-danger btn-block" data-action="delete-class" data-id="${cls.id}">Delete class</button>
  `);
}

// ---------------------------------------------------------------------------
// Class screen (learner roster)
// ---------------------------------------------------------------------------
function currentClass(classId) {
  return state.classes.find((c) => c.id === classId);
}

function renderClassScreen(classId) {
  const cls = currentClass(classId);
  const learners = state.learnersByClass.get(classId) || [];
  const color = cls ? colorForIndex(cls.colorIndex ?? 0) : "#2F5233";

  const rows = learners.map((l) => `
    <div class="learner-card" style="--class-color:${color}" data-action="open-learner" data-id="${l.id}" data-class="${classId}">
      <div class="learner-card__initials">${escapeHtml(initials(l.firstName, l.lastName))}</div>
      <div class="learner-card__body">
        <div class="learner-card__name">${escapeHtml(fullName(l))}</div>
        <div class="learner-card__meta">${escapeHtml(l.guardianName ? `Guardian: ${l.guardianName}` : "No guardian info yet")}</div>
      </div>
      <span class="class-card__chevron">&rsaquo;</span>
    </div>`).join("");

  screenEl.innerHTML = `
    ${topbar({
      title: cls ? cls.name : "Class",
      back: true,
      icon: { action: "class-menu", label: "Class options", symbol: "&#8942;" }
    })}
    <main>
      ${learners.length ? rows : `
        <div class="empty-state">
          <div class="empty-state__title">No learners yet</div>
          <div class="empty-state__body">Add learners to this class to start recording grades, behavior, and guardian contacts.</div>
          <button class="btn btn-primary" data-action="add-learner" data-class="${classId}">Add a learner</button>
        </div>`}
    </main>
    <button class="fab" data-action="add-learner" data-class="${classId}" aria-label="Add learner">+</button>`;
  screenEl.dataset.classId = classId;
}

function learnerFormSheet(classId) {
  openSheet(`
    <div class="sheet__title">Add a learner</div>
    <form id="learnerForm">
      <div class="field-row">
        <div class="field">
          <label for="lFirst">First name</label>
          <input id="lFirst" type="text" required />
        </div>
        <div class="field">
          <label for="lLast">Last name</label>
          <input id="lLast" type="text" required />
        </div>
      </div>
      <p class="field-hint">You can add guardian contact info from the learner's profile afterwards.</p>
      <div class="sheet__actions">
        <button type="button" class="btn btn-secondary" data-close-sheet>Cancel</button>
        <button type="submit" class="btn btn-primary">Add learner</button>
      </div>
    </form>`);

  document.getElementById("learnerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstName = document.getElementById("lFirst").value.trim();
    const lastName = document.getElementById("lLast").value.trim();
    if (!firstName || !lastName) return;
    await store.addLearner(state.user.uid, classId, { firstName, lastName });
    closeSheet();
  });
}

// ---------------------------------------------------------------------------
// Learner detail screen
// ---------------------------------------------------------------------------
function latestGradeStamp() {
  if (!state.grades.length) return `<span class="stamp stamp--muted stamp--lg">—</span>`;
  const g = state.grades[0];
  const pct = percentGrade(g.score, g.maxScore);
  return `<span class="stamp ${gradeStampClass(pct)} stamp--lg">${pct === null ? "—" : pct + "%"}</span>`;
}

function renderGradesTab(classId, learnerId) {
  if (!state.grades.length) {
    return `<div class="empty-state">
      <div class="empty-state__title">No grades yet</div>
      <div class="empty-state__body">Record an assessment score to start tracking this learner's progress.</div>
      <button class="btn btn-primary" data-action="add-grade">Add a grade</button>
    </div>`;
  }
  return state.grades.map((g) => {
    const pct = percentGrade(g.score, g.maxScore);
    return `
    <div class="record-row">
      <span class="stamp ${gradeStampClass(pct)} stamp--sm">${pct === null ? "—" : pct + "%"}</span>
      <div class="record-row__main">
        <div class="record-row__title">${escapeHtml(g.assessment || g.subject || "Assessment")}</div>
        <div class="record-row__sub">${escapeHtml([g.subject, g.term].filter(Boolean).join(" · "))} &middot; ${g.score}/${g.maxScore}</div>
      </div>
      <div class="record-row__date">${escapeHtml(formatDate(g.date))}</div>
      <button class="record-row__delete" data-action="delete-grade" data-id="${g.id}" aria-label="Delete grade">&times;</button>
    </div>`;
  }).join("");
}

function renderBehaviorTab() {
  if (!state.behaviorNotes.length) {
    return `<div class="empty-state">
      <div class="empty-state__title">No behavior notes yet</div>
      <div class="empty-state__body">Log an incident or a positive note to build a record over the year.</div>
      <button class="btn btn-primary" data-action="add-behavior">Add a note</button>
    </div>`;
  }
  const labels = { positive: "Positive", negative: "Incident", neutral: "Note" };
  return state.behaviorNotes.map((n) => `
    <div class="record-row">
      <span class="stamp ${behaviorStampClass(n.type)} stamp--sm">${labels[n.type] || "Note"}</span>
      <div class="record-row__main">
        <div class="record-row__note">${escapeHtml(n.description)}</div>
      </div>
      <div class="record-row__date">${escapeHtml(formatDate(n.date))}</div>
      <button class="record-row__delete" data-action="delete-behavior" data-id="${n.id}" aria-label="Delete note">&times;</button>
    </div>`).join("");
}

function renderContactTab() {
  const l = state.learner;
  if (!l) return "";
  const rows = [
    ["Guardian name", l.guardianName],
    ["Phone", l.guardianPhone, l.guardianPhone ? `tel:${l.guardianPhone}` : null],
    ["Email", l.guardianEmail, l.guardianEmail ? `mailto:${l.guardianEmail}` : null],
    ["Address", l.guardianAddress]
  ];
  return `
    <ul class="contact-list">
      ${rows.map(([label, value, link]) => `
        <li>
          <span class="label">${label}</span>
          <span>${value ? (link ? `<a href="${link}">${escapeHtml(value)}</a>` : escapeHtml(value)) : "—"}</span>
        </li>`).join("")}
    </ul>
    <button class="btn btn-secondary btn-block" style="margin-top:18px;" data-action="edit-contact">Edit contact info</button>`;
}

function renderLearnerScreen(classId, learnerId) {
  const l = state.learner;
  const cls = currentClass(classId);
  const tabs = ["grades", "behavior", "contact"];
  const tabLabels = { grades: "Grades", behavior: "Behavior", contact: "Contact" };

  screenEl.innerHTML = `
    ${topbar({
      title: l ? fullName(l) : "Learner",
      back: true,
      icon: { action: "learner-menu", label: "Learner options", symbol: "&#8942;" }
    })}
    <main>
      ${l ? `
      <div class="learner-header">
        <div class="learner-header__avatar">${escapeHtml(initials(l.firstName, l.lastName))}</div>
        <div style="flex:1;min-width:0;">
          <div class="learner-header__name">${escapeHtml(fullName(l))}</div>
          <div class="learner-header__class">${escapeHtml(cls?.name || "")}</div>
        </div>
        ${state.activeTab === "grades" ? latestGradeStamp() : ""}
      </div>
      <div class="tabs">
        ${tabs.map((t) => `<button class="tab${state.activeTab === t ? " is-active" : ""}" data-action="set-tab" data-tab="${t}">${tabLabels[t]}</button>`).join("")}
      </div>
      <div id="tabContent">
        ${state.activeTab === "grades" ? renderGradesTab(classId, learnerId) : ""}
        ${state.activeTab === "behavior" ? renderBehaviorTab() : ""}
        ${state.activeTab === "contact" ? renderContactTab() : ""}
      </div>
      ` : `<div class="center-loading"><div class="spinner"></div></div>`}
    </main>
    ${l && state.activeTab !== "contact" ? `<button class="fab" data-action="${state.activeTab === "grades" ? "add-grade" : "add-behavior"}" aria-label="Add">+</button>` : ""}`;
  screenEl.dataset.classId = classId;
  screenEl.dataset.learnerId = learnerId;
}

function gradeFormSheet(classId, learnerId) {
  const cls = currentClass(classId);
  openSheet(`
    <div class="sheet__title">Add a grade</div>
    <form id="gradeForm">
      <div class="field">
        <label for="gSubject">Subject</label>
        <input id="gSubject" type="text" value="${escapeHtml(cls?.subject || "")}" required />
      </div>
      <div class="field">
        <label for="gAssessment">Assessment</label>
        <input id="gAssessment" type="text" placeholder="e.g. Term 2 test" required />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="gScore">Score</label>
          <input id="gScore" type="number" step="any" min="0" required />
        </div>
        <div class="field">
          <label for="gMax">Out of</label>
          <input id="gMax" type="number" step="any" min="1" value="100" required />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="gTerm">Term</label>
          <input id="gTerm" type="text" placeholder="e.g. Term 1" />
        </div>
        <div class="field">
          <label for="gDate">Date</label>
          <input id="gDate" type="date" value="${todayInputValue()}" required />
        </div>
      </div>
      <div class="sheet__actions">
        <button type="button" class="btn btn-secondary" data-close-sheet>Cancel</button>
        <button type="submit" class="btn btn-primary">Save grade</button>
      </div>
    </form>`);

  document.getElementById("gradeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await store.addGrade(state.user.uid, classId, learnerId, {
      subject: document.getElementById("gSubject").value.trim(),
      assessment: document.getElementById("gAssessment").value.trim(),
      term: document.getElementById("gTerm").value.trim(),
      score: document.getElementById("gScore").value,
      maxScore: document.getElementById("gMax").value,
      date: document.getElementById("gDate").value
    });
    closeSheet();
  });
}

function behaviorFormSheet(classId, learnerId) {
  openSheet(`
    <div class="sheet__title">Add a behavior note</div>
    <form id="behaviorForm">
      <div class="field">
        <label for="bType">Type</label>
        <select id="bType">
          <option value="positive">Positive</option>
          <option value="negative">Incident</option>
          <option value="neutral" selected>Note</option>
        </select>
      </div>
      <div class="field">
        <label for="bDate">Date</label>
        <input id="bDate" type="date" value="${todayInputValue()}" required />
      </div>
      <div class="field">
        <label for="bDesc">Description</label>
        <textarea id="bDesc" rows="4" required placeholder="What happened?"></textarea>
      </div>
      <div class="sheet__actions">
        <button type="button" class="btn btn-secondary" data-close-sheet>Cancel</button>
        <button type="submit" class="btn btn-primary">Save note</button>
      </div>
    </form>`);

  document.getElementById("behaviorForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await store.addBehaviorNote(state.user.uid, classId, learnerId, {
      type: document.getElementById("bType").value,
      date: document.getElementById("bDate").value,
      description: document.getElementById("bDesc").value.trim()
    });
    closeSheet();
  });
}

function contactFormSheet(classId, learnerId) {
  const l = state.learner || {};
  openSheet(`
    <div class="sheet__title">Edit contact info</div>
    <form id="contactForm">
      <div class="field">
        <label for="cName">Guardian name</label>
        <input id="cName" type="text" value="${escapeHtml(l.guardianName || "")}" />
      </div>
      <div class="field">
        <label for="cPhone">Phone</label>
        <input id="cPhone" type="tel" value="${escapeHtml(l.guardianPhone || "")}" />
      </div>
      <div class="field">
        <label for="cEmail">Email</label>
        <input id="cEmail" type="email" value="${escapeHtml(l.guardianEmail || "")}" />
      </div>
      <div class="field">
        <label for="cAddress">Address</label>
        <textarea id="cAddress" rows="3">${escapeHtml(l.guardianAddress || "")}</textarea>
      </div>
      <div class="sheet__actions">
        <button type="button" class="btn btn-secondary" data-close-sheet>Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);

  document.getElementById("contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await store.updateLearner(state.user.uid, classId, learnerId, {
      guardianName: document.getElementById("cName").value.trim(),
      guardianPhone: document.getElementById("cPhone").value.trim(),
      guardianEmail: document.getElementById("cEmail").value.trim(),
      guardianAddress: document.getElementById("cAddress").value.trim()
    });
    closeSheet();
  });
}

function learnerActionSheet(classId, learnerId) {
  const l = state.learner;
  openSheet(`
    <div class="sheet__title">${escapeHtml(l ? fullName(l) : "Learner")}</div>
    <button class="btn btn-secondary btn-block" style="margin-bottom:10px;" data-action="edit-learner">Edit name</button>
    <button class="btn btn-danger btn-block" data-action="delete-learner">Remove learner</button>
  `);
}

function learnerEditSheet(classId, learnerId) {
  const l = state.learner || {};
  openSheet(`
    <div class="sheet__title">Edit name</div>
    <form id="learnerEditForm">
      <div class="field-row">
        <div class="field">
          <label for="elFirst">First name</label>
          <input id="elFirst" type="text" value="${escapeHtml(l.firstName || "")}" required />
        </div>
        <div class="field">
          <label for="elLast">Last name</label>
          <input id="elLast" type="text" value="${escapeHtml(l.lastName || "")}" required />
        </div>
      </div>
      <div class="sheet__actions">
        <button type="button" class="btn btn-secondary" data-close-sheet>Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);

  document.getElementById("learnerEditForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await store.updateLearner(state.user.uid, classId, learnerId, {
      firstName: document.getElementById("elFirst").value.trim(),
      lastName: document.getElementById("elLast").value.trim()
    });
    closeSheet();
  });
}

// ---------------------------------------------------------------------------
// Data loading per screen
// ---------------------------------------------------------------------------

// Re-renders whatever screen the route currently points to, using data
// already in `state` — no listeners are touched. Used so that a classes
// update (e.g. after a deep link straight into a class/learner) can refresh
// a name/color on screen without needing its own screen-specific listener.
function rerenderForCurrentRoute() {
  const route = currentRoute();
  if (route.path === "/classes") {
    renderClasses();
  } else if (route.parts[0] === "classes" && route.parts.length === 2) {
    renderClassScreen(route.parts[1]);
  } else if (route.parts[0] === "classes" && route.parts[2] === "learners" && route.parts[3]) {
    renderLearnerScreen(route.parts[1], route.parts[3]);
  }
}

// The classes list is small and needed by every screen (titles, colors),
// so we keep exactly one live listener for it for as long as the user is
// signed in, rather than one per screen.
function ensureClassesListener() {
  if (unsub.classes) return;
  unsub.classes = store.watchClasses(state.user.uid, (list) => {
    state.classes = list;
    rerenderForCurrentRoute();
  });
}

function loadClassesScreen() {
  stopListener("learner"); stopListener("grades"); stopListener("behavior"); stopListener("learners");
  ensureClassesListener();
  renderClasses();
}

function loadClassScreen(classId) {
  stopListener("learner"); stopListener("grades"); stopListener("behavior");
  ensureClassesListener();
  stopListener("learners");
  renderClassScreen(classId);
  unsub.learners = store.watchLearners(state.user.uid, classId, (list) => {
    state.learnersByClass.set(classId, list);
    if (currentRoute().path === `/classes/${classId}`) renderClassScreen(classId);
  });
}

function loadLearnerScreen(classId, learnerId) {
  state.learner = null;
  state.grades = [];
  state.behaviorNotes = [];
  ensureClassesListener();
  stopListener("learner"); stopListener("grades"); stopListener("behavior");
  renderLearnerScreen(classId, learnerId);

  unsub.learner = store.watchLearner(state.user.uid, classId, learnerId, (l) => {
    state.learner = l;
    renderLearnerScreen(classId, learnerId);
  });
  unsub.grades = store.watchGrades(state.user.uid, classId, learnerId, (list) => {
    state.grades = list;
    if (state.activeTab === "grades") renderLearnerScreen(classId, learnerId);
  });
  unsub.behavior = store.watchBehaviorNotes(state.user.uid, classId, learnerId, (list) => {
    state.behaviorNotes = list;
    if (state.activeTab === "behavior") renderLearnerScreen(classId, learnerId);
  });
}

// ---------------------------------------------------------------------------
// Router wiring
// ---------------------------------------------------------------------------
function renderRoute(route) {
  if (!state.user) { renderAuth(); return; }

  if (route.path === "/classes") {
    loadClassesScreen();
  } else if (route.parts[0] === "classes" && route.parts.length === 2) {
    loadClassScreen(route.parts[1]);
  } else if (route.parts[0] === "classes" && route.parts[2] === "learners" && route.parts[3]) {
    state.activeTab = route.params.get("tab") || "grades";
    loadLearnerScreen(route.parts[1], route.parts[3]);
  } else {
    navigate("/classes");
  }
}

onRouteChange(renderRoute);

// ---------------------------------------------------------------------------
// Global click delegation (handles all data-action buttons across screens
// and sheets, so we don't need to re-bind listeners on every re-render).
// ---------------------------------------------------------------------------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const route = currentRoute();

  switch (action) {
    case "back": {
      // Navigate to the logical parent screen rather than relying on
      // browser history — more reliable for a PWA that may have been
      // opened fresh on a deep link (e.g. reopened from the home screen).
      if (route.parts.length >= 3) {
        navigate(`/classes/${route.parts[1]}`);
      } else {
        navigate("/classes");
      }
      break;
    }
    case "add-class": {
      classFormSheet(null);
      break;
    }
    case "class-menu": {
      const id = btn.dataset.id || route.parts[1];
      const cls = currentClass(id);
      if (cls) classActionSheet(cls);
      break;
    }
    case "edit-class": {
      closeSheet();
      classFormSheet(currentClass(btn.dataset.id));
      break;
    }
    case "delete-class": {
      const cls = currentClass(btn.dataset.id);
      if (confirm(`Delete "${cls?.name}" and all its learners, grades, and notes? This can't be undone.`)) {
        await store.deleteClassCascade(state.user.uid, btn.dataset.id);
        closeSheet();
        navigate("/classes");
      }
      break;
    }
    case "open-class": {
      navigate(`/classes/${btn.dataset.id}`);
      break;
    }
    case "add-learner": {
      learnerFormSheet(btn.dataset.class);
      break;
    }
    case "open-learner": {
      navigate(`/classes/${btn.dataset.class}/learners/${btn.dataset.id}`);
      break;
    }
    case "set-tab": {
      // Switch tabs without tearing down the learner's live listeners —
      // just re-render with data already in state. We still update the
      // hash (via replaceState, not navigate) so the tab is bookmarkable
      // without adding a back-button stop for every tab click.
      state.activeTab = btn.dataset.tab;
      history.replaceState(null, "", `#/classes/${route.parts[1]}/learners/${route.parts[3]}?tab=${btn.dataset.tab}`);
      renderLearnerScreen(route.parts[1], route.parts[3]);
      break;
    }
    case "add-grade": {
      gradeFormSheet(route.parts[1], route.parts[3]);
      break;
    }
    case "delete-grade": {
      if (confirm("Delete this grade?")) {
        await store.deleteGrade(state.user.uid, route.parts[1], route.parts[3], btn.dataset.id);
      }
      break;
    }
    case "add-behavior": {
      behaviorFormSheet(route.parts[1], route.parts[3]);
      break;
    }
    case "delete-behavior": {
      if (confirm("Delete this note?")) {
        await store.deleteBehaviorNote(state.user.uid, route.parts[1], route.parts[3], btn.dataset.id);
      }
      break;
    }
    case "edit-contact": {
      contactFormSheet(route.parts[1], route.parts[3]);
      break;
    }
    case "learner-menu": {
      learnerActionSheet(route.parts[1], route.parts[3]);
      break;
    }
    case "edit-learner": {
      closeSheet();
      learnerEditSheet(route.parts[1], route.parts[3]);
      break;
    }
    case "delete-learner": {
      if (confirm(`Remove ${state.learner ? fullName(state.learner) : "this learner"} and all their records? This can't be undone.`)) {
        await store.deleteLearnerCascade(state.user.uid, route.parts[1], route.parts[3]);
        closeSheet();
        navigate(`/classes/${route.parts[1]}`);
      }
      break;
    }
    case "account-menu": {
      accountMenuSheet();
      break;
    }
    case "sign-out": {
      closeSheet();
      await logOut();
      break;
    }
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
updateSyncBanner();
watchAuth((user) => {
  state.user = user;
  if (user) {
    startRouter();
  } else {
    Object.keys(unsub).forEach(stopListener);
    state.classes = [];
    state.learnersByClass.clear();
    renderAuth();
  }
});
