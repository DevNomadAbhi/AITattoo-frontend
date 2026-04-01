import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

import {
  CreateHistoryItem,
  getCreateHistory,
  saveCreateHistoryEntry,
} from "@/lib/create-history";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { setSelectedTattoo } from "@/lib/selected-tattoo";

const SERVER_URL = "http://192.168.2.156:3000";
const IMAGE_TO_TATTOO_ENDPOINTS = [
  "/generate-tattoo-from-image",
  "/convert-image-to-tattoo",
] as const;

const textPromptSuggestions = [
  "minimal black fine-line snake wrapping around a rose",
  "ornamental mandala shoulder tattoo with sacred geometry",
  "small gothic raven with smoke and moon details",
  "japanese dragon forearm tattoo stencil with transparent background",
];

const imagePromptSuggestions = [
  "convert this image into a fine-line blackwork tattoo stencil",
  "turn this reference into a minimal tattoo with clean outlines",
  "make this image into a bold black ink tattoo design",
  "transform this artwork into a tattoo-ready transparent PNG",
];

type GeneratedTattooOption = {
  id: string;
  uri: string;
};

type GenerationMode = "text" | "image";

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toImageUri(value: unknown) {
  const imageValue = getStringValue(value);

  if (!imageValue) {
    return null;
  }

  if (
    imageValue.startsWith("data:image/") ||
    imageValue.startsWith("http://") ||
    imageValue.startsWith("https://") ||
    imageValue.startsWith("file://") ||
    imageValue.startsWith("content://") ||
    imageValue.startsWith("blob:")
  ) {
    return imageValue;
  }

  return `data:image/png;base64,${imageValue}`;
}

function looksLikeBase64Image(value: string) {
  if (value.length < 120) {
    return false;
  }

  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function normalizeImageUri(uri: string) {
  if (uri.startsWith("data:image/")) {
    const [header, payload = ""] = uri.split(",", 2);
    const compactPayload = payload.replace(/\s+/g, "");
    return `${header},${compactPayload}`;
  }

  return uri.trim();
}

function extractImageUris(value: unknown, seen = new Set<unknown>()) {
  if (value == null || seen.has(value)) {
    return [];
  }

  if (typeof value === "string") {
    const directUri = toImageUri(value);
    if (directUri) {
      return [directUri];
    }

    return looksLikeBase64Image(value) ? [`data:image/png;base64,${value}`] : [];
  }

  if (Array.isArray(value)) {
    seen.add(value);
    return value.flatMap((item) => extractImageUris(item, seen));
  }

  if (typeof value === "object") {
    seen.add(value);
    const record = value as Record<string, unknown>;
    const directKeys = [
      "uri",
      "url",
      "image",
      "imageUrl",
      "tattooUrl",
      "tattooImage",
      "generatedImage",
      "generatedImageUrl",
      "base64",
      "b64_json",
      "b64Json",
    ] as const;

    const directMatches = directKeys
      .map((key) => toImageUri(record[key]))
      .filter((item): item is string => Boolean(item));

    const nestedMatches = Object.values(record).flatMap((item) =>
      extractImageUris(item, seen)
    );

    return [...directMatches, ...nestedMatches];
  }

  return [];
}

async function readJsonResponse(response: Response) {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    const preview = rawText.slice(0, 140).trim();
    throw new Error(
      `Server did not return JSON. This usually means the endpoint is missing or crashed. Response started with: ${preview}`
    );
  }
}

function collectGeneratedImages(data: Record<string, unknown>) {
  const imageUris = extractImageUris(data);
  const uniqueImages: GeneratedTattooOption[] = [];
  const seen = new Set<string>();

  for (const uri of imageUris) {
    const fingerprint = normalizeImageUri(uri);
    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    uniqueImages.push({
      id: `generated-${uniqueImages.length}`,
      uri,
    });

    if (uniqueImages.length === 4) {
      break;
    }
  }

  return uniqueImages;
}

export default function CreateTattooScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [resultImages, setResultImages] = useState<GeneratedTattooOption[]>([]);
  const [historyItems, setHistoryItems] = useState<CreateHistoryItem[]>([]);
  const [referenceImageUri, setReferenceImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewPanelTop, setPreviewPanelTop] = useState<number | null>(null);
  const prompt = generationMode === "image" ? imagePrompt : textPrompt;
  const setPrompt = generationMode === "image" ? setImagePrompt : setTextPrompt;
  const activePromptSuggestions =
    generationMode === "image" ? imagePromptSuggestions : textPromptSuggestions;

  useEffect(() => {
    if (
      generationMode !== "image" ||
      !resultImages.length ||
      previewPanelTop == null
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(previewPanelTop - 16, 0),
        animated: true,
      });
    }, 40);

    return () => clearTimeout(timeoutId);
  }, [generationMode, previewPanelTop, resultImages]);


  const loadCreateHistory = useCallback(async () => {
    try {
      const items = await getCreateHistory();
      setHistoryItems(items);
    } catch (error) {
      console.error("Failed to load create history", error);
    }
  }, []);

  useEffect(() => {
    loadCreateHistory();
  }, [loadCreateHistory]);

  const restoreHistoryItem = async (item: CreateHistoryItem) => {
    setGenerationMode(item.mode);

    if (item.mode === "image") {
      setImagePrompt(item.prompt);
    } else {
      setTextPrompt(item.prompt);
    }

    setReferenceImageUri(item.referenceImageUri);
    setResultImages(item.resultImages);
  };

  const pickReferenceImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo library access so you can upload a reference image."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setReferenceImageUri(result.assets[0].uri);
      setResultImages([]);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Image upload failed",
        "The reference image could not be selected. Please try again."
      );
    }
  };

  const buildImageToTattooFormData = (trimmedPrompt: string) => {
    if (!referenceImageUri) {
      throw new Error("Upload an image before generating a tattoo from it.");
    }

    const tattooOnlyPrompt = [
      trimmedPrompt,
      "convert this reference into a tattoo design",
      "tattoo design only",
      "isolated transparent background",
      "no skin",
      "no body",
      "no mockup",
      "black ink stencil",
    ].join(", ");

    const filename = referenceImageUri.split("/").pop() ?? "reference-image.jpg";
    const fileExtension = filename.split(".").pop()?.toLowerCase();
    const mimeType =
      fileExtension === "png"
        ? "image/png"
        : fileExtension === "webp"
          ? "image/webp"
          : "image/jpeg";

    const formData = new FormData();
    formData.append("image", {
      uri: referenceImageUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
    formData.append("prompt", tattooOnlyPrompt);
    formData.append("originalPrompt", trimmedPrompt);
    formData.append("transparentBackground", "true");
    formData.append("format", "png");
    formData.append("removeBackground", "true");
    formData.append("isolated", "true");
    formData.append(
      "negativePrompt",
      "white background, solid background, skin, arm, person, mockup, poster, paper, wall, framed artwork, photo background"
    );

    return formData;
  };

  const generateTattooFromReference = async (trimmedPrompt: string) => {
    let lastError: Error | null = null;

    for (const endpoint of IMAGE_TO_TATTOO_ENDPOINTS) {
      try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
          method: "POST",
          body: buildImageToTattooFormData(trimmedPrompt),
        });

        const data = await readJsonResponse(response);

        if (response.status === 404) {
          lastError = new Error(`Endpoint ${endpoint} was not found on the server.`);
          continue;
        }

        if (!response.ok) {
          throw new Error(
            getStringValue(data.error) ??
              `AI failed to convert the image. Server returned ${response.status}.`
          );
        }

        return data;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("Could not convert the uploaded image into a tattoo.");
      }
    }

    throw (
      lastError ??
      new Error("Could not find a backend endpoint to convert the uploaded image.")
    );
  };

  const generateTattoo = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      Alert.alert("Prompt required", "Describe the tattoo you want to generate.");
      return;
    }

    if (generationMode === "image" && !referenceImageUri) {
      Alert.alert(
        "Reference image required",
        "Upload an image before converting it into a tattoo."
      );
      return;
    }

    setLoading(true);
    setResultImages([]);

    try {
      const tattooOnlyPrompt = [
        trimmedPrompt,
        "tattoo design only",
        "isolated transparent background",
        "no white background",
        "no skin",
        "no body",
        "no mockup",
        "no poster",
        "no paper",
        "png tattoo asset",
        "black ink stencil",
      ].join(", ");

      const data = generationMode === "image"
        ? await generateTattooFromReference(trimmedPrompt)
        : await (async () => {
            const response = await fetch(`${SERVER_URL}/generate-tattoo-from-prompt`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: tattooOnlyPrompt,
                originalPrompt: trimmedPrompt,
                transparentBackground: true,
                format: "png",
                removeBackground: true,
                isolated: true,
                negativePrompt:
                  "white background, solid background, skin, arm, person, mockup, poster, paper, wall, framed artwork, photo background",
              }),
            });

            const json = await readJsonResponse(response);

            if (!response.ok) {
              throw new Error(
                getStringValue(json.error) ??
                  `AI failed to generate the tattoo. Server returned ${response.status}.`
              );
            }

            return json;
          })();

      const generatedImages = collectGeneratedImages(data);

      if (!generatedImages.length) {
        throw new Error(
          "The server responded, but no generated tattoo image was returned."
        );
      }

      let nextResultImages = generatedImages;

      try {
        const savedHistory = await saveCreateHistoryEntry({
          mode: generationMode,
          prompt: trimmedPrompt,
          referenceImageUri: generationMode === "image" ? referenceImageUri : null,
          resultImageUris: generatedImages.map((image) => image.uri),
        });

        nextResultImages = savedHistory.resultImages;
        await loadCreateHistory();
      } catch (historyError) {
        console.error("Could not persist create history", historyError);
      }

      setResultImages(nextResultImages);
      await notifySuccess(
        `Generated ${nextResultImages.length} tattoo option${
          nextResultImages.length === 1 ? "" : "s"
        }.`,
      );
    } catch (error) {
      console.error(error);
      await notifyError(
        error instanceof Error
          ? error.message
          : "Could not generate the tattoo right now.",
        "Generation failed",
      );
      Alert.alert(
        "Generation failed",
        error instanceof Error
          ? error.message
          : "Could not generate the tattoo. Check that your Node server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const previewOnCamera = (selectedImage: GeneratedTattooOption) => {
    const tattooName = prompt.trim() || "AI Tattoo";
    setSelectedTattoo(selectedImage.uri, tattooName);

    router.push({
      pathname: "/camera-preview",
      params: {
        tattooName,
      },
    });
  };

  const switchMode = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setResultImages([]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>AI Tattoo Generator</Text>
          <Text style={styles.title}>
            {generationMode === "text"
              ? "Create a tattoo from text."
              : "Turn an image into a tattoo."}
          </Text>
          <Text style={styles.subtitle}>
            {generationMode === "text"
              ? "Write a detailed idea, generate tattoo concepts, then preview them live over the camera."
              : "Upload a reference image, guide the style with a prompt, then convert it into tattoo-ready options."}
          </Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            style={[
              styles.modeChip,
              generationMode === "text" ? styles.modeChipActive : null,
            ]}
            onPress={() => switchMode("text")}>
            <Text
              style={[
                styles.modeChipText,
                generationMode === "text" ? styles.modeChipTextActive : null,
              ]}>
              Text To Tattoo
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeChip,
              generationMode === "image" ? styles.modeChipActive : null,
            ]}
            onPress={() => switchMode("image")}>
            <Text
              style={[
                styles.modeChipText,
                generationMode === "image" ? styles.modeChipTextActive : null,
              ]}>
              Image To Tattoo
            </Text>
          </Pressable>
        </View>

        {historyItems.length ? (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent Creations</Text>
              <Text style={styles.historySubtitle}>
                Restore past prompts, uploaded references, and generated sets.
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyRow}>
              {historyItems.map((item) => {
                const previewUri = item.resultImages[0]?.uri ?? item.referenceImageUri;

                return (
                  <Pressable
                    key={item.id}
                    style={styles.historyCard}
                    onPress={() => {
                      void restoreHistoryItem(item);
                    }}>
                    <View style={styles.historyImageWrap}>
                      {previewUri ? (
                        <Image
                          source={{ uri: previewUri }}
                          style={styles.historyImage}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                          transition={100}
                        />
                      ) : (
                        <View style={styles.historyPlaceholder}>
                          <Text style={styles.historyPlaceholderText}>Prompt</Text>
                        </View>
                      )}
                      <View style={styles.historyBadge}>
                        <Text style={styles.historyBadgeText}>
                          {item.mode === "image" ? "Image" : "Text"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyPrompt} numberOfLines={2}>
                      {item.prompt}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {item.resultImages.length} option{item.resultImages.length === 1 ? "" : "s"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.panel}>
          {generationMode === "image" ? (
            <>
              <Text style={styles.label}>Reference Image</Text>
              <View style={styles.uploadPanel}>
                {referenceImageUri ? (
                  <View style={styles.uploadPreviewWrap}>
                    <Image
                      source={{ uri: referenceImageUri }}
                      style={styles.uploadPreview}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      transition={100}
                    />
                  </View>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadPlaceholderText}>
                      Pick an image from your gallery to turn it into tattoo options.
                    </Text>
                  </View>
                )}

                <View style={styles.uploadActions}>
                  <Pressable style={styles.secondaryButton} onPress={pickReferenceImage}>
                    <Text style={styles.secondaryButtonText}>
                      {referenceImageUri ? "Change Image" : "Upload Image"}
                    </Text>
                  </Pressable>
                  {referenceImageUri ? (
                    <Pressable
                      style={styles.clearButton}
                      onPress={() => setReferenceImageUri(null)}>
                      <Text style={styles.clearButtonText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </>
          ) : null}

          <Text style={styles.label}>
            {generationMode === "text" ? "Tattoo Prompt" : "Style Direction"}
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder={
              generationMode === "image"
                ? "Example: convert this flower sketch into a fine-line blackwork forearm tattoo"
                : "Example: fine-line black dragon wrapped around a dagger, transparent background"
            }
            placeholderTextColor="#8E8277"
            multiline
            textAlignVertical="top"
            style={styles.input}
          />

          <View style={styles.suggestions}>
            {activePromptSuggestions.map((item) => (
              <Pressable
                key={item}
                style={styles.suggestionChip}
                onPress={() => setPrompt(item)}>
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              loading ? styles.primaryButtonDisabled : null,
            ]}
            onPress={generateTattoo}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#1D140E" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {generationMode === "image"
                  ? "Convert Image To Tattoo"
                  : "Generate Tattoo"}
              </Text>
            )}
          </Pressable>
        </View>

        {resultImages.length ? (
          <View
            style={styles.previewPanel}
            onLayout={(event) => {
              setPreviewPanelTop(event.nativeEvent.layout.y);
            }}>
            <Text style={styles.previewTitle}>
              Tap A Tattoo To Preview ({resultImages.length})
            </Text>
            <FlatList
              data={resultImages}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.optionRow}
              contentContainerStyle={styles.optionsList}
              renderItem={({ item, index }) => (
                <Pressable
                  style={styles.optionCard}
                  onPress={() => previewOnCamera(item)}>
                  <View style={styles.optionImageWrap}>
                    <Image
                      source={{ uri: item.uri }}
                      style={[styles.optionImage, styles.previewBlend]}
                      cachePolicy="memory-disk"
                      contentFit="contain"
                      transition={100}
                    />
                  </View>
                  <Text style={styles.optionLabel}>Option {index + 1}</Text>
                </Pressable>
              )}
            />

            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryButton} onPress={generateTattoo}>
                <Text style={styles.secondaryButtonText}>Regenerate</Text>
              </Pressable>
              <Pressable
                style={[styles.cameraButton, styles.cameraButtonDisabled]}
                disabled>
                <Text style={styles.cameraButtonText}>Choose An Option</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F1E8",
  },
  container: {
    padding: 20,
    gap: 18,
  },
  hero: {
    gap: 8,
    paddingTop: 4,
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "#EADFD2",
    borderRadius: 20,
    padding: 6,
    gap: 6,
  },
  modeChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modeChipActive: {
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#DCCDBD",
  },
  modeChipText: {
    color: "#6B5743",
    fontSize: 14,
    fontWeight: "700",
  },
  modeChipTextActive: {
    color: "#22160D",
  },
  historySection: {
    gap: 10,
  },
  historyHeader: {
    gap: 4,
  },
  historyTitle: {
    color: "#24180F",
    fontSize: 18,
    fontWeight: "700",
  },
  historySubtitle: {
    color: "#5E5348",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  historyRow: {
    gap: 12,
    paddingRight: 8,
  },
  historyCard: {
    width: 176,
    backgroundColor: "#FFF9F2",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8DCCE",
    gap: 8,
  },
  historyImageWrap: {
    width: "100%",
    height: 132,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#EEDFD0",
  },
  historyImage: {
    width: "100%",
    height: "100%",
  },
  historyPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E3D3",
  },
  historyPlaceholderText: {
    color: "#6C5848",
    fontSize: 13,
    fontWeight: "700",
  },
  historyBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(18, 13, 10, 0.74)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  historyBadgeText: {
    color: "#FFF4E5",
    fontSize: 11,
    fontWeight: "700",
  },
  historyPrompt: {
    color: "#24180F",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  historyMeta: {
    color: "#7B6B5F",
    fontSize: 12,
    fontWeight: "500",
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
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
  },
  subtitle: {
    color: "#5E5348",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  panel: {
    backgroundColor: "#FFF9F2",
    borderRadius: 22,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E8DCCE",
  },
  uploadPanel: {
    gap: 12,
  },
  uploadPreviewWrap: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#D8C1A4",
    borderWidth: 1,
    borderColor: "#B39471",
  },
  uploadPreview: {
    width: "100%",
    height: "100%",
  },
  uploadPlaceholder: {
    minHeight: 160,
    borderRadius: 18,
    backgroundColor: "#F4EADF",
    borderWidth: 1,
    borderColor: "#D9C7B3",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  uploadPlaceholderText: {
    color: "#655548",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "500",
  },
  uploadActions: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    color: "#24180F",
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    minHeight: 124,
    borderRadius: 18,
    backgroundColor: "#F4EADF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#1F160F",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  suggestions: {
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: "#F1E3D3",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionText: {
    color: "#4C3725",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8D1A8",
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: "#1D140E",
    fontSize: 16,
    fontWeight: "800",
  },
  previewPanel: {
    gap: 12,
  },
  previewTitle: {
    color: "#24180F",
    fontSize: 20,
    fontWeight: "700",
  },
  previewBlend: {
    isolation: "isolate",
    mixBlendMode: "multiply",
  },
  optionsList: {
    gap: 12,
  },
  optionRow: {
    justifyContent: "space-between",
    gap: 12,
  },
  optionCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#E8DCCE",
    alignItems: "stretch",
    gap: 8,
  },
  optionImageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: "#D8C1A4",
    borderWidth: 1,
    borderColor: "#B39471",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  optionImage: {
    width: "100%",
    height: "100%",
  },
  optionLabel: {
    color: "#5C4330",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCCDBD",
  },
  secondaryButtonText: {
    color: "#2C2117",
    fontSize: 15,
    fontWeight: "700",
  },
  clearButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E3D3",
    paddingHorizontal: 18,
  },
  clearButtonText: {
    color: "#4C3725",
    fontSize: 14,
    fontWeight: "700",
  },
  cameraButton: {
    flex: 1.35,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#11181C",
    paddingHorizontal: 16,
  },
  cameraButtonDisabled: {
    opacity: 0.6,
  },
  cameraButtonText: {
    color: "#FFF8ED",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
});






