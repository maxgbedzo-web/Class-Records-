import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---------------------------------------------------------------------------
// Path helpers — everything lives under users/{uid} so Firestore security
// rules can restrict each teacher to their own data (see README.md).
// ---------------------------------------------------------------------------
const classesCol = (uid) => collection(db, "users", uid, "classes");
const classDoc = (uid, classId) => doc(db, "users", uid, "classes", classId);
const learnersCol = (uid, classId) => collection(db, "users", uid, "classes", classId, "learners");
const learnerDoc = (uid, classId, learnerId) => doc(db, "users", uid, "classes", classId, "learners", learnerId);
const gradesCol = (uid, classId, learnerId) => collection(db, "users", uid, "classes", classId, "learners", learnerId, "grades");
const gradeDoc = (uid, classId, learnerId, gradeId) => doc(db, "users", uid, "classes", classId, "learners", learnerId, "grades", gradeId);
const behaviorCol = (uid, classId, learnerId) => collection(db, "users", uid, "classes", classId, "learners", learnerId, "behavior");
const behaviorDoc = (uid, classId, learnerId, noteId) => doc(db, "users", uid, "classes", classId, "learners", learnerId, "behavior", noteId);

function snapshotToList(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export function watchClasses(uid, cb) {
  const q = query(classesCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snapshotToList(snap)), (err) => console.error("watchClasses", err));
}

export function addClass(uid, { name, subject, year, colorIndex }) {
  return addDoc(classesCol(uid), {
    name, subject: subject || "", year: year || "",
    colorIndex: colorIndex || 0,
    createdAt: serverTimestamp()
  });
}

export function updateClass(uid, classId, data) {
  return updateDoc(classDoc(uid, classId), data);
}

export async function deleteClassCascade(uid, classId) {
  const learners = snapshotToList(await getDocs(learnersCol(uid, classId)));
  for (const learner of learners) {
    await deleteLearnerCascade(uid, classId, learner.id, { skipParentCheck: true });
  }
  await deleteDoc(classDoc(uid, classId));
}

// ---------------------------------------------------------------------------
// Learners
// ---------------------------------------------------------------------------
export function watchLearners(uid, classId, cb) {
  const q = query(learnersCol(uid, classId), orderBy("lastName"));
  return onSnapshot(q, (snap) => cb(snapshotToList(snap)), (err) => console.error("watchLearners", err));
}

export function watchLearner(uid, classId, learnerId, cb) {
  return onSnapshot(learnerDoc(uid, classId, learnerId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, (err) => console.error("watchLearner", err));
}

export function addLearner(uid, classId, data) {
  return addDoc(learnersCol(uid, classId), {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    guardianName: data.guardianName || "",
    guardianPhone: data.guardianPhone || "",
    guardianEmail: data.guardianEmail || "",
    guardianAddress: data.guardianAddress || "",
    notes: data.notes || "",
    createdAt: serverTimestamp()
  });
}

export function updateLearner(uid, classId, learnerId, data) {
  return updateDoc(learnerDoc(uid, classId, learnerId), data);
}

export async function deleteLearnerCascade(uid, classId, learnerId) {
  const grades = snapshotToList(await getDocs(gradesCol(uid, classId, learnerId)));
  await Promise.all(grades.map((g) => deleteDoc(gradeDoc(uid, classId, learnerId, g.id))));
  const notes = snapshotToList(await getDocs(behaviorCol(uid, classId, learnerId)));
  await Promise.all(notes.map((n) => deleteDoc(behaviorDoc(uid, classId, learnerId, n.id))));
  await deleteDoc(learnerDoc(uid, classId, learnerId));
}

// ---------------------------------------------------------------------------
// Grades
// ---------------------------------------------------------------------------
export function watchGrades(uid, classId, learnerId, cb) {
  const q = query(gradesCol(uid, classId, learnerId), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => cb(snapshotToList(snap)), (err) => console.error("watchGrades", err));
}

export function addGrade(uid, classId, learnerId, data) {
  return addDoc(gradesCol(uid, classId, learnerId), {
    subject: data.subject || "",
    assessment: data.assessment || "",
    term: data.term || "",
    score: Number(data.score),
    maxScore: Number(data.maxScore),
    date: data.date || todayIso(),
    createdAt: serverTimestamp()
  });
}

export function deleteGrade(uid, classId, learnerId, gradeId) {
  return deleteDoc(gradeDoc(uid, classId, learnerId, gradeId));
}

// ---------------------------------------------------------------------------
// Behavior notes
// ---------------------------------------------------------------------------
export function watchBehaviorNotes(uid, classId, learnerId, cb) {
  const q = query(behaviorCol(uid, classId, learnerId), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => cb(snapshotToList(snap)), (err) => console.error("watchBehaviorNotes", err));
}

export function addBehaviorNote(uid, classId, learnerId, data) {
  return addDoc(behaviorCol(uid, classId, learnerId), {
    type: data.type || "neutral", // "positive" | "negative" | "neutral"
    description: data.description || "",
    date: data.date || todayIso(),
    createdAt: serverTimestamp()
  });
}

export function deleteBehaviorNote(uid, classId, learnerId, noteId) {
  return deleteDoc(behaviorDoc(uid, classId, learnerId, noteId));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
