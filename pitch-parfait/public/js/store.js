import { db, firestore, isFirebaseConfigured } from "../lib/firebase.js";
import { demoProducts } from "./demoData.js";
import { currentUser } from "./auth.js";

const PRODUCTS = "products";
const CART = "cart";
const ORDERS = "orders";

function cartDocId(uid, productId) {
  return `${uid}__${productId}`;
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
  const user = currentUser();
  if (!user) return [];
  const q = firestore.query(firestore.collection(db, CART), firestore.where("userId", "==", user.uid));
  const snap = await firestore.getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setCartQty(productId, quantity) {
  const qty = Math.max(0, Math.min(99, Math.floor(Number(quantity) || 0)));
  if (!isFirebaseConfigured() || !db) return;
  const user = currentUser();
  if (!user) throw new Error("Login required");
  const ref = firestore.doc(db, CART, cartDocId(user.uid, productId));
  if (qty <= 0) {
    await firestore.deleteDoc(ref);
    return;
  }
  await firestore.setDoc(
    ref,
    { userId: user.uid, productId, quantity: qty, updatedAt: firestore.serverTimestamp() },
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
  await firestore.deleteDoc(firestore.doc(db, PRODUCTS, productId));
}

export async function listOrders(limitCount = 100) {
  if (!isFirebaseConfigured() || !db) return [];
  const q = firestore.query(
    firestore.collection(db, ORDERS),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  );
  const snap = await firestore.getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

