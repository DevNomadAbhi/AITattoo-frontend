import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
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

const MIN_SCALE = 0.35;
const MAX_SCALE = 4;
const BASE_TATTOO_SIZE = 190;
const MIN_OPACITY = 0.2;
const MAX_OPACITY = 0.95;
const DEFAULT_OPACITY = 0.58;

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
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [exportAction, setExportAction] = useState<"library" | "download" | "share" | null>(
    null,
  );
  const [showGuides, setShowGuides] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
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
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);
  const opacity = useSharedValue(DEFAULT_OPACITY);

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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });

      if (photo?.uri) {
        setCapturedPhotoUri(photo.uri);
        setIsSaved(false);
        await notifyInfo("Preview captured.");
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

    return captureRef(previewStageRef, {
      format: "jpg",
      quality: 0.82,
      result: "tmpfile",
      fileName: `tattoo-preview-${Date.now()}`,
    });
  };

  const saveCapturedPreview = async () => {
    if (!capturedPhotoUri || exportAction) {
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

      await notifySuccess("Preview downloaded to your photo library.", "Saved");
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
            <Ionicons name="camera-reverse-outline" size={20} color="#FFF6EA" />
          </Pressable>
        </View>

        <View style={styles.instructionsBanner} pointerEvents="none">
          <Text style={styles.instructions}>
            {capturedPhotoUri
              ? "Shot frozen. Fine-tune placement, then download or share."
              : "Drag, pinch, and twist the tattoo. Use the side controls to refine placement."}
          </Text>
        </View>

        {showGuides ? (
          <View style={styles.guideLayer} pointerEvents="none">
            <View style={styles.guideVertical} />
            <View style={styles.guideHorizontal} />
            <View style={styles.guideTorso} />
          </View>
        ) : null}

        <View style={styles.sideControls} pointerEvents="box-none">
          <View
            style={[styles.sideRail, styles.leftRail, styles.topAlignedRail]}
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
              <Ionicons name="eye-off-outline" size={19} color="#FFF4E5" />
            </Pressable>
          </View>

          <View
            style={[styles.sideRail, styles.rightRail, styles.topAlignedRail]}
            pointerEvents="box-none"
          >
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustRotation(-Math.PI / 12)}
            >
              <Ionicons name="arrow-undo" size={18} color="#FFF4E5" />
            </Pressable>
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustRotation(Math.PI / 12)}
            >
              <Ionicons name="arrow-redo" size={18} color="#FFF4E5" />
            </Pressable>
            <Pressable
              style={styles.sideIconButton}
              onPress={() => adjustOpacity(0.08)}
            >
              <Ionicons name="eye-outline" size={20} color="#FFF4E5" />
            </Pressable>
            <Pressable
              style={[
                styles.sideIconButton,
                showGuides ? styles.sideIconButtonActive : null,
              ]}
              onPress={() => setShowGuides((current) => !current)}
            >
              <Ionicons name="grid-outline" size={18} color="#FFF4E5" />
            </Pressable>

            <Pressable style={styles.sideIconButton} onPress={resetOverlay}>
              <Ionicons name="refresh" size={20} color="#FFF4E5" />
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
                  <Ionicons
                    name="camera-reverse-outline"
                    size={20}
                    color="#FFF4E5"
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.sideIconButton,
                    isSaved ? styles.sideIconButtonActive : styles.secondaryActionButton,
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
        </View>

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
  },
  overlayLayer: {
    flex: 1,
  },
  previewStage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewOverlay: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerSpacer: {
    flex: 1,
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
  },
  flipIconButton: {
    paddingLeft: 1,
  },
  disabledButton: {
    opacity: 0.45,
  },
  sideControls: {
    ...StyleSheet.absoluteFillObject,
  },
  sideRail: {
    width: 56,
    gap: 8,
    alignItems: "center",
    position: "absolute",
  },
  leftRail: {
    left: 8,
  },
  rightRail: {
    right: 8,
  },
  topAlignedRail: {
    top: 118,
    justifyContent: "flex-start",
  },
  canvas: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tattooWrap: {
    width: BASE_TATTOO_SIZE,
    height: BASE_TATTOO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  blendLayer: {
    isolation: "isolate",
    mixBlendMode: "multiply",
  },
  tattooImage: {
    width: "100%",
    height: "100%",
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
  },
  instructions: {
    color: "#F7E9D4",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  guideLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  guideVertical: {
    position: "absolute",
    width: 1,
    top: "23%",
    bottom: "18%",
    backgroundColor: "rgba(255, 244, 229, 0.2)",
  },
  guideHorizontal: {
    position: "absolute",
    left: "24%",
    right: "24%",
    top: "45%",
    height: 1,
    backgroundColor: "rgba(255, 244, 229, 0.16)",
  },
  guideTorso: {
    position: "absolute",
    width: 180,
    height: 260,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 244, 229, 0.14)",
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
  },
  sideIconButtonActive: {
    backgroundColor: "rgba(233, 209, 167, 0.18)",
    borderColor: "rgba(233, 209, 167, 0.36)",
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
  },
  bottomCaptureWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 86,
    alignItems: "center",
  },
  primaryActionButton: {
    backgroundColor: "#FFF4E1",
  },
  secondaryActionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  darkActionButton: {
    backgroundColor: "#17110D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  disabledCapture: {
    opacity: 0.65,
  },
  resetButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    minHeight: 48,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  resetButtonText: {
    color: "#FFF4E5",
    fontSize: 14,
    fontWeight: "700",
  },
  fallbackScreen: {
    flex: 1,
    backgroundColor: "#0D0907",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  fallbackTitle: {
    color: "#FFF4E5",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  fallbackText: {
    color: "rgba(255, 244, 229, 0.84)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    fontWeight: "500",
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
  },
  primaryButtonText: {
    color: "#21160E",
    fontSize: 15,
    fontWeight: "700",
  },
});







