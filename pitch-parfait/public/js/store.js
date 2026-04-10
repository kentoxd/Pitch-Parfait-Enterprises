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

function variantKey(productId, size = "small", toppings = []) {
  const normalizedSize = String(size || "small").toLowerCase();
  const normalizedToppings = normalizeToppings(toppings).join("|");
  return `${String(productId || "")}::${normalizedSize}::${normalizedToppings}`;
}

function cartDocId(uid, productId, size = "small", toppings = []) {
  return `${uid}__${variantKey(productId, size, toppings)}`;
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
  if (!isFirebaseConfigured() || !db) return [];
  await waitForAuthReady();
  const user = currentUser();
  if (!user) return [];
  const q = firestore.query(firestore.collection(db, CART), firestore.where("userId", "==", user.uid));
  const snap = await firestore.getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setCartLineQty(lineId, quantity) {
  const qty = Math.max(0, Math.min(99, Math.floor(Number(quantity) || 0)));
  if (!isFirebaseConfigured() || !db) return;
  await waitForAuthReady();
  const user = currentUser();
  if (!user) throw new Error("Login required");
  if (!lineId) return;
  const ref = firestore.doc(db, CART, lineId);
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
}

export async function addOrIncrementCartLine(productId, extra = {}, incrementBy = 1) {
  const nextBy = Math.max(1, Math.floor(Number(incrementBy) || 1));
  if (!isFirebaseConfigured() || !db) return;
  await waitForAuthReady();
  const user = currentUser();
  if (!user) throw new Error("Login required");
  const size = String(extra.size || "small").toLowerCase();
  const toppings = normalizeToppings(extra.toppings || []);
  const vKey = variantKey(productId, size, toppings);
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
}

export async function clearCart() {
  if (!isFirebaseConfigured() || !db) return;
  const lines = await getCartLines();
  await Promise.all(lines.map((l) => firestore.deleteDoc(firestore.doc(db, CART, l.id))));
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
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

