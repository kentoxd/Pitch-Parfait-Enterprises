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

export async function waitForAuthReady() {
  await authReadyPromise;
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

export async function signup(email, password, fullName = "") {
  return signupWithConsent(email, password, fullName, null);
}

const ROLE_RANK = {
  guest: 0,
  customer: 1,
  staff: 2,
  admin: 3,
  super_admin: 4,
};

export const ROLES = Object.freeze(Object.keys(ROLE_RANK));

export function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ROLES.includes(value) ? value : "customer";
}

export function roleRank(role) {
  return ROLE_RANK[normalizeRole(role)] ?? ROLE_RANK.customer;
}

export function canAccessRole(role, minimumRole) {
  return roleRank(role) >= roleRank(minimumRole);
}

export async function signupWithConsent(email, password, fullName = "", consentMeta = null) {
  if (!auth) throw new Error("Firebase is not configured.");
  const cred = await firebaseAuth.createUserWithEmailAndPassword(auth, email, password);
  const cleanedName = String(fullName || "").trim();
  if (cleanedName) {
    try {
      await firebaseAuth.updateProfile(cred.user, { displayName: cleanedName });
    } catch {
      // Ignore profile sync failures and still persist on Firestore.
    }
  }
  if (db) {
    const normalizedConsent = consentMeta && typeof consentMeta === "object"
      ? {
          accepted: Boolean(consentMeta.accepted),
          acceptedAt: consentMeta.acceptedAt || new Date().toISOString(),
          version: String(consentMeta.version || "v1"),
        }
      : null;
    await firestore.setDoc(
      firestore.doc(db, "users", cred.user.uid),
      {
        email: cred.user.email || "",
        name: cleanedName,
        displayName: cleanedName,
        role: "customer",
        consent: normalizedConsent,
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
  try {
    const snap = await firestore.getDoc(firestore.doc(db, "users", uid));
    if (!snap.exists()) return "customer";
    return normalizeRole(snap.data()?.role || "customer");
  } catch (error) {
    console.warn("Could not read user role; defaulting to customer.", error);
    return "customer";
  }
}

export async function isAdminUser() {
  return hasMinimumRole("admin");
}

export async function hasMinimumRole(minimumRole) {
  const u = currentUser();
  if (!u) return false;
  const role = await getUserRole(u.uid);
  return canAccessRole(role, minimumRole);
}

export async function getCurrentUserRole() {
  const u = currentUser();
  if (!u) return "guest";
  return getUserRole(u.uid);
}

export async function getCurrentUserProfile() {
  const u = currentUser();
  if (!u) return null;
  const role = await getUserRole(u.uid);
  let profile = {};
  if (db) {
    try {
      const snap = await firestore.getDoc(firestore.doc(db, "users", u.uid));
      if (snap.exists()) profile = snap.data() || {};
    } catch (error) {
      console.warn("Could not read profile details from users document.", error);
    }
  }
  return {
    uid: u.uid,
    email: u.email || profile.email || "",
    displayName: u.displayName || profile.displayName || "",
    role,
    ...profile,
  };
}

