import { db, firestore, isFirebaseConfigured } from "../lib/firebase.js";
import { demoProducts } from "./demoData.js";
import { currentUser, waitForAuthReady } from "./auth.js";

const PRODUCTS = "products";
const CART = "cart";
const ORDERS = "orders";

function normalizeToppings(toppings) {
  if (!Array.isArray(toppings)) return [];
  return toppings.map((x) => String(x || "").trim()).filter(Boolean).sort();
}

const USERS = "users";

export async function getUsers(limitCount = 100) {
  if (!isFirebaseConfigured() || !db) return [];
  await waitForAuthReady();

  const q = firestore.query(
    firestore.collection(db, USERS),
    firestore.limit(limitCount)
  );

  const snap = await firestore.getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));
}

export async function deleteUser(userId) {
  if (!isFirebaseConfigured() || !db) return;
  await waitForAuthReady();

  await firestore.deleteDoc(
    firestore.doc(db, "users", userId)
  );
}

function variantKey(productId, size = "small", toppings = []) {
  const normalizedSize = String(size || "small").toLowerCase();
  const normalizedToppings = normalizeToppings(toppings).join("|");
  return `${String(productId || "")}::${normalizedSize}::${normalizedToppings}`;
}

function cartDocId(uid, productId, size = "small", toppings = []) {
  return `${uid}__${variantKey(productId, size, toppings)}`;
}

function localCartKey(uid = "guest") {
  return `pp_cart_${uid}`;
}

function readLocalCart(uid = "guest") {
  try {
    const raw = localStorage.getItem(localCartKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCart(uid = "guest", lines = []) {
  try {
    localStorage.setItem(localCartKey(uid), JSON.stringify(lines));
    return true;
  } catch {
    return false;
  }
}

function getActiveCartUid() {
  return currentUser()?.uid || "guest";
}

function notifyCartUpdated() {
  window.dispatchEvent(new CustomEvent("pp:cart-updated"));
}

export async function getProducts() {
  if (!isFirebaseConfigured() || !db) return demoProducts;
  try {
    const snap = await firestore.getDocs(firestore.collection(db, PRODUCTS));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return items.length ? items : demoProducts;
  } catch (error) {
    console.error("Failed to fetch Firestore products. Falling back to demo data.", error);
    return demoProducts;
  }
}

export async function seedDemoProducts() {
  if (!isFirebaseConfigured() || !db) throw new Error("Firebase not configured");
  const writes = demoProducts.map((p) =>
    firestore.setDoc(firestore.doc(db, PRODUCTS, p.id), {
      name: p.name,
      category: p.category,
      price: p.price,
      image: p.image,
      description: p.description
    })
  );
  await Promise.all(writes);
}

export async function getCartLines() {
  const uid = getActiveCartUid();
  const localLines = readLocalCart(uid);
  if (!isFirebaseConfigured() || !db) return localLines;
  await waitForAuthReady();
  const user = currentUser();
  if (!user) return localLines;
  try {
    const q = firestore.query(firestore.collection(db, CART), firestore.where("userId", "==", user.uid));
    const snap = await firestore.getDocs(q);
    const remoteLines = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!localLines.length) return remoteLines;
    if (!remoteLines.length) return localLines;
    const merged = new Map(remoteLines.map((line) => [line.id, line]));
    localLines.forEach((line) => {
      if (!merged.has(line.id)) merged.set(line.id, line);
    });
    return [...merged.values()];
  } catch (error) {
    console.warn("Falling back to local cart read.", error);
    return localLines;
  }
}

export async function setCartLineQty(lineId, quantity) {
  const qty = Math.max(0, Math.min(99, Math.floor(Number(quantity) || 0)));
  const uid = getActiveCartUid();
  if (!lineId) return;
  if (!isFirebaseConfigured() || !db) {
    const lines = readLocalCart(uid);
    const nextLines = qty <= 0
      ? lines.filter((l) => l.id !== lineId)
      : lines.map((l) => (l.id === lineId ? { ...l, quantity: qty } : l));
    writeLocalCart(uid, nextLines);
    notifyCartUpdated();
    return;
  }
  await waitForAuthReady();
  const user = currentUser();
  if (!user) throw new Error("Login required");
  const ref = firestore.doc(db, CART, lineId);
  try {
    if (qty <= 0) {
      await firestore.deleteDoc(ref);
      return;
    }
    await firestore.setDoc(
      ref,
      {
        quantity: qty,
        updatedAt: firestore.serverTimestamp(),
      },
      { merge: true }
    );
    notifyCartUpdated();
  } catch (error) {
    console.warn("Falling back to local cart update.", error);
    const lines = readLocalCart(uid);
    const nextLines = qty <= 0
      ? lines.filter((l) => l.id !== lineId)
      : lines.map((l) => (l.id === lineId ? { ...l, quantity: qty } : l));
    writeLocalCart(uid, nextLines);
    notifyCartUpdated();
  }
}

export async function addOrIncrementCartLine(productId, extra = {}, incrementBy = 1) {
  const nextBy = Math.max(1, Math.floor(Number(incrementBy) || 1));
  const uid = getActiveCartUid();
  const size = String(extra.size || "small").toLowerCase();
  const toppings = normalizeToppings(extra.toppings || []);
  const vKey = variantKey(productId, size, toppings);
  if (!isFirebaseConfigured() || !db) {
    const lines = readLocalCart(uid);
    const localId = cartDocId(uid, productId, size, toppings);
    const existing = lines.find((l) => l.id === localId);
    const currentQty = Number(existing?.quantity) || 0;
    const quantity = Math.max(0, Math.min(99, currentQty + nextBy));
    if (quantity <= 0) {
      writeLocalCart(uid, lines.filter((l) => l.id !== localId));
      notifyCartUpdated();
      return;
    }
    const payload = {
      id: localId,
      userId: uid,
      productId,
      variantKey: vKey,
      size,
      toppings,
      unitPrice: Number(extra.unitPrice || 0),
      quantity,
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      writeLocalCart(uid, lines.map((l) => (l.id === localId ? { ...l, ...payload } : l)));
    } else {
      writeLocalCart(uid, [...lines, payload]);
    }
    notifyCartUpdated();
    return;
  }
  await waitForAuthReady();
  const user = currentUser();
  if (!user) throw new Error("Login required");
  try {
    const ref = firestore.doc(db, CART, cartDocId(user.uid, productId, size, toppings));
    const snap = await firestore.getDoc(ref);
    const currentQty = snap.exists() ? (Number(snap.data()?.quantity) || 0) : 0;
    const quantity = Math.max(0, Math.min(99, currentQty + nextBy));
    if (quantity <= 0) {
      await firestore.deleteDoc(ref);
      return;
    }
    await firestore.setDoc(
      ref,
      {
        userId: user.uid,
        productId,
        variantKey: vKey,
        size,
        toppings,
        unitPrice: Number(extra.unitPrice || 0),
        quantity,
        updatedAt: firestore.serverTimestamp(),
      },
      { merge: true }
    );
    notifyCartUpdated();
  } catch (error) {
    console.warn("Falling back to local cart add.", error);
    const lines = readLocalCart(uid);
    const localId = cartDocId(uid, productId, size, toppings);
    const existing = lines.find((l) => l.id === localId);
    const currentQty = Number(existing?.quantity) || 0;
    const quantity = Math.max(0, Math.min(99, currentQty + nextBy));
    if (quantity <= 0) {
      if (!writeLocalCart(uid, lines.filter((l) => l.id !== localId))) {
        throw new Error("Local cart storage unavailable");
      }
      notifyCartUpdated();
      return;
    }
    const payload = {
      id: localId,
      userId: uid,
      productId,
      variantKey: vKey,
      size,
      toppings,
      unitPrice: Number(extra.unitPrice || 0),
      quantity,
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      if (!writeLocalCart(uid, lines.map((l) => (l.id === localId ? { ...l, ...payload } : l)))) {
        throw new Error("Local cart storage unavailable");
      }
    } else {
      if (!writeLocalCart(uid, [...lines, payload])) {
        throw new Error("Local cart storage unavailable");
      }
    }
    notifyCartUpdated();
  }
}

export async function clearCart() {
  const uid = getActiveCartUid();
  if (!isFirebaseConfigured() || !db) {
    writeLocalCart(uid, []);
    notifyCartUpdated();
    return;
  }
  const lines = await getCartLines();
  try {
    await Promise.all(lines.map((l) => firestore.deleteDoc(firestore.doc(db, CART, l.id))));
  } catch (error) {
    console.warn("Falling back to local cart clear.", error);
    writeLocalCart(uid, []);
  }
  notifyCartUpdated();
}

export async function createOrder(order) {
  if (!isFirebaseConfigured() || !db) throw new Error("Firebase not configured");
  await waitForAuthReady();
  const user = currentUser();
  if (!user) throw new Error("Login required");
  const ref = await firestore.addDoc(firestore.collection(db, ORDERS), {
    ...order,
    userId: user.uid,
    userEmail: user.email || "",
    createdAt: firestore.serverTimestamp()
  });
  return ref.id;
}

export async function getOrder(orderId) {
  if (!isFirebaseConfigured() || !db) throw new Error("Firebase not configured");
  const snap = await firestore.getDoc(firestore.doc(db, ORDERS, orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateOrder(orderId, patch) {
  if (!isFirebaseConfigured() || !db) throw new Error("Firebase not configured");
  await firestore.updateDoc(firestore.doc(db, ORDERS, orderId), patch);
}

export async function upsertProduct(product) {
  if (!isFirebaseConfigured() || !db) throw new Error("Firebase not configured");
  await waitForAuthReady();
  const payload = {
    name: String(product.name || "").trim(),
    category: String(product.category || "").trim(),
    price: Number(product.price || 0),
    image: String(product.image || "").trim(),
    description: String(product.description || "").trim(),
    updatedAt: firestore.serverTimestamp(),
  };
  if (product.id) {
    await firestore.setDoc(firestore.doc(db, PRODUCTS, product.id), payload, { merge: true });
    return product.id;
  }
  const ref = await firestore.addDoc(firestore.collection(db, PRODUCTS), {
    ...payload,
    createdAt: firestore.serverTimestamp(),
  });
  return ref.id;
}

export async function deleteProduct(productId) {
  if (!isFirebaseConfigured() || !db) throw new Error("Firebase not configured");
  await waitForAuthReady();
  await firestore.deleteDoc(firestore.doc(db, PRODUCTS, productId));
}

export async function listOrders(limitCount = 100) {
  if (!isFirebaseConfigured() || !db) return [];
  await waitForAuthReady();

  const q = firestore.query(
    firestore.collection(db, ORDERS),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  );

  const snap = await firestore.getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();

    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt || new Date().toISOString()
    };
  });
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export async function restoreDefaultProducts() {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  await waitForAuthReady();

  // Get all current products
  const snap = await firestore.getDocs(firestore.collection(db, PRODUCTS));

  // Delete all existing products
  const deletes = snap.docs.map((doc) =>
    firestore.deleteDoc(firestore.doc(db, PRODUCTS, doc.id))
  );
  await Promise.all(deletes);

  // Re-add demo products
  const writes = demoProducts.map((p) =>
    firestore.setDoc(firestore.doc(db, PRODUCTS, p.id), {
      name: p.name,
      category: p.category,
      price: p.price,
      image: p.image,
      description: p.description,
      inStock: p.inStock ?? true,
      createdAt: firestore.serverTimestamp(),
    })
  );

  await Promise.all(writes);
}

export async function updateUser(userId, patch) {
  if (!isFirebaseConfigured() || !db) throw new Error("Firebase not configured");
  await waitForAuthReady();

  if (!userId) throw new Error("Missing userId");

  const ref = firestore.doc(db, "users", userId);

  await firestore.setDoc(
    ref,
    {
      ...patch,
      updatedAt: firestore.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function listOrdersForCurrentUser(limitCount = 100) {
  if (!isFirebaseConfigured() || !db) return [];
  await waitForAuthReady();
  const user = currentUser();
  if (!user) return [];
  const q = firestore.query(
    firestore.collection(db, ORDERS),
    firestore.where("userId", "==", user.uid),
    firestore.limit(limitCount)
  );
  const snap = await firestore.getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

