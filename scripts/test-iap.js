import { iapService } from "./lib/in-app-purchase";

export async function testIAP() {
  try {
    console.log("Testing IAP initialization...");
    await iapService.initialize();
    console.log("✅ IAP initialized successfully");

    console.log("Testing product fetch...");
    const products = await iapService.getProducts();
    console.log("✅ Products fetched:", products);

    console.log("Testing purchase history...");
    const history = await iapService.restorePurchases();
    console.log("✅ Purchase history:", history);

    console.log("All IAP tests passed!");
  } catch (error) {
    console.error("❌ IAP test failed:", error);
  } finally {
    await iapService.disconnect();
  }
}

// For testing in development
if (__DEV__) {
  // Uncomment to test IAP
  // testIAP();
}
