import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import "@shopify/polaris/build/esm/styles.css";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ui-nav-menu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/selling-plans">
          Selling Plans
        </Link>
        <Link to="/app/orders">
          Orders
        </Link>
        {/* <Link to="/app/setup-webhooks">
          Setup Webhooks
        </Link>
        <Link to="/app/verify-webhooks">
          Verify Webhooks
        </Link> */}
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Application Error</h1>
      <p>Something went wrong. Please try again.</p>
      {process.env.NODE_ENV === 'development' && (
        <pre style={{ background: '#f5f5f5', padding: '10px', marginTop: '10px' }}>
          {error instanceof Error ? error.stack : JSON.stringify(error)}
        </pre>
      )}
    </div>
  );
}