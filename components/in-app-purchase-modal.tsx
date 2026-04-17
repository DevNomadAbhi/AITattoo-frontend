import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts } from "@/constants/theme";
import { auth } from "@/firebase/firebaseConfig";
import { iapService, PRODUCT_IDS, PurchaseItem } from "@/lib/in-app-purchase";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface InAppPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchase: (credits: number) => void;
}

export default function InAppPurchaseModal({
  visible,
  onClose,
  onPurchase,
}: InAppPurchaseModalProps) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 390;

  const [products, setProducts] = useState<PurchaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.credits - b.credits);
  }, [products]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const loadRevenueCatState = async () => {
      try {
        setIsLoading(true);
        await iapService.initialize(auth.currentUser?.uid ?? null);
        const catalog = await iapService.getProducts();
        setProducts(catalog);
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to load RevenueCat data:", error);
        const reason = iapService.getErrorMessage(error);
        Alert.alert(
          "Purchases unavailable",
          `Could not load products from RevenueCat.\n\nReason: ${reason}\n\nCheck: platform SDK key, products attached in RevenueCat, and test on a dev build/device (not Expo Go).`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadRevenueCatState();
  }, [visible]);

  const refreshCustomerState = async () => {
    const catalog = await iapService.getProducts();

    setProducts(catalog);
  };

  const handleConsumablePurchase = async (item: PurchaseItem) => {
    try {
      setIsLoading(true);

      if (Platform.OS === "ios") {
        await iapService.purchaseCredits({
          productId: item.productId,
          platform: "ios",
          receiptData: "handled-by-revenuecat",
        });
      } else {
        await iapService.purchaseCredits({
          productId: item.productId,
          platform: "android",
          purchaseToken: "handled-by-revenuecat",
        });
      }

      await refreshCustomerState();
      onPurchase(item.credits);
      Alert.alert("Purchase successful", `${item.credits} credits were added.`);
    } catch (error) {
      console.error("Consumable purchase failed:", error);
      if (iapService.isPurchaseCancelled(error)) {
        Alert.alert("Purchase cancelled", "No charge was made.");
        return;
      }

      Alert.alert("Purchase failed", iapService.getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsLoading(true);
      await iapService.restorePurchases();
      await refreshCustomerState();
      Alert.alert("Restore complete", "Your purchases were restored.");
    } catch (error) {
      console.error("Restore failed:", error);
      Alert.alert("Restore failed", iapService.getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerCenter = async () => {
    try {
      setIsLoading(true);
      await iapService.presentCustomerCenter();
      await refreshCustomerState();
    } catch (error) {
      console.error("Customer center failed:", error);
      Alert.alert(
        "Customer Center unavailable",
        iapService.getErrorMessage(error),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const hasCatalog = sortedProducts.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Tattoo Hunter Pro & Credits</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color="#6B5B52" />
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Buy Consumable Credits</Text>
            {/* <Text style={styles.sectionSubtitle}>
              Products are loaded from RevenueCat getProducts() using your
              consumable product IDs.
            </Text> */}

            {!isInitialized || isLoading ? (
              <Text style={styles.loadingText}>Loading products...</Text>
            ) : null}

            {isInitialized && !hasCatalog ? (
              <Text style={styles.emptyText}>
                No consumable products found. Verify IDs in store and RevenueCat
                dashboard:
                {"\n"}
                {Object.values(PRODUCT_IDS).join(", ")}
              </Text>
            ) : null}

            {sortedProducts.map((item) => (
              <Pressable
                key={item.productId}
                style={[
                  styles.productCard,
                  isCompactLayout && styles.productCardCompact,
                  isLoading && styles.buttonDisabled,
                ]}
                disabled={isLoading}
                onPress={() => handleConsumablePurchase(item)}
              >
                <View style={styles.productInfoWrap}>
                  <Text
                    style={styles.productTitle}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.title || item.productId}
                  </Text>
                  <Text
                    style={styles.productDescription}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.description || `${item.credits} credits`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.priceWrap,
                    isCompactLayout && styles.priceWrapCompact,
                  ]}
                >
                  <Text
                    style={[
                      styles.productPrice,
                      isCompactLayout && styles.productPriceCompact,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {item.price}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Purchases</Text>
            <Pressable
              style={[
                styles.secondaryButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleRestore}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleCustomerCenter}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>
                Open Customer Center
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F1E8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2D7C7",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B130D",
    fontFamily: Fonts.fredoka,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B130D",
    marginBottom: 8,
    fontFamily: Fonts.fredoka,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B5B52",
    marginBottom: 12,
    fontFamily: Fonts.fredoka,
  },
  productCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2D7C7",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  productCardCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  productInfoWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  priceWrap: {
    width: 96,
    minWidth: 96,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingTop: 2,
  },
  priceWrapCompact: {
    width: "100%",
    minWidth: 0,
    alignItems: "flex-start",
    paddingTop: 0,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B130D",
    fontFamily: Fonts.fredoka,
    flexShrink: 1,
  },
  productDescription: {
    fontSize: 13,
    color: "#6B5B52",
    marginTop: 2,
    fontFamily: Fonts.fredoka,
    flexShrink: 1,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D4B480",
    fontFamily: Fonts.fredoka,
    width: "100%",
    textAlign: "right",
    includeFontPadding: false,
  },
  productPriceCompact: {
    textAlign: "left",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D4B480",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#6B5B52",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B5B52",
    marginVertical: 8,
    fontFamily: Fonts.fredoka,
  },
  emptyText: {
    fontSize: 13,
    color: "#8B7355",
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: Fonts.fredoka,
  },
});

/*
  Legacy modal implementation (pre-RevenueCat) preserved by request.
  This block is intentionally commented and kept for reference.

  import {
    iapService,
    PRODUCT_IDS,
    ProcessPurchasePayload,
    ProcessPurchaseResponse,
    PurchaseItem,
  } from "@/lib/in-app-purchase";

  type PurchaseOption =
    | "10_credits"
    | "50_credits"
    | "100_credits"
    | "500_credits";

  const [selectedPackage, setSelectedPackage] =
    useState<PurchaseOption>("50_credits");
  const [products, setProducts] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [iapInitialized, setIapInitialized] = useState(false);

  useEffect(() => {
    if (visible && !iapInitialized) {
      initializeIAP();
    }
  }, [visible, iapInitialized]);

  const initializeIAP = async () => {
    try {
      setLoading(true);
      await iapService.initialize();
      const productList = await iapService.getProducts();
      setProducts(productList);
      setIapInitialized(true);
    } catch (error) {
      console.error("Failed to initialize IAP:", error);
      Alert.alert("Error", "Failed to load payment options. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    try {
      setLoading(true);

      const productIdMap: Record<PurchaseOption, string> = {
        "10_credits": PRODUCT_IDS.CREDITS_10,
        "50_credits": PRODUCT_IDS.CREDITS_50,
        "100_credits": PRODUCT_IDS.CREDITS_100,
        "500_credits": PRODUCT_IDS.CREDITS_500,
      };

      const productId = productIdMap[selectedPackage];
      const simulatedTransactionId = `txn-${Date.now()}`;

      const purchasePayload: ProcessPurchasePayload =
        Platform.OS === "ios"
          ? {
              productId,
              platform: "ios",
              transactionId: simulatedTransactionId,
              receiptData: "mock-ios-receipt",
            }
          : {
              productId,
              platform: "android",
              transactionId: simulatedTransactionId,
              purchaseToken: "mock-android-purchase-token",
            };

      const purchaseResult: ProcessPurchaseResponse =
        await iapService.purchaseCredits(purchasePayload);

      Alert.alert(
        "Purchase Successful",
        `${purchaseResult.creditsAdded} credits added.\\nRemaining credits: ${purchaseResult.creditsRemaining}`,
        [{ text: "OK", onPress: () => onPurchase(purchaseResult.creditsAdded) }],
      );

      onClose();
    } catch (error: any) {
      console.error("Purchase error:", error);

      const errorMessage =
        typeof error?.message === "string"
          ? error.message
          : "Could not verify purchase with backend. Real store receipt/token is required when mock purchases are disabled.";

      Alert.alert("Purchase failed", errorMessage, [{ text: "OK" }]);
    } finally {
      setLoading(false);
    }
  };

  // Legacy UI summary:
  // - PRO features section
  // - Credit package cards with radio selection
  // - Single "Buy Credits" CTA based on selected package
*/
