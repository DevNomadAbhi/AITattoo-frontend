# RevenueCat Setup Guide (Tattoo Hunter)

This app now uses RevenueCat for subscriptions + consumables in React Native.

## 1. Install SDK (npm)

```bash
npm install --save react-native-purchases react-native-purchases-ui
```

The packages are already present in this project.

## 2. Expo config note

Do not add `react-native-purchases` to `expo.plugins` in this project.

If you add it, Expo config can fail with a plugin resolution error.

## 3. Configure API key

Current key used by app code:

- `test_LZqPYbHswMDNaosbqGBIzVIICcp`

Best practice for non-test environments:

- set `EXPO_PUBLIC_REVENUECAT_API_KEY` in your environment
- keep platform-specific production keys per build profile

## 4. Configure RevenueCat dashboard

1. Create your app in RevenueCat.
2. Connect store credentials:
   - App Store Connect API key
   - Google Play service account
3. Add products in RevenueCat with exact store product IDs.
4. Create entitlement:
   - `Tattoo Hunter Pro`
5. Attach your subscription product(s) to `Tattoo Hunter Pro`.
6. Create offerings:
   - Current/default offering for Pro subscription paywall
   - Consumables can be sold via `getProducts` + `purchaseStoreProduct`
7. Build and publish a paywall in RevenueCat dashboard.
8. Optionally configure Customer Center in RevenueCat tools.

## 5. Configure products (Tattoo Hunter)

### Entitlement product (subscription)

- Must unlock entitlement: `Tattoo Hunter Pro`

### Consumables

- `credits_10`
- `credits_50`
- `credits_100`
- `credits_500`

Set each of these as consumable in App Store Connect / Play Console, then mirror IDs in RevenueCat.

## 6. App integration flow used in this repo

1. App starts and configures Purchases SDK.
2. Firebase auth user is synced to RevenueCat `appUserID`.
3. Profile/purchase modal loads:
   - entitlement status (`Tattoo Hunter Pro`)
   - consumable products (`getProducts`)
4. User actions:
   - present Pro paywall (`presentPaywallIfNeeded`)
   - buy consumable credits (`purchaseStoreProduct`)
   - restore purchases (`restorePurchases`)
   - open Customer Center (`presentCustomerCenter`)

## 7. Error handling recommendations

- Treat cancel as non-error:
  - check `PURCHASE_CANCELLED_ERROR`
- Show actionable messages for:
  - network failures
  - product not found
  - store misconfiguration
- Always refresh `CustomerInfo` after purchase/restore/paywall close.
- Use `addCustomerInfoUpdateListener` to keep app state in sync.

## 8. Testing checklist

1. Use real device builds (not plain Expo Go) for native purchase testing.
2. Test sandbox users (iOS) and test tracks (Android).
3. Verify:
   - paywall opens
   - Pro entitlement activates
   - consumables can be purchased repeatedly
   - restore works
   - customer center opens
4. Test logged-in and logged-out user flows.

## 9. Customer Center usage

Use Customer Center when user needs to:

- manage active subscription
- view billing/subscription status
- restore purchase self-service

This app includes an "Open Customer Center" action in purchase UI.

## 10. Security and production best practices

- Use separate RevenueCat keys for dev/staging/prod.
- Keep product IDs and entitlement IDs stable once released.
- Do not grant Pro access from client-side local flags only.
- Rely on `CustomerInfo.entitlements.active` for entitlement state.
- Keep server-side verification and webhooks if backend needs purchase-driven grants (for example, credit reconciliation).

## 11. Troubleshooting products not loading

1. Verify correct SDK key for platform:
   - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
2. Confirm store products exist and are approved for testing.
3. In RevenueCat, import products and attach them to offerings/entitlements.
4. Run on a development build or production build, not Expo Go.
5. Test with sandbox/test-track accounts on real devices.
