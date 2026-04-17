import { Fonts } from "@/constants/theme";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  CameraPictureOptions,
  CameraType,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { notifyError, notifyInfo, notifySuccess } from "@/lib/feedback";
import { getSelectedTattoo, saveTattooToLibrary } from "@/lib/selected-tattoo";
import { subscriptionService } from "@/lib/subscription";
import { bookmarkTattooUseCase } from "@/lib/tattoo-api";

const MIN_SCALE = 0.35;
const MAX_SCALE = 4;
const BASE_TATTOO_SIZE = 190;
const MIN_OPACITY = 0.2;
const MAX_OPACITY = 0.95;
const DEFAULT_OPACITY = 0.58;
const ICON_ANIMATION_DURATION_MS = 260;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

export default function CameraPreviewScreen() {
  const router = useRouter();
  const selectedTattoo = getSelectedTattoo();
  const params = useLocalSearchParams<{
    tattooUri?: string | string[];
    tattooName?: string | string[];
    tattooId?: string | string[];
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [exportAction, setExportAction] = useState<
    "library" | "download" | "share" | null
  >(null);
  const [showGuides, setShowGuides] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showIcons, setShowIcons] = useState(true);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [cameraResolution, setCameraResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const previewStageRef = useRef<View | null>(null);
  const isExpoGoAndroid =
    Platform.OS === "android" &&
    Constants.executionEnvironment === "storeClient";

  const tattooUri = Array.isArray(params.tattooUri)
    ? params.tattooUri[0]
    : (params.tattooUri ?? selectedTattoo.uri ?? undefined);
  const tattooName = Array.isArray(params.tattooName)
    ? params.tattooName[0]
    : (params.tattooName ?? selectedTattoo.name ?? "Saved Tattoo");
  const tattooId = Array.isArray(params.tattooId)
    ? params.tattooId[0]
    : (params.tattooId ?? null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);
  const opacity = useSharedValue(DEFAULT_OPACITY);
  const iconVisibility = useSharedValue(showIcons ? 1 : 0);

  // On mount, try to set the highest supported camera resolution
  useEffect(() => {
    (async () => {
      try {
        // Only run on real device
        if (
          cameraRef.current &&
          cameraRef.current.getAvailablePictureSizesAsync
        ) {
          const sizes =
            await cameraRef.current.getAvailablePictureSizesAsync("4:3");
          // Try to find 4K or highest
          let best = sizes.find(
            (s) => s.includes("3840") || s.includes("2160") || s.includes("4k"),
          );
          if (!best && sizes.length) best = sizes[sizes.length - 1];
          if (best) {
            const [w, h] = best.split("x").map(Number);
            setCameraResolution({ width: w, height: h });
          }
        }
      } catch (e) {
        // Ignore errors, fallback to default
      }
    })();
  }, []);

  useEffect(() => {
    setShowInstructions(true);
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [capturedPhotoUri]);

  useEffect(() => {
    iconVisibility.value = withTiming(showIcons ? 1 : 0, {
      duration: ICON_ANIMATION_DURATION_MS,
    });
  }, [iconVisibility, showIcons]);

  useEffect(() => {
    setIsBookmarked(false);
  }, [tattooId]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clamp(startScale.value * event.scale, MIN_SCALE, MAX_SCALE);
    });

  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      startRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = startRotation.value + event.rotation;
    });

  const tattooGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotationGesture,
  );

  const tattooStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${rotation.value}rad` },
        { scale: scale.value },
      ],
    };
  });

  const iconSlideStyle = useAnimatedStyle(() => {
    return {
      opacity: iconVisibility.value,
      transform: [{ translateY: -24 * (1 - iconVisibility.value) }],
    };
  });

  const adjustScale = (delta: number) => {
    scale.value = withTiming(clamp(scale.value + delta, MIN_SCALE, MAX_SCALE));
  };

  const adjustRotation = (delta: number) => {
    rotation.value = withTiming(rotation.value + delta);
  };

  const adjustOpacity = (delta: number) => {
    opacity.value = withTiming(
      clamp(opacity.value + delta, MIN_OPACITY, MAX_OPACITY),
    );
  };

  const resetOverlay = () => {
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    scale.value = withTiming(1);
    rotation.value = withTiming(0);
    opacity.value = withTiming(DEFAULT_OPACITY);
  };

  const handleSaveToLibrary = async () => {
    if (!capturedPhotoUri || exportAction || isSaved) {
      return;
    }

    try {
      setExportAction("library");

      const exportUri = await captureCompositePreview();
      const base64 = await FileSystem.readAsStringAsync(exportUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const capturedShotDataUrl = `data:image/jpeg;base64,${base64}`;

      // Keep API bookmarks in sync with the camera save action so My Tattoos
      // always shows the saved tattoo.
      if (tattooId) {
        const bookmarkResult = await bookmarkTattooUseCase({
          tattooId,
          capturedShot: capturedShotDataUrl,
        });
        setIsBookmarked(true);
        if (bookmarkResult.duplicate) {
          await notifyInfo("Already in your saved tattoos.");
        }
      }

      await saveTattooToLibrary({
        name: `${tattooName} Preview`,
        uri: exportUri,
      });

      setIsSaved(true);
      await notifySuccess("Preview saved to My Tattoos.", "Saved");
      Alert.alert("Saved", "This tattoo preview was added to My Tattoos.");
    } catch (error) {
      console.error("Failed to save preview to My Tattoos", error);
      await notifyError(
        error instanceof Error
          ? error.message
          : "The preview could not be saved right now.",
        "Save failed",
      );
      Alert.alert(
        "Save failed",
        error instanceof Error
          ? error.message
          : "The preview could not be saved right now.",
      );
    } finally {
      setExportAction(null);
    }
  };
  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || capturedPhotoUri || exportAction) {
      return;
    }

    try {
      setIsCapturing(true);

      // Check subscription for HD quality
      const hasProAccess = await subscriptionService.hasProAccess();
      const photoQuality = hasProAccess ? 1.0 : 0.7; // Use max quality for pro

      // Build options for takePictureAsync
      let options: CameraPictureOptions = { quality: photoQuality };
      if (cameraResolution && hasProAccess) {
        options = { ...options, ...cameraResolution };
      }

      const photo = await cameraRef.current.takePictureAsync(options);

      if (photo?.uri) {
        setCapturedPhotoUri(photo.uri);
        setIsSaved(false);
        await notifyInfo(
          hasProAccess ? "4K/HD preview captured." : "Preview captured.",
        );
      }
    } catch (error) {
      console.error("Failed to capture preview image", error);
      await notifyError(
        "The preview photo could not be captured. Please try again.",
        "Capture failed",
      );
      Alert.alert(
        "Capture failed",
        "The preview photo could not be captured. Please try again.",
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const captureCompositePreview = async () => {
    if (!capturedPhotoUri || !previewStageRef.current) {
      throw new Error("Capture a photo before exporting the tattoo preview.");
    }

    // Check subscription for HD export quality
    const hasProAccess = await subscriptionService.hasProAccess();
    const exportQuality = hasProAccess ? 0.95 : 0.75; // HD for pro, standard for free

    return captureRef(previewStageRef, {
      format: "jpg",
      quality: exportQuality,
      result: "tmpfile",
      fileName: `tattoo-preview-${Date.now()}`,
    });
  };

  const saveCapturedPreview = async () => {
    if (!capturedPhotoUri || exportAction) {
      return;
    }

    // Check subscription for download access
    const hasProAccess = await subscriptionService.hasProAccess();
    if (!hasProAccess) {
      Alert.alert(
        "PRO Feature Required",
        "Downloading high-quality tattoo previews is a PRO feature. Upgrade to unlock HD downloads and sharing.",
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
      setExportAction("download");

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
          "Allow photo library access so the tattoo preview can be saved to your device.",
        );
        return;
      }

      const exportUri = await captureCompositePreview();
      await MediaLibrary.saveToLibraryAsync(exportUri);

      await notifySuccess(
        "HD preview downloaded to your photo library.",
        "Saved",
      );
    } catch (error) {
      console.error("Failed to save captured preview", error);
      await notifyError(
        error instanceof Error
          ? error.message
          : "The tattoo preview could not be saved.",
        "Save failed",
      );
      Alert.alert(
        "Save failed",
        error instanceof Error
          ? error.message
          : "The tattoo preview could not be saved.",
      );
    } finally {
      setExportAction(null);
    }
  };

  const shareCapturedPreview = async () => {
    if (!capturedPhotoUri || exportAction) {
      return;
    }

    // Check subscription for share access
    const hasProAccess = await subscriptionService.hasProAccess();
    if (!hasProAccess) {
      Alert.alert(
        "PRO Feature Required",
        "Sharing high-quality tattoo previews is a PRO feature. Upgrade to unlock HD downloads and sharing.",
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
      setExportAction("share");
      const shareAvailable = await Sharing.isAvailableAsync();
      if (!shareAvailable) {
        throw new Error("Sharing is not available on this device.");
      }

      await notifyInfo("Opening share sheet.");
      const exportUri = await captureCompositePreview();
      await Sharing.shareAsync(exportUri, {
        mimeType: "image/jpeg",
        UTI: "public.jpeg",
        dialogTitle: "Share tattoo preview",
      });
    } catch (error) {
      console.error("Failed to share captured preview", error);
      await notifyError(
        error instanceof Error
          ? error.message
          : "The tattoo preview could not be shared.",
        "Share failed",
      );
      Alert.alert(
        "Share failed",
        error instanceof Error
          ? error.message
          : "The tattoo preview could not be shared.",
      );
    } finally {
      setExportAction(null);
    }
  };

  if (!tattooUri) {
    return (
      <SafeAreaView style={styles.fallbackScreen}>
        <StatusBar style="light" />
        <Text style={styles.fallbackTitle}>No tattoo selected</Text>
        <Text style={styles.fallbackText}>
          Go back and tap a design to preview it on the camera.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.fallbackScreen}>
        <StatusBar style="light" />
        <Text style={styles.fallbackText}>Checking camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.fallbackScreen}>
        <StatusBar style="light" />
        <Text style={styles.fallbackTitle}>Camera access needed</Text>
        <Text style={styles.fallbackText}>
          Allow camera access to place and adjust the selected tattoo live.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Allow Camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View
        ref={previewStageRef}
        collapsable={false}
        style={styles.previewStage}
      >
        {capturedPhotoUri ? (
          <Image
            source={{ uri: capturedPhotoUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        ) : (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            onMountError={(event) => {
              console.error("Camera failed to mount", event.nativeEvent);
              void notifyError(
                event.nativeEvent.message ||
                  "The camera preview could not be started on this device.",
                "Camera unavailable",
              );
              Alert.alert(
                "Camera unavailable",
                event.nativeEvent.message ||
                  "The camera preview could not be started on this device.",
              );
            }}
            {...(cameraResolution && {
              photo: {
                width: cameraResolution.width,
                height: cameraResolution.height,
              },
            })}
          />
        )}

        <View pointerEvents="box-none" style={styles.previewOverlay}>
          <View style={styles.canvas} pointerEvents="box-none">
            <GestureDetector gesture={tattooGesture}>
              <Animated.View
                style={[styles.tattooWrap, styles.blendLayer, tattooStyle]}
              >
                <Image
                  source={{ uri: tattooUri }}
                  style={styles.tattooImage}
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  transition={100}
                />
              </Animated.View>
            </GestureDetector>
          </View>
        </View>
      </View>

      <SafeAreaView style={styles.overlayLayer} pointerEvents="box-none">
        <View style={styles.headerWrap} pointerEvents="box-none">
          <Pressable
            style={styles.iconOnlyButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#FFF6EA" />
          </Pressable>

          <View style={styles.headerSpacer} />

          <Animated.View
            style={[styles.topToolsRow, iconSlideStyle]}
            pointerEvents={showIcons ? "auto" : "none"}
          >
            <Pressable
              style={[
                styles.iconOnlyButton,
                showGuides ? styles.sideIconButtonActive : null,
              ]}
              onPress={() => setShowGuides((current) => !current)}
            >
              <Ionicons name="grid-outline" size={18} color="#FFF4E5" />
            </Pressable>

            <Pressable style={styles.iconOnlyButton} onPress={resetOverlay}>
              <Ionicons name="refresh-outline" size={20} color="#FFF4E5" />
            </Pressable>

            <Pressable
              style={[
                styles.iconOnlyButton,
                styles.flipIconButton,
                capturedPhotoUri ? styles.disabledButton : null,
              ]}
              onPress={() =>
                setFacing((current) => (current === "back" ? "front" : "back"))
              }
              disabled={Boolean(capturedPhotoUri)}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={20}
                color="#FFF6EA"
              />
            </Pressable>
          </Animated.View>

          <Pressable
            style={styles.iconOnlyButton}
            onPress={() => setShowIcons((current) => !current)}
          >
            <Ionicons
              name={showIcons ? "eye-outline" : "eye-off-outline"}
              size={20}
              color="#FFF6EA"
            />
          </Pressable>
        </View>

        {showInstructions && showIcons && (
          <View style={styles.instructionsBanner} pointerEvents="none">
            <Text style={styles.instructions}>
              {capturedPhotoUri
                ? "Shot frozen. Fine-tune placement, then download or share."
                : "Drag, pinch, and twist the tattoo. Use the side controls to refine placement."}
            </Text>
          </View>
        )}

        {showGuides && showIcons ? (
          <View style={styles.guideLayer} pointerEvents="none">
            <View style={styles.guideVertical} />
            <View style={styles.guideHorizontal} />
            <View style={styles.guideTorso} />
          </View>
        ) : null}

        <Animated.View
          style={[styles.sideControls, iconSlideStyle]}
          pointerEvents={showIcons ? "box-none" : "none"}
        >
          <View
            style={[styles.sideRail, styles.rightRail, styles.topAlignedRail]}
            pointerEvents="box-none"
          >
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustScale(-0.15)}
            >
              <FontAwesome6
                name="magnifying-glass-minus"
                size={18}
                color="#FFF4E5"
              />
            </Pressable>
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustScale(0.15)}
            >
              <FontAwesome6
                name="magnifying-glass-plus"
                size={18}
                color="#FFF4E5"
              />
            </Pressable>
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustOpacity(-0.08)}
            >
              <MaterialIcons name="brightness-4" size={20} color="#FFF4E5" />
            </Pressable>
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustOpacity(0.08)}
            >
              <MaterialIcons name="brightness-5" size={20} color="#FFF4E5" />
            </Pressable>
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustRotation(-Math.PI / 12)}
            >
              <FontAwesome6 name="rotate-left" size={17} color="#FFF4E5" />
            </Pressable>
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustRotation(Math.PI / 12)}
            >
              <FontAwesome6 name="rotate-right" size={17} color="#FFF4E5" />
            </Pressable>

            {capturedPhotoUri ? (
              <>
                <Pressable
                  style={[styles.sideIconButton, styles.secondaryActionButton]}
                  onPress={() => {
                    setCapturedPhotoUri(null);
                    setIsSaved(false);
                  }}
                  disabled={Boolean(exportAction)}
                >
                  <Ionicons name="camera-outline" size={20} color="#FFF4E5" />
                </Pressable>
                <Pressable
                  style={[
                    styles.sideIconButton,
                    isSaved
                      ? styles.sideIconButtonActive
                      : styles.secondaryActionButton,
                    exportAction ? styles.disabledCapture : null,
                  ]}
                  onPress={handleSaveToLibrary}
                  disabled={Boolean(exportAction) || isSaved}
                >
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color="#FFF4E5"
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.sideIconButton,
                    styles.primaryActionButton,
                    exportAction || isExpoGoAndroid
                      ? styles.disabledCapture
                      : null,
                  ]}
                  onPress={saveCapturedPreview}
                  disabled={Boolean(exportAction) || isExpoGoAndroid}
                >
                  <Ionicons
                    name={
                      isExpoGoAndroid ? "build-outline" : "download-outline"
                    }
                    size={20}
                    color="#1D140E"
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.sideIconButton,
                    styles.darkActionButton,
                    exportAction ? styles.disabledCapture : null,
                  ]}
                  onPress={shareCapturedPreview}
                  disabled={Boolean(exportAction)}
                >
                  <Ionicons
                    name="share-social-outline"
                    size={20}
                    color="#FFF4E5"
                  />
                </Pressable>
              </>
            ) : null}
          </View>
        </Animated.View>

        {!capturedPhotoUri ? (
          <View style={styles.bottomCaptureWrap} pointerEvents="box-none">
            <Pressable
              style={[
                styles.captureIconButton,
                isCapturing ? styles.disabledCapture : null,
              ]}
              onPress={takePicture}
              disabled={isCapturing}
            >
              <Ionicons
                name={isCapturing ? "hourglass-outline" : "camera-outline"}
                size={24}
                color="#1D140E"
              />
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050505",
    fontFamily: Fonts.fredoka,
  },
  overlayLayer: {
    flex: 1,
    fontFamily: Fonts.fredoka,
  },
  previewStage: {
    ...StyleSheet.absoluteFillObject,
    fontFamily: Fonts.fredoka,
  },
  previewOverlay: {
    flex: 1,
    fontFamily: Fonts.fredoka,
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    fontFamily: Fonts.fredoka,
  },
  headerSpacer: {
    flex: 1,
    fontFamily: Fonts.fredoka,
  },
  topToolsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8,
    fontFamily: Fonts.fredoka,
  },
  iconOnlyButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(10, 10, 10, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: Fonts.fredoka,
  },
  flipIconButton: {
    paddingLeft: 1,
    fontFamily: Fonts.fredoka,
  },
  disabledButton: {
    opacity: 0.45,
    fontFamily: Fonts.fredoka,
  },
  sideControls: {
    ...StyleSheet.absoluteFillObject,
    fontFamily: Fonts.fredoka,
  },
  sideRail: {
    width: 56,
    gap: 8,
    alignItems: "center",
    position: "absolute",
    fontFamily: Fonts.fredoka,
  },
  leftRail: {
    left: 8,
    fontFamily: Fonts.fredoka,
  },
  rightRail: {
    right: 8,
    fontFamily: Fonts.fredoka,
  },
  topAlignedRail: {
    top: 118,
    justifyContent: "flex-start",
    fontFamily: Fonts.fredoka,
  },
  canvas: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: Fonts.fredoka,
  },
  tattooWrap: {
    width: BASE_TATTOO_SIZE,
    height: BASE_TATTOO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: Fonts.fredoka,
  },
  blendLayer: {
    isolation: "isolate",
    mixBlendMode: "multiply",
    fontFamily: Fonts.fredoka,
  },
  tattooImage: {
    width: "100%",
    height: "100%",
    fontFamily: Fonts.fredoka,
  },
  instructionsBanner: {
    marginTop: 12,
    marginHorizontal: 84,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(11, 10, 9, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    fontFamily: Fonts.fredoka,
  },
  instructions: {
    color: "#F7E9D4",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  guideLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: Fonts.fredoka,
  },
  guideVertical: {
    position: "absolute",
    width: 1,
    top: "23%",
    bottom: "18%",
    backgroundColor: "rgba(255, 244, 229, 0.2)",
    fontFamily: Fonts.fredoka,
  },
  guideHorizontal: {
    position: "absolute",
    left: "24%",
    right: "24%",
    top: "45%",
    height: 1,
    backgroundColor: "rgba(255, 244, 229, 0.16)",
    fontFamily: Fonts.fredoka,
  },
  guideTorso: {
    position: "absolute",
    width: 180,
    height: 260,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 244, 229, 0.14)",
    fontFamily: Fonts.fredoka,
  },
  sideIconButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(11, 10, 9, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: Fonts.fredoka,
  },
  sideIconButtonActive: {
    backgroundColor: "rgba(233, 209, 167, 0.18)",
    borderColor: "rgba(233, 209, 167, 0.36)",
    fontFamily: Fonts.fredoka,
  },
  captureIconButton: {
    width: 68,
    height: 68,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4E1",
    borderWidth: 4,
    borderColor: "rgba(20, 16, 12, 0.14)",
    fontFamily: Fonts.fredoka,
  },
  bottomCaptureWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 86,
    alignItems: "center",
    fontFamily: Fonts.fredoka,
  },
  primaryActionButton: {
    backgroundColor: "#FFF4E1",
    fontFamily: Fonts.fredoka,
  },
  secondaryActionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    fontFamily: Fonts.fredoka,
  },
  darkActionButton: {
    backgroundColor: "#17110D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    fontFamily: Fonts.fredoka,
  },
  disabledCapture: {
    opacity: 0.65,
    fontFamily: Fonts.fredoka,
  },
  resetButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    minHeight: 48,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    fontFamily: Fonts.fredoka,
  },
  resetButtonText: {
    color: "#FFF4E5",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  fallbackScreen: {
    flex: 1,
    backgroundColor: "#0D0907",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
    fontFamily: Fonts.fredoka,
  },
  fallbackTitle: {
    color: "#FFF4E5",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: Fonts.fredoka,
  },
  fallbackText: {
    color: "rgba(255, 244, 229, 0.84)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  primaryButton: {
    marginTop: 8,
    minWidth: 170,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9D1A7",
    paddingHorizontal: 20,
    fontFamily: Fonts.fredoka,
  },
  primaryButtonText: {
    color: "#21160E",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
});
