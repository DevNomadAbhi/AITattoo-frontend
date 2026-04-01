import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { notifyError, notifySuccess } from "@/lib/feedback";
import {
  getSavedTattoos,
  removeSavedTattoo,
  SavedTattoo,
} from "@/lib/selected-tattoo";

export default function MyTattooScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedTattoo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const savedTattoos = await getSavedTattoos();
      setItems(savedTattoos);
    } catch (error) {
      console.error(error);
      void notifyError(
        "Your saved tattoo shots could not be opened right now.",
        "Could not load previews",
      );
      Alert.alert(
        "Could not load previews",
        "Your saved tattoo shots could not be opened right now.",
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

  const openPreview = (item: SavedTattoo) => {
    router.push({
      pathname: "/saved-preview",
      params: {
        id: item.id,
        imageUri: item.uri,
        title: item.name,
      },
    });
  };

  const confirmRemove = (item: SavedTattoo) => {
    Alert.alert(
      "Remove shot?",
      `Remove ${item.name} from My Tattoos?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeSavedTattoo(item.id);
              setItems((current) => current.filter((entry) => entry.id !== item.id));
              await notifySuccess("Preview removed from My Tattoos.", "Removed");
            } catch (error) {
              console.error(error);
              await notifyError(
                "This saved preview could not be removed right now.",
                "Remove failed",
              );
              Alert.alert(
                "Remove failed",
                "This saved preview could not be removed right now.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>My Tattoos</Text>
        <Text style={styles.title}>Your saved tattoo preview shots.</Text>
        <Text style={styles.subtitle}>
          Capture a photo in camera preview, save it, and keep your finished try-on
          images here.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6E4D2F" />
          <Text style={styles.loadingText}>Loading your saved shots...</Text>
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
              onPress={() => openPreview(item)}>
              <View style={styles.imageWrap}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.image}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  transition={100}
                />
                <Pressable
                  hitSlop={10}
                  style={styles.removeButton}
                  onPress={() => confirmRemove(item)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                Saved {new Date(item.savedAt).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No saved shots yet</Text>
          <Text style={styles.emptyText}>
            Capture a tattoo try-on photo in the camera screen, then tap save to add
            it here.
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
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
  },
  kicker: {
    color: "#7D5731",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: "#22160D",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#5E5348",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#5E5348",
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 16,
  },
  row: {
    justifyContent: "space-between",
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFF9F2",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8DCCE",
    gap: 8,
  },
  cardPressed: {
    opacity: 0.82,
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
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(20, 14, 10, 0.72)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: "#FFF4E5",
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#24180F",
    fontSize: 14,
    fontWeight: "700",
  },
  cardMeta: {
    color: "#7A6B5E",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    color: "#24180F",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    color: "#5E5348",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "500",
  },
});


