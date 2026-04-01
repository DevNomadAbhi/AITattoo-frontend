import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { notifyError, notifyInfo, notifySuccess } from "@/lib/feedback";
import {
  getSavedTattooById,
  removeSavedTattoo,
  renameSavedTattoo,
  SavedTattoo,
} from "@/lib/selected-tattoo";

type PreviewAction = "delete" | "download" | "rename" | "share" | null;
type PreviewItem = SavedTattoo;

function getShareMetadata(uri: string) {
  const normalizedUri = uri.toLowerCase();

  if (normalizedUri.endsWith(".jpg") || normalizedUri.endsWith(".jpeg")) {
    return {
      mimeType: "image/jpeg",
      UTI: "public.jpeg",
    };
  }

  return {
    mimeType: "image/png",
    UTI: "public.png",
  };
}

export default function SavedPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    imageUri?: string | string[];
    title?: string | string[];
  }>();
  const [action, setAction] = useState<PreviewAction>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [imageStatus, setImageStatus] = useState<"error" | "loaded" | "loading">(
    "loading",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [item, setItem] = useState<PreviewItem | null>(null);
  const [loading, setLoading] = useState(true);

  const previewId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fallbackImageUri = Array.isArray(params.imageUri)
    ? params.imageUri[0]
    : params.imageUri;
  const fallbackTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const isExpoGoAndroid =
    Platform.OS === "android" &&
    Constants.executionEnvironment === "storeClient";

  const isStoredItem = useMemo(() => Boolean(item?.savedAt), [item]);

  useEffect(() => {
    const loadItem = async () => {
      try {
        setLoading(true);

        if (previewId) {
          const savedItem = await getSavedTattooById(previewId);
          if (savedItem) {
            setItem(savedItem);
            setDraftName(savedItem.name);
            return;
          }
        }

        if (fallbackImageUri) {
          const fallbackItem: PreviewItem = {
            id: previewId ?? "preview-fallback",
            name: fallbackTitle ?? "Preview",
            savedAt: "",
            sourceUri: fallbackImageUri,
            uri: fallbackImageUri,
          };
          setItem(fallbackItem);
          setDraftName(fallbackItem.name);
          return;
        }

        setItem(null);
      } catch (error) {
        console.error("Could not load saved preview", error);
        setItem(null);
      } finally {
        setLoading(false);
      }
    };

    loadItem();
  }, [fallbackImageUri, fallbackTitle, previewId]);

  useEffect(() => {
    if (!item?.uri) {
      setDisplayUri(null);
      return;
    }

    setDisplayUri(item.uri);
    setImageStatus("loading");
  }, [item]);

  const handleRename = async () => {
    if (!item || !isStoredItem) {
      return;
    }

    try {
      setAction("rename");
      const updatedItem = await renameSavedTattoo(item.id, draftName);

      if (!updatedItem) {
        throw new Error("This saved preview could not be renamed.");
      }

      setItem(updatedItem);
      setDraftName(updatedItem.name);
      setIsEditing(false);
      await notifySuccess("Preview renamed.", "Renamed");
    } catch (error) {
      console.error("Rename failed", error);
      await notifyError("Preview rename failed.", "Rename failed");
      Alert.alert(
        "Rename failed",
        error instanceof Error
          ? error.message
          : "This preview could not be renamed right now.",
      );
    } finally {
      setAction(null);
    }
  };

  const handleShare = async () => {
    if (!displayUri) {
      return;
    }

    try {
      setAction("share");
      const shareAvailable = await Sharing.isAvailableAsync();

      if (!shareAvailable) {
        throw new Error("Sharing is not available on this device.");
      }

      const shareMetadata = getShareMetadata(displayUri);
      await notifyInfo("Opening share sheet.");
      await Sharing.shareAsync(displayUri, {
        mimeType: shareMetadata.mimeType,
        UTI: shareMetadata.UTI,
        dialogTitle: item?.name ?? "Preview",
      });
    } catch (error) {
      console.error("Share failed", error);
      await notifyError("Preview share failed.", "Share failed");
      Alert.alert(
        "Share failed",
        error instanceof Error
          ? error.message
          : "This preview could not be shared right now.",
      );
    } finally {
      setAction(null);
    }
  };

  const handleDownload = async () => {
    if (!displayUri) {
      return;
    }

    try {
      setAction("download");

      if (isExpoGoAndroid) {
        Alert.alert(
          "Development build needed",
          "On Android, Expo Go cannot grant the media-library permission needed for downloads. Use Share here, or run a development build to enable Download.",
        );
        return;
      }

      const mediaLibraryAvailable = await MediaLibrary.isAvailableAsync();
      if (!mediaLibraryAvailable) {
        throw new Error("Photo library access is not available on this device.");
      }

      const permissionResponse = await MediaLibrary.requestPermissionsAsync(
        true,
        ["photo"],
      );

      if (!permissionResponse.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access so this preview can be downloaded.",
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(displayUri);
      await notifySuccess("Preview downloaded to your photos.", "Saved");
    } catch (error) {
      console.error("Download failed", error);
      await notifyError("Preview download failed.", "Download failed");
      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "This preview could not be downloaded right now.",
      );
    } finally {
      setAction(null);
    }
  };

  const handleDelete = () => {
    if (!item || !isStoredItem) {
      return;
    }

    Alert.alert("Delete preview?", `Delete ${item.name} from My Tattoos?`, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setAction("delete");
            await removeSavedTattoo(item.id);
            await notifySuccess("Preview deleted.", "Deleted");
            router.back();
          } catch (error) {
            console.error("Delete failed", error);
            await notifyError("Preview delete failed.", "Delete failed");
            Alert.alert(
              "Delete failed",
              "This preview could not be deleted right now.",
            );
          } finally {
            setAction(null);
          }
        },
      },
    ]);
  };

  const handleImageError = () => {
    if (displayUri && item?.sourceUri && displayUri !== item.sourceUri) {
      setDisplayUri(item.sourceUri);
      setImageStatus("loading");
      return;
    }

    setImageStatus("error");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerState}>
          <ActivityIndicator color="#E9D1A7" />
          <Text style={styles.centerText}>Loading preview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item?.uri) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>Preview unavailable</Text>
          <Text style={styles.emptyText}>
            This saved tattoo image could not be opened.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#FFF6EA" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          Preview
        </Text>
        <View style={styles.iconSpacer} />
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailLabel}>Saved Shot</Text>
        <Text style={styles.detailName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.savedAt ? (
          <Text style={styles.detailMeta}>
            Saved {new Date(item.savedAt).toLocaleString()}
          </Text>
        ) : null}
      </View>

      {isEditing ? (
        <View style={styles.renameCard}>
          <Text style={styles.renameLabel}>Rename Preview</Text>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Enter a preview name"
            placeholderTextColor="#8B7A6C"
            style={styles.renameInput}
          />
          <View style={styles.renameActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setDraftName(item.name);
                setIsEditing(false);
              }}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryButton,
                action === "rename" ? styles.buttonDisabled : null,
              ]}
              onPress={handleRename}
              disabled={action === "rename"}>
              <Text style={styles.primaryButtonText}>Save Name</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.imageFrame}>
        {displayUri ? (
          <RNImage
            key={displayUri}
            source={{ uri: displayUri }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => setImageStatus("loading")}
            onLoad={() => setImageStatus("loaded")}
            onError={handleImageError}
          />
        ) : null}
        {imageStatus === "loading" ? (
          <View pointerEvents="none" style={styles.imageOverlay}>
            <ActivityIndicator color="#E9D1A7" />
            <Text style={styles.centerText}>Loading image...</Text>
          </View>
        ) : null}
        {imageStatus === "error" ? (
          <View pointerEvents="none" style={styles.imageOverlay}>
            <Text style={styles.emptyTitle}>Image unavailable</Text>
            <Text style={styles.emptyText}>
              The saved preview file could not be rendered on this device.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionPanel}>
        <View style={styles.primaryActionRow}>
          <Pressable
            style={[
              styles.primaryActionButton,
              action ? styles.buttonDisabled : null,
            ]}
            onPress={handleShare}
            disabled={Boolean(action)}>
            <Ionicons name="share-social-outline" size={18} color="#1F160F" />
            <Text style={styles.primaryActionText}>Share</Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryActionButton,
              action ? styles.buttonDisabled : null,
            ]}
            onPress={handleDownload}
            disabled={Boolean(action)}>
            <Ionicons name="download-outline" size={18} color="#1F160F" />
            <Text style={styles.primaryActionText}>Download</Text>
          </Pressable>
        </View>
        <View style={styles.secondaryActionRow}>
          <Pressable
            style={[
              styles.secondaryActionPill,
              !isStoredItem ? styles.buttonDisabled : null,
            ]}
            onPress={() => setIsEditing(true)}
            disabled={!isStoredItem}>
            <Ionicons name="create-outline" size={17} color="#FFF4E5" />
            <Text style={styles.secondaryPillText}>Rename</Text>
          </Pressable>
          <Pressable
            style={[
              styles.secondaryActionPill,
              styles.deletePill,
              !isStoredItem || action === "delete" ? styles.buttonDisabled : null,
            ]}
            onPress={handleDelete}
            disabled={!isStoredItem || action === "delete"}>
            <Ionicons name="trash-outline" size={17} color="#FFDCCF" />
            <Text style={styles.deletePillText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0D0907",
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  iconSpacer: {
    width: 44,
    height: 44,
  },
  title: {
    flex: 1,
    color: "#FFF4E5",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  detailCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: "#17110D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  detailLabel: {
    color: "#A78F73",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  detailName: {
    color: "#FFF4E5",
    fontSize: 20,
    fontWeight: "700",
  },
  detailMeta: {
    color: "rgba(255, 244, 229, 0.72)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  renameCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: "#17110D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    gap: 12,
  },
  renameLabel: {
    color: "#FFF4E5",
    fontSize: 14,
    fontWeight: "700",
  },
  renameInput: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#2A201A",
    color: "#FFF4E5",
    fontSize: 15,
    fontWeight: "500",
    paddingHorizontal: 14,
  },
  renameActions: {
    flexDirection: "row",
    gap: 12,
  },
  imageFrame: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: "#17110D",
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(13, 9, 7, 0.94)",
    paddingHorizontal: 24,
  },
  actionPanel: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  primaryActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  primaryActionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexDirection: "row",
    backgroundColor: "#E9D1A7",
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: "#1F160F",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryActionPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#17110D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 14,
  },
  secondaryPillText: {
    color: "#FFF4E5",
    fontSize: 13,
    fontWeight: "700",
  },
  deletePill: {
    borderColor: "rgba(244, 125, 96, 0.22)",
    backgroundColor: "rgba(78, 27, 19, 0.55)",
  },
  deletePillText: {
    color: "#FFDCCF",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9D1A7",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#1F160F",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#FFF4E5",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  centerText: {
    color: "rgba(255, 244, 229, 0.82)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "500",
  },
  emptyTitle: {
    color: "#FFF4E5",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255, 244, 229, 0.82)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "500",
  },
  backButton: {
    minHeight: 48,
    minWidth: 140,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9D1A7",
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: "#1F160F",
    fontSize: 15,
    fontWeight: "700",
  },
});
