import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // If shop parameter exists, redirect to app
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // Check environment
  const isProduction = process.env.NODE_ENV === "production";
  const appUrl = process.env.SHOPIFY_APP_URL || process.env.HOST || "";

  return json({ 
    showForm: Boolean(login),
    isProduction,
    appUrl
  });
};

export default function App() {
  const { showForm, isProduction, appUrl } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Shopify Deposit App</h1>
        <p className={styles.text}>
          Manage customer deposits and partial payments seamlessly for your Shopify store.
        </p>
        
        {showForm ? (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input 
                className={styles.input} 
                type="text" 
                name="shop" 
                placeholder="your-store.myshopify.com"
                pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com"
                title="Please enter a valid Shopify domain (e.g., my-store.myshopify.com)"
                required
                autoComplete="off"
              />
              <span className={styles.hint}>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Install App
            </button>
          </Form>
        ) : (
          <div className={styles.errorContainer}>
            <p className={styles.error}>
              App installation is currently unavailable. Please contact support.
            </p>
          </div>
        )}

        <div className={styles.features}>
          <h2 className={styles.featuresHeading}>Key Features</h2>
          <ul className={styles.list}>
            <li>
              <strong>Flexible Deposit Options</strong>. Allow customers to pay deposits 
              on orders and complete payment later, increasing conversion rates and making 
              high-value items more accessible.
            </li>
            <li>
              <strong>Automated Payment Tracking</strong>. Automatically track partial 
              payments and send reminders for remaining balances, reducing manual work 
              and improving cash flow.
            </li>
            <li>
              <strong>Seamless Integration</strong>. Works directly with your Shopify 
              checkout and order management system with no complex setup required.
            </li>
            <li>
              <strong>Customizable Payment Plans</strong>. Create flexible payment schedules 
              that work for your business and your customers' needs.
            </li>
          </ul>
        </div>

        {isProduction && (
          <div className={styles.footer}>
            <p className={styles.footerText}>
              Need help? <a href="mailto:contact@servalys.com" className={styles.link}>Contact Support</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}