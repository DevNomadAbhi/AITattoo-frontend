import { Platform } from "react-native";
import Purchases, {
    CustomerInfo,
    LOG_LEVEL,
    PRODUCT_CATEGORY,
    PURCHASES_ERROR_CODE,
    PurchasesOffering,
    PurchasesPackage,
    PurchasesStoreProduct,
    PurchasesStoreTransaction,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

import {
    syncRevenueCatCreditPurchaseUseCase,
    syncRevenueCatCustomerInfoUseCase,
    syncRevenueCatSubscriptionPurchaseUseCase,
} from "./tattoo-api";

export interface PurchaseItem {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  type: "subs" | "inapp";
  credits: number;
}

// RevenueCat product IDs for consumable credit packs.
export const PRODUCT_IDS = {
  CREDITS_10: "credits_10",
  CREDITS_50: "credits_50",
  CREDITS_100: "credits_100",
  CREDITS_500: "credits_500",
};

export const PRO_ENTITLEMENT_ID = "Tattoo Hunter Pro";

const REVENUECAT_API_KEY =
  Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
  }) ||
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
  "test_LZqPYbHswMDNaosbqGBIzVIICcp";
const REQUIRE_BACKEND_SYNC =
  process.env.EXPO_PUBLIC_REQUIRE_CREDIT_BACKEND_SYNC === "true";

export type ProcessPurchasePayload = {
  productId: string;
  transactionId?: string;
} & (
  | {
      platform: "ios";
      receiptData: string;
      bundleId?: string;
    }
  | {
      platform: "android";
      purchaseToken: string;
      packageName?: string;
    }
);

export type ProcessPurchaseResponse = {
  message: string;
  transactionId?: string;
  productId: string;
  creditsAdded: number;
  creditsRemaining: number;
  purchasedCredits: number;
};

export type PurchaseHistoryRecord = {
  transactionId?: string;
  productId?: string;
  status?: string;
  validationStatus?: string;
  creditsAdded?: number;
  creditsRemaining?: number;
  createdAt?: string;
};

const ALLOWED_PRODUCT_IDS = new Set(Object.values(PRODUCT_IDS));
const CREDIT_AMOUNT_MAP: Record<string, number> = {
  [PRODUCT_IDS.CREDITS_10]: 10,
  [PRODUCT_IDS.CREDITS_50]: 50,
  [PRODUCT_IDS.CREDITS_100]: 100,
  [PRODUCT_IDS.CREDITS_500]: 500,
};

class InAppPurchaseService {
  private initialized = false;
  private appUserId: string | null = null;
  private customerInfo: CustomerInfo | null = null;
  private productCache: PurchasesStoreProduct[] = [];

  private async syncBackend(
    syncOperation: () => Promise<unknown>,
    context: string,
  ): Promise<void> {
    try {
      await syncOperation();
    } catch (error) {
      if (REQUIRE_BACKEND_SYNC) {
        throw new Error(
          `Purchase completed but backend ${context} sync failed. ${this.getErrorMessage(error)}`,
        );
      }

      console.warn(`RevenueCat backend ${context} sync failed:`, error);
    }
  }

  private buildSyncPayload(args: {
    customerInfo: CustomerInfo;
    productId?: string;
    entitlementId?: string;
    storeTransaction?: PurchasesStoreTransaction;
  }): {
    appUserId?: string;
    customerInfo: CustomerInfo;
    entitlementId?: string;
    platform: string;
    productId?: string;
    purchaseDate?: string;
    transactionId?: string;
  } {
    return {
      appUserId: args.customerInfo.originalAppUserId,
      customerInfo: args.customerInfo,
      entitlementId: args.entitlementId,
      platform: Platform.OS,
      productId: args.productId,
      purchaseDate: args.storeTransaction?.purchaseDate,
      transactionId: args.storeTransaction?.transactionIdentifier,
    };
  }

  async initialize(userId?: string | null): Promise<void> {
    if (this.initialized) return;

    if (!REVENUECAT_API_KEY) {
      throw new Error(
        "RevenueCat API key is missing. Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (or EXPO_PUBLIC_REVENUECAT_API_KEY fallback).",
      );
    }

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    Purchases.configure(
      userId
        ? { apiKey: REVENUECAT_API_KEY, appUserID: userId }
        : { apiKey: REVENUECAT_API_KEY },
    );
    this.appUserId = userId ?? null;

    Purchases.addCustomerInfoUpdateListener((info) => {
      this.customerInfo = info;
    });

    this.customerInfo = await Purchases.getCustomerInfo();
    await this.syncBackend(
      () =>
        syncRevenueCatCustomerInfoUseCase(
          this.buildSyncPayload({
            customerInfo: this.customerInfo as CustomerInfo,
          }),
        ),
      "customer-info",
    );
    this.initialized = true;
  }

  async syncUserIdentity(userId: string | null): Promise<void> {
    if (!this.initialized) {
      await this.initialize(userId);

      if (!userId) {
        return;
      }

      this.customerInfo = await Purchases.getCustomerInfo();
      await this.syncBackend(
        () =>
          syncRevenueCatCustomerInfoUseCase(
            this.buildSyncPayload({
              customerInfo: this.customerInfo as CustomerInfo,
            }),
          ),
        "customer-info",
      );
      return;
    }

    if (!userId) {
      // Keep current RC user in memory on logged-out routes to avoid creating
      // a fresh anonymous App User ID repeatedly (which can look like duplicates).
      return;
    }

    if (this.appUserId === userId) {
      return;
    }

    await Purchases.logIn(userId);
    this.appUserId = userId;
    this.customerInfo = await Purchases.getCustomerInfo();

    await this.syncBackend(
      () =>
        syncRevenueCatCustomerInfoUseCase(
          this.buildSyncPayload({
            customerInfo: this.customerInfo as CustomerInfo,
          }),
        ),
      "customer-info",
    );
  }

  async getCurrentOffering(): Promise<PurchasesOffering | null> {
    await this.initialize();
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  }

  async getProPackages(): Promise<PurchasesPackage[]> {
    const currentOffering = await this.getCurrentOffering();
    if (!currentOffering) {
      return [];
    }

    return currentOffering.availablePackages.filter(
      (pkg) => pkg.product.productCategory === PRODUCT_CATEGORY.SUBSCRIPTION,
    );
  }

  async purchaseProPackage(aPackage: PurchasesPackage): Promise<CustomerInfo> {
    await this.initialize();

    const result = await Purchases.purchasePackage(aPackage);
    this.customerInfo = result.customerInfo;

    await this.syncBackend(
      () =>
        syncRevenueCatSubscriptionPurchaseUseCase(
          this.buildSyncPayload({
            customerInfo: result.customerInfo,
            entitlementId: PRO_ENTITLEMENT_ID,
            productId: aPackage.product.identifier,
            storeTransaction: result.transaction,
          }),
        ),
      "subscription",
    );

    return result.customerInfo;
  }

  private mapStoreProductToItem(product: PurchasesStoreProduct): PurchaseItem {
    return {
      productId: product.identifier,
      title: product.title,
      description: product.description,
      price: product.priceString,
      priceAmountMicros: Math.round(product.price * 1_000_000),
      priceCurrencyCode: product.currencyCode,
      type: "inapp",
      credits: CREDIT_AMOUNT_MAP[product.identifier] ?? 0,
    };
  }

  async getProducts(): Promise<PurchaseItem[]> {
    await this.initialize();

    const products = await Purchases.getProducts(
      Object.values(PRODUCT_IDS),
      PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    );

    this.productCache = products;

    return products
      .map((product) => this.mapStoreProductToItem(product))
      .filter((item) => ALLOWED_PRODUCT_IDS.has(item.productId));
  }

  async purchaseCredits(
    payload: ProcessPurchasePayload,
  ): Promise<ProcessPurchaseResponse> {
    await this.initialize();

    const product =
      this.productCache.find((item) => item.identifier === payload.productId) ||
      (
        await Purchases.getProducts(
          [payload.productId],
          PRODUCT_CATEGORY.NON_SUBSCRIPTION,
        )
      )[0];

    if (!product) {
      throw new Error(
        `Product ${payload.productId} was not found in RevenueCat products.`,
      );
    }

    const result = await Purchases.purchaseStoreProduct(product);
    this.customerInfo = result.customerInfo;

    await this.syncBackend(
      () =>
        syncRevenueCatCreditPurchaseUseCase(
          this.buildSyncPayload({
            customerInfo: result.customerInfo,
            productId: payload.productId,
            storeTransaction: result.transaction,
          }),
        ),
      "credit",
    );

    return {
      message: "Purchase completed successfully.",
      transactionId: result.transaction.transactionIdentifier,
      productId: payload.productId,
      creditsAdded: CREDIT_AMOUNT_MAP[payload.productId] ?? 0,
      creditsRemaining: CREDIT_AMOUNT_MAP[payload.productId] ?? 0,
      purchasedCredits: CREDIT_AMOUNT_MAP[payload.productId] ?? 0,
    };
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    await this.initialize();
    this.customerInfo = await Purchases.getCustomerInfo();
    return this.customerInfo;
  }

  async hasProEntitlement(): Promise<boolean> {
    const info = await this.getCustomerInfo();
    return Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID]);
  }

  async presentPaywallForPro(): Promise<PAYWALL_RESULT> {
    await this.initialize();
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      displayCloseButton: true,
    });

    this.customerInfo = await Purchases.getCustomerInfo();
    return result;
  }

  async presentCustomerCenter(): Promise<void> {
    await this.initialize();
    await RevenueCatUI.presentCustomerCenter();
    this.customerInfo = await Purchases.getCustomerInfo();
  }

  async restorePurchases(): Promise<PurchaseHistoryRecord[]> {
    await this.initialize();
    this.customerInfo = await Purchases.restorePurchases();

    await this.syncBackend(
      () =>
        syncRevenueCatCustomerInfoUseCase(
          this.buildSyncPayload({
            customerInfo: this.customerInfo as CustomerInfo,
          }),
        ),
      "customer-info",
    );

    return this.listPurchases();
  }

  async listPurchases(): Promise<PurchaseHistoryRecord[]> {
    const info = await this.getCustomerInfo();

    return info.nonSubscriptionTransactions.map((tx) => ({
      transactionId: tx.transactionIdentifier,
      productId: tx.productIdentifier,
      status: "purchased",
      validationStatus: "validated_by_revenuecat",
      createdAt: tx.purchaseDate,
    }));
  }

  async getPurchaseDetail(
    transactionId: string,
  ): Promise<PurchaseHistoryRecord | null> {
    const purchases = await this.listPurchases();
    return (
      purchases.find((purchase) => purchase.transactionId === transactionId) ||
      null
    );
  }

  isPurchaseCancelled(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const code = (error as { code?: string | number }).code;
    return (
      String(code) === String(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Purchase failed. Please try again.";
  }

  // async purchaseProUnlock(productId: string): Promise<void> {
  //   // Mock purchase - in real implementation, this would initiate store purchase flow
  //   console.log(`Mock purchase initiated for PRO unlock: ${productId}`);

  //   await new Promise((resolve) => setTimeout(resolve, 1000));
  //   console.log("Mock PRO unlock purchase completed successfully");

  //   const { subscriptionService } = await import("./subscription");
  //   if (productId === PRODUCT_IDS.PRO_UNLOCK) {
  //     await subscriptionService.unlockProFeatures();
  //   }
  // }

  async purchaseProduct(productId: string): Promise<void> {
    await this.purchaseCredits({
      productId,
      platform: "android",
      purchaseToken: "handled-by-revenuecat",
    });
  }

  async disconnect(): Promise<void> {
    if (this.initialized) {
      this.initialized = false;
      this.customerInfo = null;
    }
  }

  // Helper method to check if IAP is properly configured
  isConfigured(): boolean {
    return Boolean(REVENUECAT_API_KEY);
  }

  // Get setup instructions for real IAP
  getSetupInstructions(): string {
    return `
  RevenueCat setup checklist:

  1. Configure products in App Store Connect / Google Play:
    - Consumables: ${PRODUCT_IDS.CREDITS_10}, ${PRODUCT_IDS.CREDITS_50}, ${PRODUCT_IDS.CREDITS_100}, ${PRODUCT_IDS.CREDITS_500}
    - Subscription(s) used by entitlement: ${PRO_ENTITLEMENT_ID}

  2. In RevenueCat dashboard:
    - Add App Store and Play credentials
    - Mirror product IDs
    - Create entitlement: ${PRO_ENTITLEMENT_ID}
    - Attach subscription products to that entitlement
    - Configure current offering and paywall

  3. In app config/environment:
    - Set EXPO_PUBLIC_REVENUECAT_API_KEY (defaults to provided test key if unset)

  4. Use RevenueCat APIs:
    - Purchases.getCustomerInfo() for customer status
    - RevenueCatUI.presentPaywallIfNeeded() for paywall display
    - RevenueCatUI.presentCustomerCenter() for subscription management
    `;
  }
}

export const iapService = new InAppPurchaseService();
