import { Fonts } from "@/constants/theme";
// import { auth } from "@/firebase/firebaseConfig";
import {
  // callProtectedEndpointUseCase,
  getCatalogUseCase,
} from "@/lib/tattoo-api";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Image as RNImage,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

async function logCurrentUserAuthToken() {
  const user = auth.currentUser;
  if (!user) {
    Alert.alert("User not logged in");
    return;
  }

  try {
    const idToken = await user.getIdToken(true);
    console.log("Firebase ID Token:", idToken);
    Alert.alert("Token logged", "Firebase ID token printed in console.");
  } catch (error) {
    console.error("Failed to get Firebase ID token:", error);
    Alert.alert("Error", "Failed to retrieve Firebase token.");
  }
}
/*
async function callProtectedEndpoint() {
  try {
    const data = await callProtectedEndpointUseCase();
    console.log("Protected Endpoint Response:", data);
  } catch (e) {
    if (e instanceof Error && e.message === "User not logged in") {
      Alert.alert("User not logged in");
      return;
    }
    console.error("Error calling protected endpoint:", e);
  }
}
*/

import { auth } from "@/firebase/firebaseConfig";
import { notifyError } from "@/lib/feedback";
import { setSelectedTattoo } from "@/lib/selected-tattoo";

type TattooStyle = {
  id: string | number;
  src: string | number;
  name: string;
};

type TattooSection = {
  title: string;
  subtitle: string;
  data: TattooStyle[][];
};

// ── Static data commented out — catalog now comes from API ────────────────
// const remoteData: TattooStyle[] = [
//   { id: 1, src: "https://cdn.tattoo.ai/assets/egyptian_mythological_ac4d37214d/egyptian_mythological_ac4d37214d.png", name: "Egyptian Mythological" },
//   { id: 2, src: "https://cdn.tattoo.ai/assets/Paganic_style_423f0e12d8/Paganic_style_423f0e12d8.png", name: "Paganic Style" },
//   { id: 3, src: "https://cdn.tattoo.ai/assets/glitch_style_2c30a8d7f5/glitch_style_2c30a8d7f5.png", name: "Glitch Style" },
//   { id: 4, src: "https://cdn.tattoo.ai/assets/egyptian_mythological_ac4d37214d/egyptian_mythological_ac4d37214d.png", name: "Egyptian Mythological" },
// ];

// const localData: TattooStyle[] = [
//   { id: 14, src: require("@/assets/images/myTattoos/basmala.png"), name: "Basmala" },
//   { id: 15, src: require("@/assets/images/myTattoos/beautynbeast.png"), name: "Beauty N Beast" },
//   { id: 16, src: require("@/assets/images/myTattoos/dancingskull.png"), name: "Dancing Skull" },
//   { id: 17, src: require("@/assets/images/myTattoos/dragon.png"), name: "Dragon" },
//   { id: 18, src: require("@/assets/images/myTattoos/dragon1.png"), name: "Dragon Alt" },
//   { id: 19, src: require("@/assets/images/myTattoos/dragonhead.png"), name: "Dragon Head" },
//   { id: 20, src: require("@/assets/images/myTattoos/flower.png"), name: "Flower" },
//   { id: 21, src: require("@/assets/images/myTattoos/ganesha.png"), name: "Ganesha" },
//   { id: 22, src: require("@/assets/images/myTattoos/heart.png"), name: "Heart" },
//   { id: 23, src: require("@/assets/images/myTattoos/islamCaligraphy.png"), name: "Islam Calligraphy" },
//   { id: 24, src: require("@/assets/images/myTattoos/mickey.png"), name: "Mickey" },
//   { id: 25, src: require("@/assets/images/myTattoos/newskull.png"), name: "New Skull" },
//   { id: 26, src: require("@/assets/images/myTattoos/om.png"), name: "Om" },
//   { id: 27, src: require("@/assets/images/myTattoos/om1.png"), name: "Om Alt" },
//   { id: 28, src: require("@/assets/images/myTattoos/owl.png"), name: "Owl" },
//   { id: 29, src: require("@/assets/images/myTattoos/peacock.png"), name: "Peacock" },
//   { id: 30, src: require("@/assets/images/myTattoos/samurai.png"), name: "Samurai" },
//   { id: 31, src: require("@/assets/images/myTattoos/shiv.png"), name: "Shiv" },
//   { id: 32, src: require("@/assets/images/myTattoos/skull.png"), name: "Skull" },
//   { id: 33, src: require("@/assets/images/myTattoos/skull1.png"), name: "Skull Alt" },
//   { id: 34, src: require("@/assets/images/myTattoos/skullgroup.png"), name: "Skull Group" },
//   { id: 35, src: require("@/assets/images/myTattoos/skullsnake.png"), name: "Skull Snake" },
//   { id: 36, src: require("@/assets/images/myTattoos/trident.png"), name: "Trident" },
//   { id: 37, src: require("@/assets/images/myTattoos/trishul.png"), name: "Trishul" },
// ];

// function getTattoo(names: string[]) {
//   return localData.filter((item) => names.includes(item.name));
// }

function chunkRows(items: TattooStyle[], size = 2) {
  const rows: TattooStyle[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

function isAiGeneratedCategory(category: { id?: string; name?: string }) {
  const normalized = [category.id, category.name]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().replace(/[_-]+/g, " ").trim());

  return normalized.some(
    (value) =>
      value === "ai generated" ||
      value.includes("ai generated") ||
      value.includes("generated by ai"),
  );
}

function hasValidImageSource(src: string | number) {
  if (typeof src === "number") {
    return true;
  }

  const trimmed = src.trim();
  if (!trimmed) {
    return false;
  }

  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("content://")
  );
}

// ── defaultSections commented out — sections are loaded from API ──────────
// const defaultSections: TattooSection[] = [ ... ];

// API_BASE and fixImageUrl moved to lib/tattoo-api.ts

function TattooCard({
  item,
  onPress,
}: {
  item: TattooStyle;
  onPress: (item: TattooStyle) => void;
}) {
  const [hasError, setHasError] = useState(false);
  const isRemote = typeof item.src === "string";
  const remoteSrc = typeof item.src === "string" ? item.src : "";
  const localSrc = typeof item.src === "number" ? item.src : undefined;

  useEffect(() => {
    if (isRemote) {
      console.log("[TattooCard] uri:", item.src);
    }
  }, [item.src, isRemote]);

  useEffect(() => {
    setHasError(false);
  }, [item.src]);

  const handlePress = async () => {
    if (hasError && isRemote) {
      await notifyError(
        "This remote tattoo image is unavailable.",
        "Image unavailable",
      );
      return;
    }

    onPress(item);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed || (hasError && isRemote) ? 0.8 : 1 },
      ]}
    >
      <View style={styles.imageFrame}>
        {hasError ? (
          <View style={styles.imageFallback}>
            <Ionicons name="cloud-offline-outline" size={22} color="#8D7258" />
            <Text style={styles.imageFallbackText}>Image unavailable</Text>
          </View>
        ) : isRemote ? (
          <ExpoImage
            source={{ uri: remoteSrc }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={`${item.id}`}
            transition={100}
            onError={() => setHasError(true)}
          />
        ) : (
          <RNImage
            source={localSrc}
            style={styles.image}
            resizeMode="contain"
            fadeDuration={0}
            onError={() => setHasError(true)}
          />
        )}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [sections, setSections] = useState<TattooSection[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const showInitialLoader = catalogLoading && sections.length === 0;

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;

    return sections
      .map((sec) => {
        const all = sec.data.flat();
        const matched = all.filter((item) => {
          const name = String(item.name || "").toLowerCase();
          const title = String(sec.title || "").toLowerCase();
          return name.includes(q) || title.includes(q);
        });

        return matched.length > 0
          ? {
              ...sec,
              data: chunkRows(matched),
            }
          : null;
      })
      .filter((s): s is TattooSection => Boolean(s));
  }, [sections, searchQuery]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const catalog = await getCatalogUseCase();
      const apiSections: TattooSection[] = catalog.categories
        .filter((cat) => cat.tattoos.length > 0)
        .sort((a, b) => {
          const aIsAi = isAiGeneratedCategory(a);
          const bIsAi = isAiGeneratedCategory(b);

          if (aIsAi && !bIsAi) return -1;
          if (!aIsAi && bIsAi) return 1;

          return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
        })
        .map((cat) => ({
          tattoos: cat.tattoos
            .map((t) => ({
              id: t.id,
              name: t.name,
              src: t.imageUrl, // URL already fixed by getCatalogUseCase
            }))
            .filter((t) => hasValidImageSource(t.src)),
          title: cat.name
            ? String(cat.name).charAt(0).toUpperCase() +
              String(cat.name).slice(1)
            : cat.name,
        }))
        .filter((cat) => cat.tattoos.length > 0)
        .map((cat) => ({
          title: cat.title,
          subtitle: `${cat.tattoos.length} design${
            cat.tattoos.length !== 1 ? "s" : ""
          } available`,
          data: chunkRows(cat.tattoos),
        }));
      if (apiSections.length > 0) setSections(apiSections);
    } catch {
      // Keep previous sections on API error
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useFocusEffect(
    useCallback(() => {
      loadCatalog();
    }, [loadCatalog]),
  );

  const openTattooPreview = (item: TattooStyle) => {
    const tattooUri =
      typeof item.src === "string"
        ? item.src
        : RNImage.resolveAssetSource(item.src).uri;

    setSelectedTattoo(tattooUri, item.name);
    router.push({
      pathname: "/camera-preview",
      params: {
        tattooName: item.name,
        tattooId: String(item.id),
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Button title="Log Auth Token" onPress={logCurrentUserAuthToken} />
      </View> */}
      {/* <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Button
          title="Test Protected Endpoint"
          onPress={callProtectedEndpoint}
        />
      </View> */}
      {showInitialLoader ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#7D5731" />
          <Text style={styles.loaderText}>Loading tattoos...</Text>
        </View>
      ) : (
        <SectionList
          keyExtractor={(item, index) =>
            item.map((tattoo) => String(tattoo.id)).join("-") + `-${index}`
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            !catalogLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No designs available</Text>
                <Text style={styles.emptySubtitle}>
                  No catalog loaded yet. Create your own tattoo with AI.
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/createTattooScreen")}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Create with AI →</Text>
                </Pressable>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <>
              <View style={styles.hero}>
                <Text style={styles.kicker}>Tattoo Library</Text>
                <Text style={styles.title}>
                  Pick a preset tattoo to try on live.
                </Text>
                <Text style={styles.subtitle}>
                  Browse curated sections, tap any design, and preview it
                  directly on the camera.
                </Text>
              </View>
              {sections.length > 0 && !showInitialLoader ? (
                <View style={styles.searchWrap}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search designs or categories"
                    style={styles.searchInput}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                </View>
              ) : null}
            </>
          }
          sections={filteredSections}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            </View>
          )}
          renderItem={({ item: row }) => (
            <View style={styles.row}>
              {row.map((item) => (
                <TattooCard
                  key={item.id}
                  item={item}
                  onPress={openTattooPreview}
                />
              ))}
              {row.length === 1 ? <View style={styles.cardSpacer} /> : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F1E8",
    fontFamily: Fonts.fredoka,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
    fontFamily: Fonts.fredoka,
  },
  kicker: {
    color: "#7D5731",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: Fonts.fredoka,
  },
  title: {
    color: "#22160D",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  subtitle: {
    color: "#5E5348",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 0,
    fontFamily: Fonts.fredoka,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 12,
    gap: 3,
    fontFamily: Fonts.fredoka,
  },
  sectionTitle: {
    color: "#23170F",
    fontSize: 21,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  sectionSubtitle: {
    color: "#6B5D50",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  row: {
    justifyContent: "space-between",
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
    fontFamily: Fonts.fredoka,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#20160D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    fontFamily: Fonts.fredoka,
  },
  cardSpacer: {
    flex: 1,
    fontFamily: Fonts.fredoka,
  },
  imageFrame: {
    width: "100%",
    height: 210,
    padding: 10,
    backgroundColor: "#F2E7D9",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: Fonts.fredoka,
  },
  image: {
    width: "100%",
    height: "100%",
    fontFamily: Fonts.fredoka,
  },
  imageFallback: {
    flex: 1,
    width: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8D6C4",
    paddingHorizontal: 16,
    fontFamily: Fonts.fredoka,
  },
  imageFallbackText: {
    color: "#7D634B",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2D7C7",
    fontFamily: Fonts.fredoka,
  },
  label: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#24180F",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    fontFamily: Fonts.fredoka,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loaderText: {
    color: "#7D5731",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 10,
  },
  emptyTitle: {
    color: "#22160D",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#5E5348",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: "#7D5731",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: "#FFF8F0",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
});
