import { Fonts } from "@/constants/theme";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { notifyError } from "@/lib/feedback";
import { getSavedTattoosApiUseCase, SavedTattooEntry } from "@/lib/tattoo-api";

export default function MyTattooScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedTattooEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSavedTattoosApiUseCase();
      setItems(data.savedTattoos);
    } catch (error) {
      console.error(error);
      void notifyError(
        "Your saved tattoos could not be loaded right now.",
        "Could not load saved tattoos",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const openPreview = (item: SavedTattooEntry) => {
    const previewImageUri = item.capturedShotUrl || item.tattoo.imageUrl;
    router.push({
      pathname: "/saved-preview",
      params: {
        id: item.id,
        imageUri: previewImageUri,
        title: item.tattoo.name,
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>My Tattoos</Text>
        <Text style={styles.title}>Your saved tattoo captures.</Text>
        <Text style={styles.subtitle}>
          Saved tattoos now sync from your account and include captured shots
          when available.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6E4D2F" />
          <Text style={styles.loadingText}>Loading your saved tattoos...</Text>
        </View>
      ) : items.length ? (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed ? styles.cardPressed : null,
              ]}
              onPress={() => openPreview(item)}
            >
              <View style={styles.imageWrap}>
                <Image
                  source={{
                    uri: item.capturedShotUrl || item.tattoo.imageUrl,
                  }}
                  style={styles.image}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  transition={100}
                />
              </View>
              <Text style={styles.cardTitle}>{item.tattoo.name}</Text>
              <Text style={styles.cardMeta}>
                Saved{" "}
                {new Date(
                  typeof item.savedAt === "string"
                    ? item.savedAt
                    : item.savedAt._seconds * 1000,
                ).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No saved tattoos yet</Text>
          <Text style={styles.emptyText}>
            Save a tattoo from camera preview to see it here.
          </Text>
        </View>
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
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
    fontFamily: Fonts.fredoka,
  },
  loadingText: {
    color: "#5E5348",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 16,
    fontFamily: Fonts.fredoka,
  },
  row: {
    justifyContent: "space-between",
    gap: 16,
    fontFamily: Fonts.fredoka,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFF9F2",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8DCCE",
    gap: 8,
    fontFamily: Fonts.fredoka,
  },
  cardPressed: {
    opacity: 0.82,
    fontFamily: Fonts.fredoka,
  },
  imageWrap: {
    width: "100%",
    height: 190,
    borderRadius: 16,
    backgroundColor: "#F2E7D9",
    borderWidth: 1,
    borderColor: "#D9C7B3",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: Fonts.fredoka,
  },
  image: {
    width: "100%",
    height: "100%",
    fontFamily: Fonts.fredoka,
  },
  cardTitle: {
    color: "#24180F",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  cardMeta: {
    color: "#7A6B5E",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
    fontFamily: Fonts.fredoka,
  },
  emptyTitle: {
    color: "#24180F",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: Fonts.fredoka,
  },
  emptyText: {
    color: "#5E5348",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
});
