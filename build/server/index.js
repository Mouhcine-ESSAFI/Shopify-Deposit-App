var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, Link, useRouteError, useNavigation, useSubmit, useFetcher } from "@remix-run/react";
import { createReadableStreamFromReadable, redirect, json } from "@remix-run/node";
import { isbot } from "isbot";
import "@shopify/shopify-app-remix/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { useState, useCallback, useEffect } from "react";
import { AppProvider, Page, Card, FormLayout, Text, TextField, Button, Layout, Banner, ResourceList, ResourceItem, InlineStack, BlockStack, Badge, Box, Modal, Select, Link as Link$1, List } from "@shopify/polaris";
import { AppProvider as AppProvider$1 } from "@shopify/shopify-app-remix/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
let prisma;
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  prisma = global.__db__;
  prisma.$connect();
}
const prisma$1 = prisma;
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma$1),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.January25;
const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url
        }
      ),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function App$2() {
  return /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width,initial-scale=1" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://cdn.shopify.com/" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          rel: "stylesheet",
          href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        }
      ),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$2
}, Symbol.toStringTag, { value: "Module" }));
const action$5 = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma$1.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5
}, Symbol.toStringTag, { value: "Module" }));
const action$4 = async ({ request }) => {
  const { topic, shop, session } = await authenticate.webhook(request);
  if (!shop) {
    throw new Response("No shop provided", { status: 400 });
  }
  console.log(`Received ${topic} webhook for ${shop}`);
  await prisma$1.depositPlan.deleteMany({ where: { shopDomain: shop } });
  await prisma$1.depositOrder.deleteMany({ where: { shopDomain: shop } });
  await prisma$1.appConfiguration.deleteMany({ where: { shopDomain: shop } });
  console.log(`Cleaned up data for ${shop}`);
  return new Response("OK", { status: 200 });
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4
}, Symbol.toStringTag, { value: "Module" }));
async function createDepositPlan(data) {
  return prisma$1.depositPlan.create({
    data: {
      shopDomain: data.shopDomain,
      sellingPlanId: data.sellingPlanId,
      sellingPlanGid: data.sellingPlanGid,
      groupId: data.groupId,
      planName: data.planName,
      merchantCode: data.merchantCode,
      description: data.description,
      depositPercent: data.depositPercent,
      balanceDueDays: data.balanceDueDays,
      isActive: true
    }
  });
}
async function getDepositPlansByShop(shopDomain) {
  return prisma$1.depositPlan.findMany({
    where: {
      shopDomain,
      isActive: true
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      _count: {
        select: {
          orders: true
        }
      }
    }
  });
}
async function getDepositPlanBySellingPlanId(shopDomain, sellingPlanId) {
  return prisma$1.depositPlan.findUnique({
    where: {
      shopDomain_sellingPlanId: {
        shopDomain,
        sellingPlanId
      }
    }
  });
}
async function createDepositOrder(data) {
  return prisma$1.depositOrder.create({
    data: {
      shopDomain: data.shopDomain,
      orderId: data.orderId,
      orderGid: data.orderGid,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      customerEmail: data.customerEmail,
      depositAmount: data.depositAmount,
      balanceAmount: data.balanceAmount,
      totalAmount: data.totalAmount,
      depositPaid: true,
      // Deposit is paid when order is created
      balancePaid: false,
      balanceDueDate: data.balanceDueDate,
      sellingPlanId: data.sellingPlanId
    }
  });
}
async function getDepositOrdersByShop(shopDomain) {
  return prisma$1.depositOrder.findMany({
    where: { shopDomain },
    include: { plan: true },
    orderBy: { createdAt: "desc" }
  });
}
const action$3 = async ({ request }) => {
  var _a2, _b;
  const { topic, shop, session, payload } = await authenticate.webhook(request);
  if (!shop) {
    throw new Response("No shop provided", { status: 400 });
  }
  console.log(`Received ${topic} webhook for ${shop}`);
  try {
    const order = payload;
    const depositLineItems = order.line_items.filter(
      (item) => item.selling_plan_allocation
    );
    if (depositLineItems.length === 0) {
      console.log(`Order ${order.id} has no deposit items, skipping`);
      return new Response("OK - No deposit items", { status: 200 });
    }
    for (const lineItem of depositLineItems) {
      const sellingPlanId = lineItem.selling_plan_allocation.selling_plan.id.toString();
      const depositPlan = await getDepositPlanBySellingPlanId(shop, sellingPlanId);
      if (!depositPlan) {
        console.log(`No deposit plan found for selling plan ${sellingPlanId}`);
        continue;
      }
      const lineTotal = parseFloat(lineItem.price) * lineItem.quantity;
      const depositAmount = lineTotal * (depositPlan.depositPercent / 100);
      const balanceAmount = lineTotal - depositAmount;
      const balanceDueDate = /* @__PURE__ */ new Date();
      balanceDueDate.setDate(balanceDueDate.getDate() + depositPlan.balanceDueDays);
      await createDepositOrder({
        shopDomain: shop,
        orderId: order.id.toString(),
        orderGid: `gid://shopify/Order/${order.id}`,
        orderNumber: order.name,
        customerId: (_a2 = order.customer) == null ? void 0 : _a2.id.toString(),
        customerEmail: ((_b = order.customer) == null ? void 0 : _b.email) || order.email,
        depositAmount,
        balanceAmount,
        totalAmount: lineTotal,
        balanceDueDate,
        sellingPlanId
      });
      console.log(`Created deposit order record for order ${order.id}, line item ${lineItem.id}`);
    }
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`Error processing order webhook:`, error);
    return new Response("Error processing webhook", { status: 500 });
  }
};
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
const Polaris = /* @__PURE__ */ JSON.parse('{"ActionMenu":{"Actions":{"moreActions":"More actions"},"RollupActions":{"rollupButton":"View actions"}},"ActionList":{"SearchField":{"clearButtonLabel":"Clear","search":"Search","placeholder":"Search actions"}},"Avatar":{"label":"Avatar","labelWithInitials":"Avatar with initials {initials}"},"Autocomplete":{"spinnerAccessibilityLabel":"Loading","ellipsis":"{content}…"},"Badge":{"PROGRESS_LABELS":{"incomplete":"Incomplete","partiallyComplete":"Partially complete","complete":"Complete"},"TONE_LABELS":{"info":"Info","success":"Success","warning":"Warning","critical":"Critical","attention":"Attention","new":"New","readOnly":"Read-only","enabled":"Enabled"},"progressAndTone":"{toneLabel} {progressLabel}"},"Banner":{"dismissButton":"Dismiss notification"},"Button":{"spinnerAccessibilityLabel":"Loading"},"Common":{"checkbox":"checkbox","undo":"Undo","cancel":"Cancel","clear":"Clear","close":"Close","submit":"Submit","more":"More"},"ContextualSaveBar":{"save":"Save","discard":"Discard"},"DataTable":{"sortAccessibilityLabel":"sort {direction} by","navAccessibilityLabel":"Scroll table {direction} one column","totalsRowHeading":"Totals","totalRowHeading":"Total"},"DatePicker":{"previousMonth":"Show previous month, {previousMonthName} {showPreviousYear}","nextMonth":"Show next month, {nextMonth} {nextYear}","today":"Today ","start":"Start of range","end":"End of range","months":{"january":"January","february":"February","march":"March","april":"April","may":"May","june":"June","july":"July","august":"August","september":"September","october":"October","november":"November","december":"December"},"days":{"monday":"Monday","tuesday":"Tuesday","wednesday":"Wednesday","thursday":"Thursday","friday":"Friday","saturday":"Saturday","sunday":"Sunday"},"daysAbbreviated":{"monday":"Mo","tuesday":"Tu","wednesday":"We","thursday":"Th","friday":"Fr","saturday":"Sa","sunday":"Su"}},"DiscardConfirmationModal":{"title":"Discard all unsaved changes","message":"If you discard changes, you’ll delete any edits you made since you last saved.","primaryAction":"Discard changes","secondaryAction":"Continue editing"},"DropZone":{"single":{"overlayTextFile":"Drop file to upload","overlayTextImage":"Drop image to upload","overlayTextVideo":"Drop video to upload","actionTitleFile":"Add file","actionTitleImage":"Add image","actionTitleVideo":"Add video","actionHintFile":"or drop file to upload","actionHintImage":"or drop image to upload","actionHintVideo":"or drop video to upload","labelFile":"Upload file","labelImage":"Upload image","labelVideo":"Upload video"},"allowMultiple":{"overlayTextFile":"Drop files to upload","overlayTextImage":"Drop images to upload","overlayTextVideo":"Drop videos to upload","actionTitleFile":"Add files","actionTitleImage":"Add images","actionTitleVideo":"Add videos","actionHintFile":"or drop files to upload","actionHintImage":"or drop images to upload","actionHintVideo":"or drop videos to upload","labelFile":"Upload files","labelImage":"Upload images","labelVideo":"Upload videos"},"errorOverlayTextFile":"File type is not valid","errorOverlayTextImage":"Image type is not valid","errorOverlayTextVideo":"Video type is not valid"},"EmptySearchResult":{"altText":"Empty search results"},"Frame":{"skipToContent":"Skip to content","navigationLabel":"Navigation","Navigation":{"closeMobileNavigationLabel":"Close navigation"}},"FullscreenBar":{"back":"Back","accessibilityLabel":"Exit fullscreen mode"},"Filters":{"moreFilters":"More filters","moreFiltersWithCount":"More filters ({count})","filter":"Filter {resourceName}","noFiltersApplied":"No filters applied","cancel":"Cancel","done":"Done","clearAllFilters":"Clear all filters","clear":"Clear","clearLabel":"Clear {filterName}","addFilter":"Add filter","clearFilters":"Clear all","searchInView":"in:{viewName}"},"FilterPill":{"clear":"Clear","unsavedChanges":"Unsaved changes - {label}"},"IndexFilters":{"searchFilterTooltip":"Search and filter","searchFilterTooltipWithShortcut":"Search and filter (F)","searchFilterAccessibilityLabel":"Search and filter results","sort":"Sort your results","addView":"Add a new view","newView":"Custom search","SortButton":{"ariaLabel":"Sort the results","tooltip":"Sort","title":"Sort by","sorting":{"asc":"Ascending","desc":"Descending","az":"A-Z","za":"Z-A"}},"EditColumnsButton":{"tooltip":"Edit columns","accessibilityLabel":"Customize table column order and visibility"},"UpdateButtons":{"cancel":"Cancel","update":"Update","save":"Save","saveAs":"Save as","modal":{"title":"Save view as","label":"Name","sameName":"A view with this name already exists. Please choose a different name.","save":"Save","cancel":"Cancel"}}},"IndexProvider":{"defaultItemSingular":"Item","defaultItemPlural":"Items","allItemsSelected":"All {itemsLength}+ {resourceNamePlural} are selected","selected":"{selectedItemsCount} selected","a11yCheckboxDeselectAllSingle":"Deselect {resourceNameSingular}","a11yCheckboxSelectAllSingle":"Select {resourceNameSingular}","a11yCheckboxDeselectAllMultiple":"Deselect all {itemsLength} {resourceNamePlural}","a11yCheckboxSelectAllMultiple":"Select all {itemsLength} {resourceNamePlural}"},"IndexTable":{"emptySearchTitle":"No {resourceNamePlural} found","emptySearchDescription":"Try changing the filters or search term","onboardingBadgeText":"New","resourceLoadingAccessibilityLabel":"Loading {resourceNamePlural}…","selectAllLabel":"Select all {resourceNamePlural}","selected":"{selectedItemsCount} selected","undo":"Undo","selectAllItems":"Select all {itemsLength}+ {resourceNamePlural}","selectItem":"Select {resourceName}","selectButtonText":"Select","sortAccessibilityLabel":"sort {direction} by"},"Loading":{"label":"Page loading bar"},"Modal":{"iFrameTitle":"body markup","modalWarning":"These required properties are missing from Modal: {missingProps}"},"Page":{"Header":{"rollupActionsLabel":"View actions for {title}","pageReadyAccessibilityLabel":"{title}. This page is ready"}},"Pagination":{"previous":"Previous","next":"Next","pagination":"Pagination"},"ProgressBar":{"negativeWarningMessage":"Values passed to the progress prop shouldn’t be negative. Resetting {progress} to 0.","exceedWarningMessage":"Values passed to the progress prop shouldn’t exceed 100. Setting {progress} to 100."},"ResourceList":{"sortingLabel":"Sort by","defaultItemSingular":"item","defaultItemPlural":"items","showing":"Showing {itemsCount} {resource}","showingTotalCount":"Showing {itemsCount} of {totalItemsCount} {resource}","loading":"Loading {resource}","selected":"{selectedItemsCount} selected","allItemsSelected":"All {itemsLength}+ {resourceNamePlural} in your store are selected","allFilteredItemsSelected":"All {itemsLength}+ {resourceNamePlural} in this filter are selected","selectAllItems":"Select all {itemsLength}+ {resourceNamePlural} in your store","selectAllFilteredItems":"Select all {itemsLength}+ {resourceNamePlural} in this filter","emptySearchResultTitle":"No {resourceNamePlural} found","emptySearchResultDescription":"Try changing the filters or search term","selectButtonText":"Select","a11yCheckboxDeselectAllSingle":"Deselect {resourceNameSingular}","a11yCheckboxSelectAllSingle":"Select {resourceNameSingular}","a11yCheckboxDeselectAllMultiple":"Deselect all {itemsLength} {resourceNamePlural}","a11yCheckboxSelectAllMultiple":"Select all {itemsLength} {resourceNamePlural}","Item":{"actionsDropdownLabel":"Actions for {accessibilityLabel}","actionsDropdown":"Actions dropdown","viewItem":"View details for {itemName}"},"BulkActions":{"actionsActivatorLabel":"Actions","moreActionsActivatorLabel":"More actions"}},"SkeletonPage":{"loadingLabel":"Page loading"},"Tabs":{"newViewAccessibilityLabel":"Create new view","newViewTooltip":"Create view","toggleTabsLabel":"More views","Tab":{"rename":"Rename view","duplicate":"Duplicate view","edit":"Edit view","editColumns":"Edit columns","delete":"Delete view","copy":"Copy of {name}","deleteModal":{"title":"Delete view?","description":"This can’t be undone. {viewName} view will no longer be available in your admin.","cancel":"Cancel","delete":"Delete view"}},"RenameModal":{"title":"Rename view","label":"Name","cancel":"Cancel","create":"Save","errors":{"sameName":"A view with this name already exists. Please choose a different name."}},"DuplicateModal":{"title":"Duplicate view","label":"Name","cancel":"Cancel","create":"Create view","errors":{"sameName":"A view with this name already exists. Please choose a different name."}},"CreateViewModal":{"title":"Create new view","label":"Name","cancel":"Cancel","create":"Create view","errors":{"sameName":"A view with this name already exists. Please choose a different name."}}},"Tag":{"ariaLabel":"Remove {children}"},"TextField":{"characterCount":"{count} characters","characterCountWithMaxLength":"{count} of {limit} characters used"},"TooltipOverlay":{"accessibilityLabel":"Tooltip: {label}"},"TopBar":{"toggleMenuLabel":"Toggle menu","SearchField":{"clearButtonLabel":"Clear","search":"Search"}},"MediaCard":{"dismissButton":"Dismiss","popoverButton":"Actions"},"VideoThumbnail":{"playButtonA11yLabel":{"default":"Play video","defaultWithDuration":"Play video of length {duration}","duration":{"hours":{"other":{"only":"{hourCount} hours","andMinutes":"{hourCount} hours and {minuteCount} minutes","andMinute":"{hourCount} hours and {minuteCount} minute","minutesAndSeconds":"{hourCount} hours, {minuteCount} minutes, and {secondCount} seconds","minutesAndSecond":"{hourCount} hours, {minuteCount} minutes, and {secondCount} second","minuteAndSeconds":"{hourCount} hours, {minuteCount} minute, and {secondCount} seconds","minuteAndSecond":"{hourCount} hours, {minuteCount} minute, and {secondCount} second","andSeconds":"{hourCount} hours and {secondCount} seconds","andSecond":"{hourCount} hours and {secondCount} second"},"one":{"only":"{hourCount} hour","andMinutes":"{hourCount} hour and {minuteCount} minutes","andMinute":"{hourCount} hour and {minuteCount} minute","minutesAndSeconds":"{hourCount} hour, {minuteCount} minutes, and {secondCount} seconds","minutesAndSecond":"{hourCount} hour, {minuteCount} minutes, and {secondCount} second","minuteAndSeconds":"{hourCount} hour, {minuteCount} minute, and {secondCount} seconds","minuteAndSecond":"{hourCount} hour, {minuteCount} minute, and {secondCount} second","andSeconds":"{hourCount} hour and {secondCount} seconds","andSecond":"{hourCount} hour and {secondCount} second"}},"minutes":{"other":{"only":"{minuteCount} minutes","andSeconds":"{minuteCount} minutes and {secondCount} seconds","andSecond":"{minuteCount} minutes and {secondCount} second"},"one":{"only":"{minuteCount} minute","andSeconds":"{minuteCount} minute and {secondCount} seconds","andSecond":"{minuteCount} minute and {secondCount} second"}},"seconds":{"other":"{secondCount} seconds","one":"{secondCount} second"}}}}}');
const polarisTranslations = {
  Polaris
};
const polarisStyles = "/assets/styles-BeiPL2RV.css";
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const links = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$7 = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return { errors, polarisTranslations };
};
const action$2 = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, { i18n: loaderData.polarisTranslations, children: /* @__PURE__ */ jsx(Page, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(FormLayout, { children: [
    /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Log in" }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        type: "text",
        name: "shop",
        label: "Shop domain",
        helpText: "example.myshopify.com",
        value: shop,
        onChange: setShop,
        autoComplete: "on",
        error: errors.shop
      }
    ),
    /* @__PURE__ */ jsx(Button, { submit: true, children: "Log in" })
  ] }) }) }) }) });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: Auth,
  links,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_12o3y_1";
const heading = "_heading_12o3y_11";
const text = "_text_12o3y_12";
const content = "_content_12o3y_22";
const form = "_form_12o3y_27";
const label = "_label_12o3y_35";
const input = "_input_12o3y_43";
const button = "_button_12o3y_47";
const list = "_list_12o3y_51";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$6 = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};
function App$1() {
  const { showForm } = useLoaderData();
  return /* @__PURE__ */ jsx("div", { className: styles.index, children: /* @__PURE__ */ jsxs("div", { className: styles.content, children: [
    /* @__PURE__ */ jsx("h1", { className: styles.heading, children: "A short heading about [your app]" }),
    /* @__PURE__ */ jsx("p", { className: styles.text, children: "A tagline about [your app] that describes your value proposition." }),
    showForm && /* @__PURE__ */ jsxs(Form, { className: styles.form, method: "post", action: "/auth/login", children: [
      /* @__PURE__ */ jsxs("label", { className: styles.label, children: [
        /* @__PURE__ */ jsx("span", { children: "Shop domain" }),
        /* @__PURE__ */ jsx("input", { className: styles.input, type: "text", name: "shop" }),
        /* @__PURE__ */ jsx("span", { children: "e.g: my-shop-domain.myshopify.com" })
      ] }),
      /* @__PURE__ */ jsx("button", { className: styles.button, type: "submit", children: "Log in" })
    ] }),
    /* @__PURE__ */ jsxs("ul", { className: styles.list, children: [
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] })
    ] })
  ] }) });
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$1,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const loader$5 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const loader$4 = async ({ request }) => {
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};
function App() {
  const { apiKey } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider$1, { isEmbeddedApp: true, apiKey, children: [
    /* @__PURE__ */ jsxs("ui-nav-menu", { children: [
      /* @__PURE__ */ jsx(Link, { to: "/app/dashboard", rel: "home", children: "Dashboard" }),
      /* @__PURE__ */ jsx(Link, { to: "/app/selling-plans", children: "Selling Plans" }),
      /* @__PURE__ */ jsx(Link, { to: "/app/orders", children: "Orders" }),
      /* @__PURE__ */ jsx(Link, { to: "/app/settings", children: "Settings" })
    ] }),
    /* @__PURE__ */ jsx(Outlet, {})
  ] });
}
function ErrorBoundary() {
  const error = useRouteError();
  return /* @__PURE__ */ jsxs("div", { style: { padding: "20px" }, children: [
    /* @__PURE__ */ jsx("h1", { children: "Application Error" }),
    /* @__PURE__ */ jsx("p", { children: "Something went wrong. Please try again." }),
    process.env.NODE_ENV === "development" && /* @__PURE__ */ jsx("pre", { style: { background: "#f5f5f5", padding: "10px", marginTop: "10px" }, children: error instanceof Error ? error.stack : JSON.stringify(error) })
  ] });
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: App,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const CREATE_SELLING_PLAN_MUTATION = `
  mutation createDepositSellingPlanGroup($input: SellingPlanGroupInput!) {
    sellingPlanGroupCreate(input: $input) {
      sellingPlanGroup {
        id
        name
        merchantCode
        description
        sellingPlans(first: 5) {
          edges {
            node {
              id
              name
              category
              description
              billingPolicy {
                ... on SellingPlanFixedBillingPolicy {
                  checkoutCharge {
                    type
                    value {
                      ... on SellingPlanCheckoutChargePercentageValue {
                        percentage
                      }
                    }
                  }
                  remainingBalanceChargeTrigger
                  remainingBalanceChargeTimeAfterCheckout
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
const UPDATE_SELLING_PLAN_MUTATION = `
  mutation updateSellingPlanGroup($id: ID!, $input: SellingPlanGroupInput!) {
    sellingPlanGroupUpdate(id: $id, input: $input) {
      sellingPlanGroup {
        id
        name
        merchantCode
        description
      }
      userErrors {
        field
        message
      }
    }
  }
`;
const DELETE_SELLING_PLAN_MUTATION = `
  mutation deleteSellingPlanGroup($id: ID!) {
    sellingPlanGroupDelete(id: $id) {
      userErrors {
        field
        message
      }
    }
  }
`;
const GET_SELLING_PLANS_QUERY = `
  query getSellingPlans {
    sellingPlanGroups(first: 20) {
      edges {
        node {
          id
          name
          merchantCode
          description
          sellingPlans(first: 5) {
            edges {
              node {
                id
                name
                category
                description
                billingPolicy {
                  ... on SellingPlanFixedBillingPolicy {
                    checkoutCharge {
                      type
                      value {
                        ... on SellingPlanCheckoutChargePercentageValue {
                          percentage
                        }
                      }
                    }
                    remainingBalanceChargeTrigger
                    remainingBalanceChargeTimeAfterCheckout
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
const loader$3 = async ({ request }) => {
  var _a2, _b;
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const response = await admin.graphql(GET_SELLING_PLANS_QUERY);
  const shopifyData = await response.json();
  const dbPlans = await getDepositPlansByShop(shop);
  return json({
    sellingPlanGroups: ((_b = (_a2 = shopifyData.data) == null ? void 0 : _a2.sellingPlanGroups) == null ? void 0 : _b.edges) || [],
    dbPlans,
    shop
  });
};
function parseDaysFromTimeString(timeString) {
  const match = timeString == null ? void 0 : timeString.match(/P(\d+)D/);
  return match ? parseInt(match[1]) : 365;
}
const action$1 = async ({ request }) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  if (actionType === "create_selling_plan") {
    const planName = formData.get("planName");
    const depositPercentage = parseFloat(formData.get("depositPercentage"));
    const balanceDueDays = parseInt(formData.get("balanceDueDays"));
    const description = formData.get("description");
    const merchantCode = formData.get("merchantCode");
    const variables = {
      input: {
        name: planName,
        merchantCode,
        description,
        options: ["Deposit Payment"],
        sellingPlansToCreate: [
          {
            name: `${depositPercentage}% Deposit - Balance Due Later`,
            description,
            options: `Pay ${depositPercentage}% now, ${100 - depositPercentage}% later`,
            category: "PRE_ORDER",
            billingPolicy: {
              fixed: {
                checkoutCharge: {
                  type: "PERCENTAGE",
                  value: {
                    percentage: depositPercentage
                  }
                },
                remainingBalanceChargeTrigger: "TIME_AFTER_CHECKOUT",
                remainingBalanceChargeTimeAfterCheckout: `P${balanceDueDays}D`
              }
            },
            inventoryPolicy: {
              reserve: "ON_SALE"
            },
            deliveryPolicy: {
              fixed: {
                fulfillmentTrigger: "ASAP"
              }
            }
          }
        ]
      }
    };
    try {
      const response = await admin.graphql(CREATE_SELLING_PLAN_MUTATION, { variables });
      const result = await response.json();
      if (((_c = (_b = (_a2 = result.data) == null ? void 0 : _a2.sellingPlanGroupCreate) == null ? void 0 : _b.userErrors) == null ? void 0 : _c.length) > 0) {
        return json({
          success: false,
          errors: result.data.sellingPlanGroupCreate.userErrors
        });
      }
      const sellingPlanGroup = result.data.sellingPlanGroupCreate.sellingPlanGroup;
      const sellingPlan = sellingPlanGroup.sellingPlans.edges[0].node;
      const sellingPlanId = sellingPlan.id.split("/").pop();
      try {
        await createDepositPlan({
          shopDomain: session.shop,
          sellingPlanId,
          sellingPlanGid: sellingPlan.id,
          groupId: sellingPlanGroup.id,
          planName,
          merchantCode,
          description,
          depositPercent: depositPercentage,
          balanceDueDays
        });
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }
      return json({
        success: true,
        message: "Selling plan created successfully!",
        sellingPlan: sellingPlanGroup
      });
    } catch (error) {
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }
  if (actionType === "update_selling_plan") {
    const planId = formData.get("planId");
    const planName = formData.get("planName");
    const description = formData.get("description");
    const merchantCode = formData.get("merchantCode");
    const variables = {
      id: planId,
      input: {
        name: planName,
        merchantCode,
        description
      }
    };
    try {
      const response = await admin.graphql(UPDATE_SELLING_PLAN_MUTATION, { variables });
      const result = await response.json();
      if (((_f = (_e = (_d = result.data) == null ? void 0 : _d.sellingPlanGroupUpdate) == null ? void 0 : _e.userErrors) == null ? void 0 : _f.length) > 0) {
        return json({
          success: false,
          errors: result.data.sellingPlanGroupUpdate.userErrors
        });
      }
      return json({
        success: true,
        message: "Selling plan updated successfully!",
        sellingPlan: result.data.sellingPlanGroupUpdate.sellingPlanGroup
      });
    } catch (error) {
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }
  if (actionType === "delete_selling_plan") {
    const planId = formData.get("planId");
    try {
      const response = await admin.graphql(DELETE_SELLING_PLAN_MUTATION, {
        variables: { id: planId }
      });
      const result = await response.json();
      if (((_i = (_h = (_g = result.data) == null ? void 0 : _g.sellingPlanGroupDelete) == null ? void 0 : _h.userErrors) == null ? void 0 : _i.length) > 0) {
        return json({
          success: false,
          errors: result.data.sellingPlanGroupDelete.userErrors
        });
      }
      return json({
        success: true,
        message: "Selling plan deleted successfully!",
        planId
        // Return the planId for reference
      });
    } catch (error) {
      return json({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : "Unknown error" }]
      });
    }
  }
  return json({ success: false, errors: [{ message: "Unknown action" }] });
};
function SellingPlans() {
  const { sellingPlanGroups } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [formData, setFormData] = useState({
    planName: "Tour Deposit Plan",
    depositPercentage: "15",
    balanceDueDays: "60",
    description: "Pay deposit today, balance due before tour",
    merchantCode: "tour-deposit"
  });
  const isLoading = navigation.state === "submitting";
  const handleCreatePlan = useCallback(() => {
    const data = new FormData();
    data.set("_action", "create_selling_plan");
    data.set("planName", formData.planName);
    data.set("depositPercentage", formData.depositPercentage);
    data.set("balanceDueDays", formData.balanceDueDays);
    data.set("description", formData.description);
    data.set("merchantCode", formData.merchantCode);
    submit(data, { method: "post" });
    setShowCreateModal(false);
  }, [formData, submit]);
  const handleEditPlan = useCallback(() => {
    if (!selectedPlan) return;
    const data = new FormData();
    data.set("_action", "update_selling_plan");
    data.set("planId", selectedPlan.id);
    data.set("planName", formData.planName);
    data.set("description", formData.description);
    data.set("merchantCode", formData.merchantCode);
    submit(data, { method: "post" });
    setShowEditModal(false);
    setSelectedPlan(null);
  }, [formData, selectedPlan, submit]);
  const handleDeletePlan = useCallback(() => {
    if (!selectedPlan) return;
    const data = new FormData();
    data.set("_action", "delete_selling_plan");
    data.set("planId", selectedPlan.id);
    submit(data, { method: "post" });
    setShowDeleteModal(false);
    setSelectedPlan(null);
  }, [selectedPlan, submit]);
  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);
  const openEditModal = useCallback((plan) => {
    var _a2, _b, _c, _d, _e;
    setSelectedPlan(plan);
    const sellingPlan = (_a2 = plan.sellingPlans.edges[0]) == null ? void 0 : _a2.node;
    const percentage = ((_d = (_c = (_b = sellingPlan == null ? void 0 : sellingPlan.billingPolicy) == null ? void 0 : _b.checkoutCharge) == null ? void 0 : _c.value) == null ? void 0 : _d.percentage) || 15;
    const days = parseDaysFromTimeString(((_e = sellingPlan == null ? void 0 : sellingPlan.billingPolicy) == null ? void 0 : _e.remainingBalanceChargeTimeAfterCheckout) || "P60D");
    setFormData({
      planName: plan.name,
      depositPercentage: percentage.toString(),
      balanceDueDays: days.toString(),
      description: plan.description || "",
      merchantCode: plan.merchantCode
    });
    setShowEditModal(true);
  }, []);
  const openDeleteModal = useCallback((plan) => {
    setSelectedPlan(plan);
    setShowDeleteModal(true);
  }, []);
  return /* @__PURE__ */ jsxs(
    Page,
    {
      title: "Selling Plans",
      subtitle: "Manage deposit payment plans for your products",
      primaryAction: /* @__PURE__ */ jsx(
        Button,
        {
          variant: "primary",
          onClick: () => setShowCreateModal(true),
          children: "Create Selling Plan"
        }
      ),
      children: [
        /* @__PURE__ */ jsxs(Layout, { children: [
          (actionData == null ? void 0 : actionData.success) && /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Banner, { tone: "success", children: actionData.message }) }),
          (actionData == null ? void 0 : actionData.errors) && /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(Banner, { tone: "critical", children: [
            /* @__PURE__ */ jsx("p", { children: "Error:" }),
            /* @__PURE__ */ jsx("ul", { children: actionData.errors.map((error, index2) => /* @__PURE__ */ jsx("li", { children: error.message }, index2)) })
          ] }) }),
          /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: sellingPlanGroups.length > 0 ? /* @__PURE__ */ jsx(
            ResourceList,
            {
              items: sellingPlanGroups,
              renderItem: (item) => {
                var _a2, _b, _c, _d, _e;
                const { node } = item;
                const sellingPlan = (_a2 = node.sellingPlans.edges[0]) == null ? void 0 : _a2.node;
                const percentage = (_d = (_c = (_b = sellingPlan == null ? void 0 : sellingPlan.billingPolicy) == null ? void 0 : _b.checkoutCharge) == null ? void 0 : _c.value) == null ? void 0 : _d.percentage;
                return /* @__PURE__ */ jsx(
                  ResourceItem,
                  {
                    id: node.id,
                    shortcutActions: [
                      {
                        content: "Edit",
                        onAction: () => openEditModal(node)
                      },
                      {
                        content: "Delete",
                        destructive: true,
                        onAction: () => openDeleteModal(node)
                      }
                    ],
                    children: /* @__PURE__ */ jsx("div", { style: { padding: "12px 0" }, children: /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                      /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                        /* @__PURE__ */ jsx(Text, { as: "h3", variant: "bodyLg", fontWeight: "bold", children: node.name }),
                        /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", tone: "subdued", children: node.description || "No description" }),
                        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                          "Code: ",
                          node.merchantCode
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs(BlockStack, { gap: "100", align: "end", children: [
                        /* @__PURE__ */ jsx(Badge, { tone: percentage ? "success" : "attention", children: percentage ? `${percentage}% Deposit` : (sellingPlan == null ? void 0 : sellingPlan.category) || "Unknown" }),
                        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                          "ID: ",
                          (_e = sellingPlan == null ? void 0 : sellingPlan.id) == null ? void 0 : _e.split("/").pop()
                        ] })
                      ] })
                    ] }) })
                  }
                );
              }
            }
          ) : /* @__PURE__ */ jsx(Box, { padding: "800", children: /* @__PURE__ */ jsxs("div", { style: { textAlign: "center" }, children: [
            /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyLg", children: "No selling plans found" }),
            /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", tone: "subdued", children: "Create your first deposit plan to get started" })
          ] }) }) }) })
        ] }),
        /* @__PURE__ */ jsx(
          Modal,
          {
            open: showCreateModal,
            onClose: () => setShowCreateModal(false),
            title: "Create New Selling Plan",
            primaryAction: {
              content: "Create Plan",
              onAction: handleCreatePlan,
              loading: isLoading
            },
            secondaryActions: [
              {
                content: "Cancel",
                onAction: () => setShowCreateModal(false)
              }
            ],
            children: /* @__PURE__ */ jsxs(Modal.Section, { children: [
              /* @__PURE__ */ jsxs(FormLayout, { children: [
                /* @__PURE__ */ jsx(
                  TextField,
                  {
                    label: "Plan Name",
                    value: formData.planName,
                    onChange: (value) => handleFormChange("planName", value),
                    helpText: "Enter a descriptive name for your selling plan"
                  }
                ),
                /* @__PURE__ */ jsx(
                  TextField,
                  {
                    label: "Deposit Percentage",
                    type: "number",
                    value: formData.depositPercentage,
                    onChange: (value) => handleFormChange("depositPercentage", value),
                    suffix: "%",
                    min: "1",
                    max: "99",
                    helpText: "Percentage to charge as deposit (1-99%)"
                  }
                ),
                /* @__PURE__ */ jsx(
                  Select,
                  {
                    label: "Balance Due After",
                    options: [
                      { label: "30 days", value: "30" },
                      { label: "60 days", value: "60" },
                      { label: "90 days", value: "90" },
                      { label: "6 months", value: "180" },
                      { label: "1 year", value: "365" }
                    ],
                    value: formData.balanceDueDays,
                    onChange: (value) => handleFormChange("balanceDueDays", value),
                    helpText: "When should the remaining balance be charged?"
                  }
                ),
                /* @__PURE__ */ jsx(
                  TextField,
                  {
                    label: "Description",
                    value: formData.description,
                    onChange: (value) => handleFormChange("description", value),
                    multiline: 2,
                    helpText: "Description shown to customers"
                  }
                ),
                /* @__PURE__ */ jsx(
                  TextField,
                  {
                    label: "Merchant Code",
                    value: formData.merchantCode,
                    onChange: (value) => handleFormChange("merchantCode", value),
                    helpText: "Internal code for this plan (lowercase, no spaces)"
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(Box, { paddingBlockStart: "400", children: /* @__PURE__ */ jsx(Card, { background: "bg-surface-info", children: /* @__PURE__ */ jsx(Box, { padding: "400", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
                /* @__PURE__ */ jsx(Text, { as: "h4", variant: "headingSm", children: "Preview" }),
                /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: /* @__PURE__ */ jsx("strong", { children: "Customer will see:" }) }),
                /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", children: [
                  "• Due today: ",
                  formData.depositPercentage,
                  "% deposit"
                ] }),
                /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", children: [
                  "• Due later: ",
                  100 - parseInt(formData.depositPercentage || "0"),
                  "% balance in ",
                  formData.balanceDueDays,
                  " days"
                ] })
              ] }) }) }) })
            ] })
          }
        ),
        /* @__PURE__ */ jsxs(
          Modal,
          {
            open: showEditModal,
            onClose: () => {
              setShowEditModal(false);
              setSelectedPlan(null);
            },
            title: "Edit Selling Plan",
            primaryAction: {
              content: "Update Plan",
              onAction: handleEditPlan,
              loading: isLoading
            },
            secondaryActions: [
              {
                content: "Cancel",
                onAction: () => {
                  setShowEditModal(false);
                  setSelectedPlan(null);
                }
              }
            ],
            children: [
              /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsx(Banner, { tone: "info", children: /* @__PURE__ */ jsx("p", { children: "Note: Editing a selling plan will update its display name and description, but won't affect existing orders or the deposit percentage." }) }) }),
              /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsxs(FormLayout, { children: [
                /* @__PURE__ */ jsx(
                  TextField,
                  {
                    label: "Plan Name",
                    value: formData.planName,
                    onChange: (value) => handleFormChange("planName", value),
                    helpText: "Enter a descriptive name for your selling plan"
                  }
                ),
                /* @__PURE__ */ jsx(
                  TextField,
                  {
                    label: "Description",
                    value: formData.description,
                    onChange: (value) => handleFormChange("description", value),
                    multiline: 2,
                    helpText: "Description shown to customers"
                  }
                ),
                /* @__PURE__ */ jsx(
                  TextField,
                  {
                    label: "Merchant Code",
                    value: formData.merchantCode,
                    onChange: (value) => handleFormChange("merchantCode", value),
                    helpText: "Internal code for this plan (lowercase, no spaces)"
                  }
                )
              ] }) })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          Modal,
          {
            open: showDeleteModal,
            onClose: () => {
              setShowDeleteModal(false);
              setSelectedPlan(null);
            },
            title: "Delete Selling Plan",
            primaryAction: {
              content: "Delete Plan",
              onAction: handleDeletePlan,
              loading: isLoading,
              destructive: true
            },
            secondaryActions: [
              {
                content: "Cancel",
                onAction: () => {
                  setShowDeleteModal(false);
                  setSelectedPlan(null);
                }
              }
            ],
            children: [
              /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsx(Banner, { tone: "critical", children: /* @__PURE__ */ jsxs("p", { children: [
                /* @__PURE__ */ jsx("strong", { children: "Warning:" }),
                " This action cannot be undone."
              ] }) }) }),
              /* @__PURE__ */ jsxs(Modal.Section, { children: [
                /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
                  'Are you sure you want to delete "',
                  /* @__PURE__ */ jsx("strong", { children: selectedPlan == null ? void 0 : selectedPlan.name }),
                  '"?'
                ] }),
                /* @__PURE__ */ jsx(Box, { paddingBlockStart: "200", children: /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", tone: "subdued", children: "This will permanently delete the selling plan and it will no longer be available for new purchases. Existing orders will not be affected." }) })
              ] })
            ]
          }
        )
      ]
    }
  );
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: SellingPlans,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
function AdditionalPage() {
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Additional page" }),
    /* @__PURE__ */ jsxs(Layout, { children: [
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
          "The app template comes with an additional page which demonstrates how to create multiple pages within app navigation using",
          " ",
          /* @__PURE__ */ jsx(
            Link$1,
            {
              url: "https://shopify.dev/docs/apps/tools/app-bridge",
              target: "_blank",
              removeUnderline: true,
              children: "App Bridge"
            }
          ),
          "."
        ] }),
        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
          "To create your own page and have it show up in the app navigation, add a page inside ",
          /* @__PURE__ */ jsx(Code, { children: "app/routes" }),
          ", and a link to it in the ",
          /* @__PURE__ */ jsx(Code, { children: "<NavMenu>" }),
          " component found in ",
          /* @__PURE__ */ jsx(Code, { children: "app/routes/app.jsx" }),
          "."
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Resources" }),
        /* @__PURE__ */ jsx(List, { children: /* @__PURE__ */ jsx(List.Item, { children: /* @__PURE__ */ jsx(
          Link$1,
          {
            url: "https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav",
            target: "_blank",
            removeUnderline: true,
            children: "App nav best practices"
          }
        ) }) })
      ] }) }) })
    ] })
  ] });
}
function Code({ children }) {
  return /* @__PURE__ */ jsx(
    Box,
    {
      as: "span",
      padding: "025",
      paddingInlineStart: "100",
      paddingInlineEnd: "100",
      background: "bg-surface-active",
      borderWidth: "025",
      borderColor: "border",
      borderRadius: "100",
      children: /* @__PURE__ */ jsx("code", { children })
    }
  );
}
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: AdditionalPage
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async ({ request }) => {
  var _a2, _b;
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(`
    query getSellingPlans {
      sellingPlanGroups(first: 10) {
        edges {
          node {
            id
            name
            merchantCode
            sellingPlans(first: 5) {
              edges {
                node {
                  id
                  name
                  category
                }
              }
            }
          }
        }
      }
    }
  `);
  const data = await response.json();
  return json({
    sellingPlanGroups: ((_b = (_a2 = data.data) == null ? void 0 : _a2.sellingPlanGroups) == null ? void 0 : _b.edges) || []
  });
};
function Dashboard() {
  const { sellingPlanGroups } = useLoaderData();
  return /* @__PURE__ */ jsx(
    Page,
    {
      title: "Deposit System Dashboard",
      subtitle: "Manage your deposit payment plans",
      children: /* @__PURE__ */ jsxs(Layout, { children: [
        /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Banner, { tone: "success", children: /* @__PURE__ */ jsx("p", { children: "Welcome to Deposit System Pro! Your deposit system is ready to configure." }) }) }),
        /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Box, { padding: "400", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Current Selling Plans" }),
          sellingPlanGroups.length > 0 ? /* @__PURE__ */ jsx(BlockStack, { gap: "200", children: sellingPlanGroups.map(({ node }, index2) => {
            var _a2, _b;
            return /* @__PURE__ */ jsx(
              Box,
              {
                padding: "300",
                background: "bg-surface-secondary",
                borderRadius: "200",
                children: /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                  /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                    /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", fontWeight: "bold", children: node.name }),
                    /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", tone: "subdued", children: [
                      "Code: ",
                      node.merchantCode
                    ] }),
                    /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                      "Plan ID: ",
                      (_a2 = node.sellingPlans.edges[0]) == null ? void 0 : _a2.node.id.split("/").pop()
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx(Badge, { children: ((_b = node.sellingPlans.edges[0]) == null ? void 0 : _b.node.category) || "Unknown" })
                ] })
              },
              node.id
            );
          }) }) : /* @__PURE__ */ jsx(
            Box,
            {
              padding: "800",
              background: "bg-surface-secondary",
              borderRadius: "200",
              children: /* @__PURE__ */ jsx("div", { style: { textAlign: "center" }, children: /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", tone: "subdued", children: "No selling plans found. Let's create your first deposit plan!" }) })
            }
          )
        ] }) }) }) }),
        /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Box, { padding: "400", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Quick Actions" }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(
              Box,
              {
                padding: "300",
                background: "bg-fill-info",
                borderRadius: "200",
                children: /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                  /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
                    "🚀 ",
                    /* @__PURE__ */ jsx("strong", { children: "Next:" }),
                    " Create your first deposit selling plan"
                  ] }),
                  /* @__PURE__ */ jsx(Link, { to: "/app/selling-plans", children: /* @__PURE__ */ jsx(Button, { variant: "primary", children: "Create Plan" }) })
                ] })
              }
            ),
            /* @__PURE__ */ jsx(
              Box,
              {
                padding: "300",
                background: "bg-surface-secondary",
                borderRadius: "200",
                children: /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", tone: "subdued", children: "📊 Coming soon: Advanced analytics and reporting" })
              }
            )
          ] })
        ] }) }) }) }),
        /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Box, { padding: "400", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "System Status" }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(
              Box,
              {
                padding: "300",
                background: "bg-fill-success",
                borderRadius: "200",
                children: /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
                  "✅ ",
                  /* @__PURE__ */ jsx("strong", { children: "Selling Plans:" }),
                  " ",
                  sellingPlanGroups.length,
                  " active"
                ] })
              }
            ),
            /* @__PURE__ */ jsx(
              Box,
              {
                padding: "300",
                background: "bg-fill-success",
                borderRadius: "200",
                children: /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
                  "✅ ",
                  /* @__PURE__ */ jsx("strong", { children: "Database:" }),
                  " Connected and ready"
                ] })
              }
            )
          ] })
        ] }) }) }) })
      ] })
    }
  );
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Dashboard,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const loader$1 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][Math.floor(Math.random() * 4)];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`
        }
      }
    }
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }]
      }
    }
  );
  const variantResponseJson = await variantResponse.json();
  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants
  };
};
function Index() {
  var _a2, _b, _c, _d;
  const fetcher = useFetcher();
  const shopify2 = useAppBridge();
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  const productId = (_b = (_a2 = fetcher.data) == null ? void 0 : _a2.product) == null ? void 0 : _b.id.replace(
    "gid://shopify/Product/",
    ""
  );
  useEffect(() => {
    if (productId) {
      shopify2.toast.show("Product created");
    }
  }, [productId, shopify2]);
  const generateProduct = () => fetcher.submit({}, { method: "POST" });
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Remix app template", children: /* @__PURE__ */ jsx("button", { variant: "primary", onClick: generateProduct, children: "Generate a product" }) }),
    /* @__PURE__ */ jsx(BlockStack, { gap: "500", children: /* @__PURE__ */ jsxs(Layout, { children: [
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
        /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Congrats on creating a new Shopify app 🎉" }),
          /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", as: "p", children: [
            "This embedded app template uses",
            " ",
            /* @__PURE__ */ jsx(
              Link$1,
              {
                url: "https://shopify.dev/docs/apps/tools/app-bridge",
                target: "_blank",
                removeUnderline: true,
                children: "App Bridge"
              }
            ),
            " ",
            "interface examples like an",
            " ",
            /* @__PURE__ */ jsx(Link$1, { url: "/app/additional", removeUnderline: true, children: "additional page in the app nav" }),
            ", as well as an",
            " ",
            /* @__PURE__ */ jsx(
              Link$1,
              {
                url: "https://shopify.dev/docs/api/admin-graphql",
                target: "_blank",
                removeUnderline: true,
                children: "Admin GraphQL"
              }
            ),
            " ",
            "mutation demo, to provide a starting point for app development."
          ] })
        ] }),
        /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { as: "h3", variant: "headingMd", children: "Get started with products" }),
          /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
            "Generate a product with GraphQL and get the JSON output for that product. Learn more about the",
            " ",
            /* @__PURE__ */ jsx(
              Link$1,
              {
                url: "https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate",
                target: "_blank",
                removeUnderline: true,
                children: "productCreate"
              }
            ),
            " ",
            "mutation in our API references."
          ] })
        ] }),
        /* @__PURE__ */ jsxs(InlineStack, { gap: "300", children: [
          /* @__PURE__ */ jsx(Button, { loading: isLoading, onClick: generateProduct, children: "Generate a product" }),
          ((_c = fetcher.data) == null ? void 0 : _c.product) && /* @__PURE__ */ jsx(
            Button,
            {
              url: `shopify:admin/products/${productId}`,
              target: "_blank",
              variant: "plain",
              children: "View product"
            }
          )
        ] }),
        ((_d = fetcher.data) == null ? void 0 : _d.product) && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(Text, { as: "h3", variant: "headingMd", children: [
            " ",
            "productCreate mutation"
          ] }),
          /* @__PURE__ */ jsx(
            Box,
            {
              padding: "400",
              background: "bg-surface-active",
              borderWidth: "025",
              borderRadius: "200",
              borderColor: "border",
              overflowX: "scroll",
              children: /* @__PURE__ */ jsx("pre", { style: { margin: 0 }, children: /* @__PURE__ */ jsx("code", { children: JSON.stringify(fetcher.data.product, null, 2) }) })
            }
          ),
          /* @__PURE__ */ jsxs(Text, { as: "h3", variant: "headingMd", children: [
            " ",
            "productVariantsBulkUpdate mutation"
          ] }),
          /* @__PURE__ */ jsx(
            Box,
            {
              padding: "400",
              background: "bg-surface-active",
              borderWidth: "025",
              borderRadius: "200",
              borderColor: "border",
              overflowX: "scroll",
              children: /* @__PURE__ */ jsx("pre", { style: { margin: 0 }, children: /* @__PURE__ */ jsx("code", { children: JSON.stringify(fetcher.data.variant, null, 2) }) })
            }
          )
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "App template specs" }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
              /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "Framework" }),
              /* @__PURE__ */ jsx(
                Link$1,
                {
                  url: "https://remix.run",
                  target: "_blank",
                  removeUnderline: true,
                  children: "Remix"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
              /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "Database" }),
              /* @__PURE__ */ jsx(
                Link$1,
                {
                  url: "https://www.prisma.io/",
                  target: "_blank",
                  removeUnderline: true,
                  children: "Prisma"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
              /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "Interface" }),
              /* @__PURE__ */ jsxs("span", { children: [
                /* @__PURE__ */ jsx(
                  Link$1,
                  {
                    url: "https://polaris.shopify.com",
                    target: "_blank",
                    removeUnderline: true,
                    children: "Polaris"
                  }
                ),
                ", ",
                /* @__PURE__ */ jsx(
                  Link$1,
                  {
                    url: "https://shopify.dev/docs/apps/tools/app-bridge",
                    target: "_blank",
                    removeUnderline: true,
                    children: "App Bridge"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
              /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "API" }),
              /* @__PURE__ */ jsx(
                Link$1,
                {
                  url: "https://shopify.dev/docs/api/admin-graphql",
                  target: "_blank",
                  removeUnderline: true,
                  children: "GraphQL API"
                }
              )
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Next steps" }),
          /* @__PURE__ */ jsxs(List, { children: [
            /* @__PURE__ */ jsxs(List.Item, { children: [
              "Build an",
              " ",
              /* @__PURE__ */ jsxs(
                Link$1,
                {
                  url: "https://shopify.dev/docs/apps/getting-started/build-app-example",
                  target: "_blank",
                  removeUnderline: true,
                  children: [
                    " ",
                    "example app"
                  ]
                }
              ),
              " ",
              "to get started"
            ] }),
            /* @__PURE__ */ jsxs(List.Item, { children: [
              "Explore Shopify’s API with",
              " ",
              /* @__PURE__ */ jsx(
                Link$1,
                {
                  url: "https://shopify.dev/docs/apps/tools/graphiql-admin-api",
                  target: "_blank",
                  removeUnderline: true,
                  children: "GraphiQL"
                }
              )
            ] })
          ] })
        ] }) })
      ] }) })
    ] }) })
  ] });
}
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: Index,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const depositOrders = await getDepositOrdersByShop(session.shop);
  return json({
    depositOrders,
    shop: session.shop
  });
};
function Orders() {
  const { depositOrders } = useLoaderData();
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);
  };
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };
  const getBalanceStatus = (order) => {
    if (order.balancePaid) {
      return { tone: "success", text: "Paid" };
    }
    const dueDate = new Date(order.balanceDueDate);
    const now = /* @__PURE__ */ new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1e3 * 3600 * 24));
    if (daysUntilDue < 0) {
      return { tone: "critical", text: "Overdue" };
    } else if (daysUntilDue <= 7) {
      return { tone: "warning", text: "Due Soon" };
    } else {
      return { tone: "info", text: "Pending" };
    }
  };
  return /* @__PURE__ */ jsx(
    Page,
    {
      title: "Deposit Orders",
      subtitle: "Track and manage orders with deposit payments",
      children: /* @__PURE__ */ jsxs(Layout, { children: [
        /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: depositOrders.length > 0 ? /* @__PURE__ */ jsx(
          ResourceList,
          {
            items: depositOrders,
            renderItem: (order) => {
              var _a2;
              const balanceStatus = getBalanceStatus(order);
              return /* @__PURE__ */ jsx(
                ResourceItem,
                {
                  id: order.id,
                  url: `#order-${order.id}`,
                  children: /* @__PURE__ */ jsx("div", { style: { padding: "12px 0" }, children: /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                    /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                      /* @__PURE__ */ jsxs(Text, { as: "h3", variant: "bodyLg", fontWeight: "bold", children: [
                        "Order ",
                        order.orderNumber
                      ] }),
                      /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", tone: "subdued", children: [
                        "Customer: ",
                        order.customerEmail || "No email"
                      ] }),
                      /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                        "Plan: ",
                        (_a2 = order.plan) == null ? void 0 : _a2.planName
                      ] }),
                      /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                        "Created: ",
                        formatDate(order.createdAt)
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs(BlockStack, { gap: "100", align: "end", children: [
                      /* @__PURE__ */ jsx(Badge, { tone: balanceStatus.tone, children: balanceStatus.text }),
                      /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", fontWeight: "bold", children: [
                        "Total: ",
                        formatCurrency(order.totalAmount)
                      ] }),
                      /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                        "Deposit: ",
                        formatCurrency(order.depositAmount),
                        " ✓"
                      ] }),
                      /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                        "Balance: ",
                        formatCurrency(order.balanceAmount)
                      ] }),
                      /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
                        "Due: ",
                        formatDate(order.balanceDueDate)
                      ] })
                    ] })
                  ] }) })
                }
              );
            }
          }
        ) : /* @__PURE__ */ jsx(Box, { padding: "800", children: /* @__PURE__ */ jsxs("div", { style: { textAlign: "center" }, children: [
          /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyLg", children: "No deposit orders found" }),
          /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", tone: "subdued", children: "Orders with deposit payments will appear here automatically" })
        ] }) }) }) }),
        depositOrders.length > 0 && /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Box, { padding: "400", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Summary" }),
          /* @__PURE__ */ jsxs(InlineStack, { gap: "800", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", fontWeight: "bold", children: "Total Orders" }),
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "headingLg", children: depositOrders.length })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", fontWeight: "bold", children: "Pending Balance" }),
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "headingLg", children: depositOrders.filter((o) => !o.balancePaid).length })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", fontWeight: "bold", children: "Total Revenue" }),
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "headingLg", children: formatCurrency(
                depositOrders.reduce((sum, order) => sum + order.totalAmount, 0)
              ) })
            ] })
          ] })
        ] }) }) }) })
      ] })
    }
  );
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Orders,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BI3Ft-34.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-F77C8hyp.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js"], "css": [] }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.orders.paid": { "id": "routes/webhooks.orders.paid", "parentId": "root", "path": "webhooks/orders/paid", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.orders.paid-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-qu1hjrFl.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js", "/assets/AppProvider-DCF9tWH4.js", "/assets/Page-pFACYMxX.js", "/assets/FormLayout-COkKuqS2.js", "/assets/context-C4lM4JaA.js", "/assets/context-Dqc0DVKX.js"], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-CDcyQSuB.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js"], "css": ["/assets/route-TqOIn4DE.css"] }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": true, "module": "/assets/app-MkQkCAzC.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js", "/assets/AppProvider-DCF9tWH4.js", "/assets/context-C4lM4JaA.js", "/assets/context-Dqc0DVKX.js"], "css": ["/assets/styles-BeiPL2RV.css"] }, "routes/app.selling-plans": { "id": "routes/app.selling-plans", "parentId": "routes/app", "path": "selling-plans", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.selling-plans-DoFMdr4V.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js", "/assets/Page-pFACYMxX.js", "/assets/Layout-kpxSNHR3.js", "/assets/Banner-DTovbrWk.js", "/assets/ResourceList-BMPt1jSY.js", "/assets/context-C4lM4JaA.js", "/assets/context-Dqc0DVKX.js", "/assets/FormLayout-COkKuqS2.js", "/assets/banner-context-Bfu3e4If.js"], "css": [] }, "routes/app.additional": { "id": "routes/app.additional", "parentId": "routes/app", "path": "additional", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.additional-drv71nHA.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/Page-pFACYMxX.js", "/assets/TitleBar-BCh1nPMy.js", "/assets/Layout-kpxSNHR3.js", "/assets/context-C4lM4JaA.js", "/assets/banner-context-Bfu3e4If.js"], "css": [] }, "routes/app.dashboard": { "id": "routes/app.dashboard", "parentId": "routes/app", "path": "dashboard", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.dashboard-DWxOR9CK.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js", "/assets/Page-pFACYMxX.js", "/assets/Layout-kpxSNHR3.js", "/assets/Banner-DTovbrWk.js", "/assets/context-C4lM4JaA.js", "/assets/banner-context-Bfu3e4If.js"], "css": [] }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app._index-B4N8NnFr.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js", "/assets/Page-pFACYMxX.js", "/assets/TitleBar-BCh1nPMy.js", "/assets/Layout-kpxSNHR3.js", "/assets/context-C4lM4JaA.js", "/assets/banner-context-Bfu3e4If.js"], "css": [] }, "routes/app.orders": { "id": "routes/app.orders", "parentId": "routes/app", "path": "orders", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.orders-CDhXkEpZ.js", "imports": ["/assets/index-OtPSfN_w.js", "/assets/components-Bicglw4e.js", "/assets/Page-pFACYMxX.js", "/assets/Layout-kpxSNHR3.js", "/assets/ResourceList-BMPt1jSY.js", "/assets/context-C4lM4JaA.js"], "css": [] } }, "url": "/assets/manifest-b8492c79.js", "version": "b8492c79" };
const mode = "production";
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "v3_fetcherPersist": true, "v3_relativeSplatPath": true, "v3_throwAbortReason": true, "v3_routeConfig": true, "v3_singleFetch": false, "v3_lazyRouteDiscovery": true, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/webhooks.orders.paid": {
    id: "routes/webhooks.orders.paid",
    parentId: "root",
    path: "webhooks/orders/paid",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route5
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/app.selling-plans": {
    id: "routes/app.selling-plans",
    parentId: "routes/app",
    path: "selling-plans",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/app.additional": {
    id: "routes/app.additional",
    parentId: "routes/app",
    path: "additional",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/app.dashboard": {
    id: "routes/app.dashboard",
    parentId: "routes/app",
    path: "dashboard",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route11
  },
  "routes/app.orders": {
    id: "routes/app.orders",
    parentId: "routes/app",
    path: "orders",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
