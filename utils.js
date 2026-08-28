// A small fixed palette so class colors stay consistent with the app's
// token system instead of drifting into random hues.
export const CLASS_COLORS = [
  "#2F5233", // chalkboard green
  "#3E6B8A", // slate blue
  "#C9962E", // stamp gold
  "#B23A48", // flag rose
  "#6B4E9E", // plum
  "#1F3A24"  // deep ink green
];

export function colorForIndex(i) {
  return CLASS_COLORS[i % CLASS_COLORS.length];
}

export function initials(firstName, lastName) {
  const a = (firstName || "").trim()[0] || "";
  const b = (lastName || "").trim()[0] || "";
  return (a + b).toUpperCase() || "?";
}

export function fullName(learner) {
  return [learner.firstName, learner.lastName].filter(Boolean).join(" ");
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function formatDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function todayInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function percentGrade(score, maxScore) {
  const s = Number(score), m = Number(maxScore);
  if (!m) return null;
  return Math.round((s / m) * 1000) / 10;
}

export function gradeStampClass(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return "stamp--muted";
  if (pct >= 75) return "stamp--gold";
  if (pct >= 50) return "stamp--slate";
  return "stamp--rose";
}

export function behaviorStampClass(type) {
  if (type === "positive") return "stamp--gold";
  if (type === "negative") return "stamp--rose";
  return "stamp--slate";
}

// Cheap unique-enough id for optimistic client-side list keys before
// Firestore assigns its own doc id (we still let Firestore generate the
// authoritative id via addDoc).
export function tempId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
