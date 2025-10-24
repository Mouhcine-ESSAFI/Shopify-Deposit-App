import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

// Get allowed stores from environment variable
const getAllowedStores = () => {
  const stores = process.env.ALLOWED_STORES?.split(',').map(s => s.trim()) || [];
  return stores;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const allowedStores = getAllowedStores();

  // If shop parameter exists, check authorization
  if (shop) {
    const normalizedShop = shop.toLowerCase().trim();
    
    if (allowedStores.includes(normalizedShop)) {
      throw redirect(`/app?${url.searchParams.toString()}`);
    } else {
      // Unauthorized store trying to install
      console.log(`[SECURITY] Unauthorized installation attempt from: ${shop}`);
      return json({ 
        showForm: false,
        error: "Access denied. This app is private and only available for authorized stores."
      });
    }
  }

  // Show form with information
  return json({ 
    showForm: Boolean(login),
    error: null,
    storeCount: allowedStores.length
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shop = formData.get("shop");
  const allowedStores = getAllowedStores();

  if (!shop || typeof shop !== "string") {
    return json({ error: "Shop domain is required" }, { status: 400 });
  }

  const normalizedShop = shop.toLowerCase().trim();

  // Check if store is authorized before OAuth
  if (!allowedStores.includes(normalizedShop)) {
    console.log(`[SECURITY] Unauthorized installation attempt from: ${shop}`);
    return json({ 
      error: "Access denied. This app is private and only available for authorized stores." 
    }, { status: 403 });
  }

  // Proceed with normal OAuth flow
  return redirect(`/auth/login?shop=${shop}`);
};

export default function App() {
  const { showForm, error, storeCount } = useLoaderData<typeof loader>();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.lockIcon}>🔒</div>
          <h1 className={styles.title}>Partial Payment App</h1>
          <span className={styles.badge}>Private Access Only</span>
        </div>
        
        <p className={styles.description}>
          Accept deposits for tour bookings and collect the balance later. 
          This app is available only for authorized stores.
        </p>

        {error && (
          <div className={styles.errorBox}>
            <svg className={styles.errorIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="10" cy="13" r="0.5" fill="currentColor"/>
            </svg>
            <p>{error}</p>
          </div>
        )}

        {showForm && (
          <>
            <Form className={styles.form} method="post" action="/auth/login">
              <div className={styles.inputGroup}>
                <label htmlFor="shop" className={styles.label}>
                  Store Domain
                </label>
                <input 
                  id="shop"
                  className={styles.input} 
                  type="text" 
                  name="shop" 
                  placeholder="your-store.myshopify.com"
                  pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com"
                  required
                  autoComplete="off"
                />
              </div>
              <button className={styles.button} type="submit">
                Install on My Store
              </button>
            </Form>

            <div className={styles.info}>
              <p className={styles.infoText}>
                ℹ️ Only {storeCount} authorized {storeCount === 1 ? 'store is' : 'stores are'} allowed to install this app.
              </p>
            </div>
          </>
        )}

        <div className={styles.features}>
          <h3 className={styles.featuresTitle}>Features</h3>
          <div className={styles.feature}>
            <span className={styles.icon}>✓</span>
            <span>Customers pay deposit at checkout</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.icon}>✓</span>
            <span>You manually collect balance when ready</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.icon}>✓</span>
            <span>Automatic tracking and notifications</span>
          </div>
        </div>
      </div>
    </div>
  );
}