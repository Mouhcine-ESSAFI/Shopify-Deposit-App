# Shopify Deposit Payment App

A comprehensive Shopify app that enables merchants to offer deposit-based payment plans for their products, specifically designed for tour booking businesses. Customers pay a percentage upfront and the balance later, with manual collection control.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Shopify](https://img.shields.io/badge/Shopify-API%202024--10-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 📋 Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Webhooks](#webhooks)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### Core Functionality

- **Flexible Deposit Plans**: Create custom deposit payment plans with any percentage (1-99%)
- **Manual Balance Collection**: Full control over when to charge the remaining balance
- **Automated Order Tracking**: Webhooks automatically capture and track orders
- **Processing Fee System**: Automatically add 3% processing fee when collecting balance
- **Multi-Currency Support**: Configured for EUR with easy currency switching
- **Real-time Status Updates**: Automatic status updates when payments are completed

### Merchant Dashboard

- **Selling Plans Management**: Create, edit, and delete deposit plans
- **Order Management**: View and filter all deposit orders
- **Advanced Search**: Search by order number, ID, or customer email
- **Status Filtering**: Filter orders by payment status (Paid/Pending)
- **Balance Collection**: One-click balance collection with confirmation prompts
- **Product Assignment**: Assign selling plans to specific products

### Customer Experience

- **Transparent Pricing**: Clear breakdown of deposit and balance amounts at checkout
- **Email Notifications**: Automated payment request emails
- **Secure Payments**: All payments processed through Shopify's secure checkout
- **Payment Flexibility**: Choose to pay balance via card or cash on tour day

## 🛠 Technologies Used

### Frontend

- **Remix** (v2.x) - Full-stack React framework
- **React** (v18.x) - UI library
- **Shopify Polaris** (v12.x) - Shopify's design system
  - Cards, Modals, Buttons, Forms
  - ResourceList, Filters, Badges
  - Layout components
- **TypeScript** - Type-safe development

### Backend

- **Node.js** (v20.x) - Runtime environment
- **Shopify App Remix** (v3.x) - Shopify app framework
- **Shopify API** (v2024.10) - Latest Shopify Admin API
  - GraphQL Admin API
  - REST Admin API
- **Prisma ORM** (v6.x) - Database toolkit
- **SQLite** - Development database (production: PostgreSQL recommended)

### Authentication & Security

- **OAuth 2.0** - Shopify app authentication
- **Session Storage** - Prisma-based session management
- **Webhook Verification** - HMAC signature verification
- **Access Scopes**:
  - `write_products` - Product and variant management
  - `write_orders` - Order editing and management
  - `read_orders` - Order data retrieval
  - `write_order_edits` - Balance collection functionality

### API & Integrations

- **GraphQL** - Primary API communication
  - Selling Plans API
  - Order Edit API
  - Order Management API
- **Webhooks**:
  - `ORDERS_CREATE` - New order capture
  - `ORDERS_PAID` - Payment completion tracking
  - `ORDERS_UPDATED` - Order status changes

### Development Tools

- **Vite** - Build tool and dev server
- **ESBuild** - JavaScript bundler
- **Shopify CLI** - Development and deployment tool
- **npm** - Package management
- **Git** - Version control

### Deployment

- **Cloudflare Tunnel** - Local development tunneling
- **Shopify App Store** distribution ready
- Environment variable management

## 🏗 Architecture

### Application Structure

```
deposit-app/
├── app/
│   ├── routes/
│   │   ├── app.selling-plans.tsx      # Selling plans management
│   │   ├── app.orders.tsx             # Order management dashboard
│   │   ├── webhooks.orders.create.tsx # New order webhook
│   │   ├── webhooks.orders.paid.tsx   # Payment webhook
│   │   └── webhooks.orders.updated.tsx # Order update webhook
│   ├── models/
│   │   ├── depositPlan.server.ts      # Deposit plan database operations
│   │   └── depositOrder.server.ts     # Order database operations
│   ├── db.server.ts                    # Database client
│   └── shopify.server.ts               # Shopify configuration
├── prisma/
│   ├── schema.prisma                   # Database schema
│   └── migrations/                     # Database migrations
├── public/                             # Static assets
└── package.json                        # Dependencies

```

### Data Flow

1. **Order Creation**:
   - Customer adds product with deposit plan to cart
   - Pays deposit percentage at checkout
   - `ORDERS_CREATE` webhook fires
   - App captures order details and stores in database
   - Order appears in merchant dashboard

2. **Balance Collection**:
   - Merchant clicks "Collect Balance + 3% Fee"
   - Confirmation modal appears
   - App adds processing fee line item to order
   - Payment request email sent to customer
   - Customer pays via Shopify checkout
   - `ORDERS_PAID` webhook fires
   - Order status automatically updated to "Paid"

### Database Schema

#### DepositPlan Table
```prisma
model DepositPlan {
  id              String   @id @default(cuid())
  shopDomain      String
  sellingPlanId   String   @unique
  sellingPlanGid  String
  groupId         String
  planName        String
  merchantCode    String
  description     String?
  depositPercent  Float    @default(15.0)
  balanceDueDays  Int      @default(365)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  orders          DepositOrder[]
}
```

#### DepositOrder Table
```prisma
model DepositOrder {
  id              String   @id @default(cuid())
  shopDomain      String
  orderId         String
  orderGid        String
  orderNumber     String?
  customerId      String?
  customerEmail   String?
  depositAmount   Float
  balanceAmount   Float
  totalAmount     Float
  depositPaid     Boolean  @default(true)
  balancePaid     Boolean  @default(false)
  balanceDueDate  DateTime
  sellingPlanId   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  plan            DepositPlan?
}
```

## 📦 Installation

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Shopify Partner account
- Shopify development store

### Step 1: Clone Repository

```bash
git clone https://github.com/Mouhcine-ESSAFI/shopify-deposit-app.git
cd shopify-deposit-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Shopify App

```bash
npm run shopify app config link
```

### Step 4: Configure Environment Variables

Create a `.env` file:

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=write_products,write_orders,read_orders,write_order_edits
SHOPIFY_APP_URL=https://your-tunnel-url.com
DATABASE_URL="file:./dev.db"
```

### Step 5: Set Up Database

```bash
npx prisma migrate dev
npx prisma generate
```

### Step 6: Start Development Server

```bash
npm run dev
```

## ⚙️ Configuration

### Selling Plan Configuration

Default configuration for PRE_ORDER category:
- **Balance Due Period**: 3650 days (10 years placeholder)
- **Category**: PRE_ORDER (no automatic charging)
- **Billing Trigger**: TIME_AFTER_CHECKOUT
- **Delivery Trigger**: ASAP
- **Inventory Policy**: Reserve on sale

### Processing Fee Configuration

Located in `app/routes/app.orders.tsx`:

```typescript
const processingFee = balanceAmount * 0.03; // 3% fee
```

To change the fee percentage, modify the `0.03` value.

### Currency Configuration

Change currency in two places:

1. `app/routes/app.orders.tsx`:
```typescript
currencyCode: "EUR" // Change to your currency
```

2. Frontend formatting:
```typescript
currency: 'EUR' // Change to your currency
```

## 📖 Usage

### Creating a Deposit Plan

1. Navigate to **Selling Plans** in the app
2. Click **Create Selling Plan**
3. Configure:
   - Plan Name: "Tour Deposit Plan"
   - Deposit Percentage: 15% (or custom)
   - Description: Customer-facing description
   - Merchant Code: Internal reference
4. Click **Create Plan**
5. Assign the plan to products

### Assigning Plans to Products

1. Click **Assign Products** on a selling plan
2. Select products to enable deposit payments
3. Customers will see the deposit option at checkout

### Managing Orders

1. Navigate to **Deposit Orders**
2. Use search bar to find specific orders
3. Filter by payment status
4. View order details including:
   - Deposit and balance amounts
   - Customer information
   - Payment status
   - Order date and ID

### Collecting Balance

1. Find the order with pending balance
2. Click **Collect Balance + 3% Fee**
3. Review details in confirmation modal
4. Confirm to send payment request
5. Customer receives email with payment link
6. Status updates automatically when paid

## 🔌 API Reference

### GraphQL Mutations Used

#### Create Selling Plan
```graphql
mutation createDepositSellingPlanGroup($input: SellingPlanGroupInput!) {
  sellingPlanGroupCreate(input: $input) {
    sellingPlanGroup {
      id
      name
      sellingPlans {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
}
```

#### Order Edit (Balance Collection)
```graphql
mutation orderEditBegin($id: ID!) {
  orderEditBegin(id: $id) {
    calculatedOrder {
      id
    }
  }
}

mutation orderEditAddCustomItem($id: ID!, $title: String!, $price: MoneyInput!) {
  orderEditAddCustomItem(id: $id, title: $title, price: $price) {
    calculatedLineItem {
      id
    }
  }
}

mutation orderEditCommit($id: ID!) {
  orderEditCommit(id: $id, notifyCustomer: true) {
    order {
      id
    }
  }
}
```

### Webhook Endpoints

- `POST /webhooks/orders/create` - Captures new orders
- `POST /webhooks/orders/paid` - Updates payment status
- `POST /webhooks/orders/updated` - Tracks order changes

## 🐛 Troubleshooting

### Common Issues

**Webhook not receiving events**
```bash
# Re-register webhooks
npm run deploy
```

**Database connection errors**
```bash
# Reset database
npx prisma migrate reset
npx prisma generate
```

**Selling plan not showing at checkout**
- Ensure plan is assigned to product
- Check product variant has inventory
- Verify selling plan is active in Shopify

**Balance collection fails**
- Verify `write_order_edits` scope is enabled
- Check app has been reinstalled after scope changes
- Ensure order is not archived

### Debug Mode

Enable detailed logging:
```typescript
console.log("[DEBUG]", data);
```

Check logs in terminal during development.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 👥 Authors

- **Mouhcine Essafi** - Initial development

## 🙏 Acknowledgments

- Shopify for the comprehensive API documentation
- Polaris design system for UI components
- Remix framework for excellent developer experience

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/Mouhcine-ESSAFI/shopify-deposit-app/issues)
- Email: messafi1337gmail.com

---

**Built with ❤️ for tour operators and booking businesses**
