import { Fonts } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Image as RNImage,
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
import { subscriptionService } from "@/lib/subscription";

type PreviewAction = "delete" | "download" | "rename" | "share" | null;
type PreviewItem = SavedTattoo;

async function ensureLocalFileUri(uri: string) {
  if (uri.startsWith("file://")) {
    return uri;
  }

  const extension = uri.toLowerCase().includes(".png") ? "png" : "jpg";
  const targetUri = `${FileSystem.cacheDirectory}shared-preview-${Date.now()}.${extension}`;
  const downloadResult = await FileSystem.downloadAsync(uri, targetUri);

  if (downloadResult.status < 200 || downloadResult.status >= 300) {
    throw new Error("Failed to prepare image for sharing.");
  }

  return downloadResult.uri;
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
  const [imageStatus, setImageStatus] = useState<
    "error" | "loaded" | "loading"
  >("loading");
  const [isEditing, setIsEditing] = useState(false);
  const [item, setItem] = useState<PreviewItem | null>(null);
  const [loading, setLoading] = useState(true);

  const previewId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fallbackImageUri = Array.isArray(params.imageUri)
    ? params.imageUri[0]
    : params.imageUri;
  const fallbackTitle = Array.isArray(params.title)
    ? params.title[0]
    : params.title;
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

    // Check subscription for share access
    const hasProAccess = await subscriptionService.hasProAccess();
    if (!hasProAccess) {
      Alert.alert(
        "PRO Feature Required",
        "Sharing tattoo previews is a PRO feature. Upgrade to unlock sharing and HD downloads.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade to PRO",
            onPress: () => {
              router.push("/(tabs)/profile");
            },
          },
        ],
      );
      return;
    }

    try {
      setAction("share");
      const shareAvailable = await Sharing.isAvailableAsync();
      if (!shareAvailable) {
        throw new Error("Sharing is not available on this device.");
      }

      const localShareUri = await ensureLocalFileUri(displayUri);
      await notifyInfo("Opening share sheet.");
      await Sharing.shareAsync(localShareUri, {
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

    // Check subscription for download access
    const hasProAccess = await subscriptionService.hasProAccess();
    if (!hasProAccess) {
      Alert.alert(
        "PRO Feature Required",
        "Downloading tattoo previews is a PRO feature. Upgrade to unlock HD downloads and sharing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade to PRO",
            onPress: () => {
              router.push("/(tabs)/profile");
            },
          },
        ],
      );
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
        throw new Error(
          "Photo library access is not available on this device.",
        );
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

      const localDownloadUri = await ensureLocalFileUri(displayUri);
      await MediaLibrary.saveToLibraryAsync(localDownloadUri);
      await notifySuccess("HD preview downloaded to your photos.", "Saved");
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
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryButton,
                action === "rename" ? styles.buttonDisabled : null,
              ]}
              onPress={handleRename}
              disabled={action === "rename"}
            >
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
            disabled={Boolean(action)}
          >
            <Ionicons name="share-social-outline" size={18} color="#1F160F" />
            <Text style={styles.primaryActionText}>Share</Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryActionButton,
              action ? styles.buttonDisabled : null,
            ]}
            onPress={handleDownload}
            disabled={Boolean(action)}
          >
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
            disabled={!isStoredItem}
          >
            <Ionicons name="create-outline" size={17} color="#FFF4E5" />
            <Text style={styles.secondaryPillText}>Rename</Text>
          </Pressable>
          <Pressable
            style={[
              styles.secondaryActionPill,
              styles.deletePill,
              !isStoredItem || action === "delete"
                ? styles.buttonDisabled
                : null,
            ]}
            onPress={handleDelete}
            disabled={!isStoredItem || action === "delete"}
          >
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
    fontFamily: Fonts.fredoka,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  iconSpacer: {
    width: 44,
    height: 44,
    fontFamily: Fonts.fredoka,
  },
  title: {
    flex: 1,
    color: "#FFF4E5",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  detailLabel: {
    color: "#A78F73",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: Fonts.fredoka,
  },
  detailName: {
    color: "#FFF4E5",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  detailMeta: {
    color: "rgba(255, 244, 229, 0.72)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  renameLabel: {
    color: "#FFF4E5",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  renameInput: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#2A201A",
    color: "#FFF4E5",
    fontSize: 15,
    fontWeight: "500",
    paddingHorizontal: 14,
    fontFamily: Fonts.fredoka,
  },
  renameActions: {
    flexDirection: "row",
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  imageFrame: {
    flex: 1,
    marginHorizontal: 0,
    backgroundColor: "#17110D",
    overflow: "hidden",
    position: "relative",
    fontFamily: Fonts.fredoka,
  },
  image: {
    width: "100%",
    height: "100%",
    fontFamily: Fonts.fredoka,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(13, 9, 7, 0.94)",
    paddingHorizontal: 24,
    fontFamily: Fonts.fredoka,
  },
  actionPanel: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    fontFamily: Fonts.fredoka,
  },
  primaryActionRow: {
    flexDirection: "row",
    gap: 12,
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  primaryActionText: {
    color: "#1F160F",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: 12,
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  secondaryPillText: {
    color: "#FFF4E5",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  deletePill: {
    borderColor: "rgba(244, 125, 96, 0.22)",
    backgroundColor: "rgba(78, 27, 19, 0.55)",
    fontFamily: Fonts.fredoka,
  },
  deletePillText: {
    color: "#FFDCCF",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9D1A7",
    paddingHorizontal: 16,
    fontFamily: Fonts.fredoka,
  },
  primaryButtonText: {
    color: "#1F160F",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  secondaryButtonText: {
    color: "#FFF4E5",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  buttonDisabled: {
    opacity: 0.6,
    fontFamily: Fonts.fredoka,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
    fontFamily: Fonts.fredoka,
  },
  centerText: {
    color: "rgba(255, 244, 229, 0.82)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  emptyTitle: {
    color: "#FFF4E5",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: Fonts.fredoka,
  },
  emptyText: {
    color: "rgba(255, 244, 229, 0.82)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  backButton: {
    minHeight: 48,
    minWidth: 140,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9D1A7",
    paddingHorizontal: 20,
    fontFamily: Fonts.fredoka,
  },
  backButtonText: {
    color: "#1F160F",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
});
