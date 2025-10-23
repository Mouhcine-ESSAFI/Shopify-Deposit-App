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
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#5C6AC4"/>
              <path d="M12 16L20 12L28 16M12 16L20 20M12 16V24L20 28M28 16L20 20M28 16V24L20 28M20 20V28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className={styles.logoText}>Partial Payment App</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span>🎯 Built for Tour Operators & Booking Businesses</span>
          </div>
          <h1 className={styles.heroTitle}>
            Accept Deposits. Collect Balance Later.
            <span className={styles.heroTitleAccent}> Complete Control.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Let customers pay a deposit upfront for tours and experiences, then manually collect 
            the balance when you're ready. Perfect for tour operators who need flexibility in payment collection.
          </p>

          {showForm ? (
            <div className={styles.installBox}>
              <Form className={styles.installForm} method="post" action="/auth/login">
                <div className={styles.formGroup}>
                  <label htmlFor="shop" className={styles.formLabel}>
                    Install on Your Shopify Store
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
                  <span>Install Free App</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </Form>
              <p className={styles.installNote}>
                ✓ Free to install  •  ✓ Setup in 2 minutes  •  ✓ No coding required
              </p>
            </div>
          ) : (
            <div className={styles.errorBox}>
              <p>Installation temporarily unavailable. Please contact support.</p>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.howItWorksContent}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <p className={styles.sectionSubtitle}>
            Simple deposit collection in 3 steps
          </p>

          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Customer Pays Deposit</h3>
              <p className={styles.stepDescription}>
                Customer books a tour and pays a customizable deposit percentage (15%, 20%, 30%, or any amount) 
                at checkout. The order is captured automatically.
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>You Control When to Collect</h3>
              <p className={styles.stepDescription}>
                Manually collect the remaining balance when you're ready - before the tour, on tour day, 
                or whenever works for your business. One-click balance collection with 3% processing fee option.
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>Customer Completes Payment</h3>
              <p className={styles.stepDescription}>
                Customer receives automatic email with secure payment link. They can pay online via card 
                or choose cash payment on tour day. Status updates automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className={styles.features}>
        <div className={styles.featuresContent}>
          <h2 className={styles.sectionTitle}>Everything You Need for Tour Bookings</h2>
          <p className={styles.sectionSubtitle}>
            Powerful features designed specifically for tour operators
          </p>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12V7C21 5.9 20.1 5 19 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19H11" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 21L18 19L22 23" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M3 10H21" stroke="#5C6AC4" strokeWidth="2"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Flexible Deposit Plans</h3>
              <p className={styles.featureDescription}>
                Create custom deposit payment plans with any percentage (1-99%). Set different deposit 
                amounts for different tour types or seasonal offerings.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 8V12L15 15" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="9" stroke="#5C6AC4" strokeWidth="2"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Manual Balance Collection</h3>
              <p className={styles.featureDescription}>
                Full control over when to charge the remaining balance. No automatic charging - you decide 
                when it's time to collect payment for each booking.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Automated Order Tracking</h3>
              <p className={styles.featureDescription}>
                Webhooks automatically capture and track all deposit orders. Real-time status updates 
                when payments are completed. Never lose track of a booking.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="8" width="18" height="12" rx="2" stroke="#5C6AC4" strokeWidth="2"/>
                  <path d="M7 8V6C7 4.34315 8.34315 3 10 3H14C15.6569 3 17 4.34315 17 6V8" stroke="#5C6AC4" strokeWidth="2"/>
                  <circle cx="12" cy="14" r="1" fill="#5C6AC4"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Processing Fee System</h3>
              <p className={styles.featureDescription}>
                Automatically add 3% processing fee when collecting balance (customizable). Covers your 
                payment processing costs and protects your margins.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7H20M4 12H20M4 17H20" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="8" cy="7" r="1" fill="#5C6AC4"/>
                  <circle cx="8" cy="12" r="1" fill="#5C6AC4"/>
                  <circle cx="8" cy="17" r="1" fill="#5C6AC4"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Advanced Order Management</h3>
              <p className={styles.featureDescription}>
                View and filter all deposit orders in one dashboard. Search by order number, customer 
                email, or status. Export reports for accounting and analysis.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="#5C6AC4" strokeWidth="2"/>
                  <path d="M22 6L12 13L2 6" stroke="#5C6AC4" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Email Notifications</h3>
              <p className={styles.featureDescription}>
                Automated payment request emails sent to customers with secure checkout links. 
                Clear payment instructions and amount breakdowns included.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Perfect For Section */}
      <section className={styles.perfectFor}>
        <div className={styles.perfectForContent}>
          <h2 className={styles.sectionTitle}>Perfect For</h2>
          <div className={styles.useCasesGrid}>
            <div className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>🚁</div>
              <h3 className={styles.useCaseTitle}>Tour Operators</h3>
              <p className={styles.useCaseText}>
                Helicopter tours, city tours, adventure experiences - collect deposits to secure bookings
              </p>
            </div>
            <div className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>🎫</div>
              <h3 className={styles.useCaseTitle}>Experience Providers</h3>
              <p className={styles.useCaseText}>
                Wine tastings, cooking classes, escape rooms - require deposits for reservations
              </p>
            </div>
            <div className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>🏖️</div>
              <h3 className={styles.useCaseTitle}>Travel & Hospitality</h3>
              <p className={styles.useCaseText}>
                Hotels, vacation rentals, travel packages - secure bookings with flexible payment terms
              </p>
            </div>
            <div className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>🎭</div>
              <h3 className={styles.useCaseTitle}>Event Bookings</h3>
              <p className={styles.useCaseText}>
                Workshops, concerts, conferences - manage group bookings with deposit payments
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className={styles.benefits}>
        <div className={styles.benefitsContent}>
          <h2 className={styles.sectionTitle}>Why Tour Operators Choose Us</h2>
          <div className={styles.benefitsGrid}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitNumber}>💰</div>
              <h3 className={styles.benefitTitle}>Reduce No-Shows</h3>
              <p className={styles.benefitText}>
                Deposits commit customers to their bookings, dramatically reducing cancellations and no-shows
              </p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitNumber}>⚡</div>
              <h3 className={styles.benefitTitle}>Improve Cash Flow</h3>
              <p className={styles.benefitText}>
                Get paid upfront for future bookings. Better forecasting and financial planning
              </p>
            </div>
            <div className={styles.benefitCard}>
              <div className={styles.benefitNumber}>🎯</div>
              <h3 className={styles.benefitTitle}>Complete Flexibility</h3>
              <p className={styles.benefitText}>
                You decide when to collect balance - before tour, on tour day, or accept cash payment
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Ready to Start Accepting Deposits?</h2>
          <p className={styles.ctaSubtitle}>
            Join tour operators already using Partial Payment App to manage their bookings
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
                Install Free App
              </button>
            </Form>
          )}
          <p className={styles.ctaNote}>
            Free to install • No credit card required • Setup in minutes
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="8" fill="#5C6AC4"/>
                  <path d="M12 16L20 12L28 16M12 16L20 20M12 16V24L20 28M28 16L20 20M28 16V24L20 28M20 20V28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Partial Payment App</span>
              </div>
              <p className={styles.footerTagline}>
                Flexible payment solutions for tour operators
              </p>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <div className={styles.footerLinks}>
              <a href="mailto:messafi1337@gmail.com" className={styles.footerLink}>Contact Support</a>
              <span className={styles.footerDivider}>•</span>
              <a href="/privacy" className={styles.footerLink}>Privacy Policy</a>
              <span className={styles.footerDivider}>•</span>
              <a href="/terms" className={styles.footerLink}>Terms of Service</a>
            </div>
            <p className={styles.footerCopy}>
              © {new Date().getFullYear()} Partial Payment App. Built for tour operators.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}