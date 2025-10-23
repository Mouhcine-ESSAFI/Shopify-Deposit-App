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

  const isProduction = process.env.NODE_ENV === "production";
  const appUrl = process.env.SHOPIFY_APP_URL || process.env.HOST || "";

  return json({ 
    showForm: Boolean(login),
    isProduction,
    appUrl
  });
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#5C6AC4"/>
              <path d="M20 10L28 15V25L20 30L12 25V15L20 10Z" fill="white"/>
            </svg>
            <span className={styles.logoText}>Deposit Manager</span>
          </div>
        </div>
      </header>

      {/* Main Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Accept Deposits & Partial Payments
            <span className={styles.heroTitleAccent}> On Any Order</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Increase sales by offering flexible payment options. Let customers pay deposits upfront 
            and complete payment later. Perfect for high-ticket items, pre-orders, and custom products.
          </p>

          {showForm ? (
            <div className={styles.installBox}>
              <Form className={styles.installForm} method="post" action="/auth/login">
                <div className={styles.formGroup}>
                  <label htmlFor="shop" className={styles.formLabel}>
                    Enter your Shopify store URL
                  </label>
                  <div className={styles.inputWrapper}>
                    <input 
                      id="shop"
                      className={styles.formInput} 
                      type="text" 
                      name="shop" 
                      placeholder="your-store.myshopify.com"
                      pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com"
                      title="Please enter a valid Shopify domain"
                      required
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>
                <button className={styles.installButton} type="submit">
                  <span>Install App — Free 14 Day Trial</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </Form>
              <p className={styles.installNote}>
                ✓ No credit card required  •  ✓ Install in 2 minutes
              </p>
            </div>
          ) : (
            <div className={styles.errorBox}>
              <p>Installation temporarily unavailable. Please contact support@yourdomain.com</p>
            </div>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section className={styles.features}>
        <div className={styles.featuresContent}>
          <h2 className={styles.sectionTitle}>Everything You Need to Manage Deposits</h2>
          <p className={styles.sectionSubtitle}>
            Powerful features designed specifically for Shopify merchants
          </p>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Flexible Deposit Rules</h3>
              <p className={styles.featureDescription}>
                Set percentage or fixed amount deposits. Apply rules globally or per product. 
                Perfect for pre-orders, custom items, and high-value products.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#5C6AC4" strokeWidth="2"/>
                  <path d="M9 11L11 13L15 9" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Automated Tracking</h3>
              <p className={styles.featureDescription}>
                Automatically track all partial payments and outstanding balances. 
                Get real-time notifications when customers complete their payments.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15" stroke="#5C6AC4" strokeWidth="2"/>
                  <path d="M17 8L12 3L7 8" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 3V15" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Payment Reminders</h3>
              <p className={styles.featureDescription}>
                Automated email reminders for outstanding balances. Customizable templates 
                and schedules to match your brand and business needs.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#5C6AC4" strokeWidth="2"/>
                  <path d="M12 6V12L16 14" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Custom Payment Plans</h3>
              <p className={styles.featureDescription}>
                Create flexible payment schedules. Split payments over weeks or months. 
                Give customers the flexibility they need to make larger purchases.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12V7C21 5.9 20.1 5 19 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19H11" stroke="#5C6AC4" strokeWidth="2"/>
                  <path d="M16 21L18 19L22 23" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Order Management</h3>
              <p className={styles.featureDescription}>
                View all deposit orders in one dashboard. Filter by status, search by customer, 
                and export reports for accounting and analysis.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21" stroke="#5C6AC4" strokeWidth="2"/>
                  <circle cx="12" cy="7" r="4" stroke="#5C6AC4" strokeWidth="2"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Customer Experience</h3>
              <p className={styles.featureDescription}>
                Seamless checkout experience for customers. Clear payment terms displayed 
                at checkout. Easy-to-use payment portal for completing balances.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className={styles.benefits}>
        <div className={styles.benefitsContent}>
          <h2 className={styles.sectionTitle}>Why Merchants Love Deposit Manager</h2>
          <div className={styles.benefitsGrid}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitNumber}>📈</div>
              <h3 className={styles.benefitTitle}>Increase AOV by 35%</h3>
              <p className={styles.benefitText}>
                Customers spend more when they can spread payments over time
              </p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitNumber}>💰</div>
              <h3 className={styles.benefitTitle}>Reduce Cart Abandonment</h3>
              <p className={styles.benefitText}>
                Lower the barrier to purchase with flexible deposit options
              </p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitNumber}>⚡</div>
              <h3 className={styles.benefitTitle}>Setup in Minutes</h3>
              <p className={styles.benefitText}>
                No coding required. Works with your existing theme instantly
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Ready to Accept Deposits?</h2>
          <p className={styles.ctaSubtitle}>
            Join hundreds of merchants already using Deposit Manager
          </p>
          {showForm && (
            <Form className={styles.ctaForm} method="post" action="/auth/login">
              <input 
                className={styles.ctaInput} 
                type="text" 
                name="shop" 
                placeholder="your-store.myshopify.com"
                pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com"
                required
                autoComplete="off"
              />
              <button className={styles.ctaButton} type="submit">
                Get Started Free
              </button>
            </Form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLinks}>
            <a href="mailto:support@yourdomain.com" className={styles.footerLink}>Support</a>
            <span className={styles.footerDivider}>•</span>
            <a href="/privacy" className={styles.footerLink}>Privacy Policy</a>
            <span className={styles.footerDivider}>•</span>
            <a href="/terms" className={styles.footerLink}>Terms of Service</a>
          </div>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} Deposit Manager. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}