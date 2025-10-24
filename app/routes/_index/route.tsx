import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({ 
    showForm: Boolean(login)
  });
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Partial Payment App</h1>
        
        <p className={styles.description}>
          Accept deposits for tour bookings and collect the balance later. 
          Perfect for tour operators who need flexibility in payment collection.
        </p>

        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <input 
              className={styles.input} 
              type="text" 
              name="shop" 
              placeholder="your-store.myshopify.com"
              pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com"
              required
              autoComplete="off"
            />
            <button className={styles.button} type="submit">
              Install App
            </button>
          </Form>
        )}

        <div className={styles.features}>
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