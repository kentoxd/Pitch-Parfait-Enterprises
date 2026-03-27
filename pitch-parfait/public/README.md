## Pitch Parfait (Static + Firebase)

### Folder structure

- `public/index.html`: Landing page
- `public/pages/home.html`: Main menu page (fetches products)
- `public/pages/cart.html`: Cart
- `public/pages/checkout.html`: Delivery + payment selection, place order
- `public/pages/payment.html`: Dummy online payment form (updates order)
- `public/pages/about.html`, `public/pages/faq.html`, `public/pages/nutrition.html`
- `public/components/`: Reusable navbar/footer HTML
- `public/js/`: Vanilla JS (Firestore + UI)
- `public/css/styles.css`: Pink dessert theme
- `public/lib/firebaseConfig.js`: **Paste your Firebase config here**

### Firebase setup

1. Create a Firebase project
2. Enable **Firestore Database**
3. Create a **Web app** and copy the config into `public/lib/firebaseConfig.js`
4. (Optional) Set basic Firestore rules for development (lock down for production)

Collections used:

- `products`: product catalog
- `cart`: cart lines (doc id == `productId`)
- `orders`: placed orders

### Seeding products

Open `Home` and click **Seed demo products** (requires Firebase config).

### Hosting

This repo includes `firebase.json` configured to host the `public/` folder.

