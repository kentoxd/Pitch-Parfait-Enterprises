import { auth, db, firebaseAuth, firestore, isFirebaseConfigured } from "../lib/firebase.js";

let authReadyResolved = false;
let authReadyPromise = Promise.resolve();

if (auth) {
  authReadyPromise = new Promise((resolve) => {
    const unsub = firebaseAuth.onAuthStateChanged(auth, () => {
      if (!authReadyResolved) {
        authReadyResolved = true;
        resolve();
      }
      unsub();
    });
  });
}

export function getPrefix() {
  return window.location.pathname.includes("/pages/") ? "../" : "./";
}

export function loginHref(nextPath = "") {
  const prefix = getPrefix();
  const base = `${prefix}pages/login.html`;
  if (!nextPath) return base;
  return `${base}?next=${encodeURIComponent(nextPath)}`;
}

export function isLoggedIn() {
  return Boolean(auth && auth.currentUser);
}

export function currentUser() {
  return auth?.currentUser || null;
}

export async function requireAuthOrRedirect(nextPath) {
  if (!isFirebaseConfigured()) return false;
  await authReadyPromise;
  if (isLoggedIn()) return true;
  window.location.href = loginHref(nextPath);
  return false;
}

export function onAuthChange(cb) {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return firebaseAuth.onAuthStateChanged(auth, cb);
}

export async function login(email, password) {
  if (!auth) throw new Error("Firebase is not configured.");
  return firebaseAuth.signInWithEmailAndPassword(auth, email, password);
}

export async function signup(email, password) {
  if (!auth) throw new Error("Firebase is not configured.");
  const cred = await firebaseAuth.createUserWithEmailAndPassword(auth, email, password);
  if (db) {
    await firestore.setDoc(
      firestore.doc(db, "users", cred.user.uid),
      {
        email: cred.user.email || "",
        role: "customer",
        createdAt: firestore.serverTimestamp(),
      },
      { merge: true }
    );
  }
  return cred;
}

export async function logout() {
  if (!auth) return;
  return firebaseAuth.signOut(auth);
}

export async function getUserRole(uid) {
  if (!db || !uid) return "guest";
  const snap = await firestore.getDoc(firestore.doc(db, "users", uid));
  if (!snap.exists()) return "customer";
  return snap.data()?.role || "customer";
}

export async function isAdminUser() {
  const u = currentUser();
  if (!u) return false;
  const role = await getUserRole(u.uid);
  return role === "admin";
}

