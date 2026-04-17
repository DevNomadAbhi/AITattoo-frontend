import { Fonts } from "@/constants/theme";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
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

import { notifyError, notifySuccess } from "@/lib/feedback";
import { setSelectedTattoo } from "@/lib/selected-tattoo";
import {
    generateTattooFromImageUseCase,
    generateTattooFromPromptUseCase,
    getCreditsUseCase,
    getRecentCreationsUseCase,
    saveAiTattooUseCase,
    saveRecentCreationsUseCase,
} from "@/lib/tattoo-api";

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

type CreateHistoryResultImage = {
  id: string;
  uri: string;
};

type CreateHistoryItem = {
  createdAt: string;
  id: string;
  mode: GenerationMode;
  prompt: string;
  referenceImageUri: string | null;
  resultImages: CreateHistoryResultImage[];
};

type GenerationMode = "text" | "image";
const MAX_IMAGES_PER_GENERATION = 4;

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isImageUri(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("data:image/") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("file://") ||
    normalized.startsWith("content://") ||
    normalized.startsWith("blob:")
  );
}

function toImageUri(value: unknown) {
  const imageValue = getStringValue(value);

  if (!imageValue) {
    return null;
  }

  const trimmed = imageValue.trim();
  if (!trimmed) {
    return null;
  }

  if (isImageUri(trimmed)) {
    return trimmed;
  }

  if (looksLikeBase64Image(trimmed)) {
    return `data:image/png;base64,${trimmed}`;
  }

  return null;
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

function getMimeTypeFromUri(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/png";
}

async function toSavableGeneratedImage(imageUri: string): Promise<string> {
  if (imageUri.startsWith("data:image/")) {
    return imageUri;
  }

  if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
    return imageUri;
  }

  if (imageUri.startsWith("file://") || imageUri.startsWith("content://")) {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mimeType = getMimeTypeFromUri(imageUri);
    return `data:${mimeType};base64,${base64}`;
  }

  return imageUri;
}

function extractImageUris(value: unknown, seen = new Set<unknown>()): string[] {
  if (value == null || seen.has(value)) {
    return [];
  }

  if (typeof value === "string") {
    const directUri = toImageUri(value);
    if (directUri) {
      return [directUri];
    }

    return looksLikeBase64Image(value)
      ? [`data:image/png;base64,${value}`]
      : [];
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

    const nestedMatches: string[] = Object.values(record).flatMap((item) =>
      extractImageUris(item, seen),
    );

    return [...directMatches, ...nestedMatches];
  }

  return [];
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

    if (uniqueImages.length === MAX_IMAGES_PER_GENERATION) {
      break;
    }
  }

  return uniqueImages;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getRowsFromRecentCreationsPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const record = toRecord(payload);
  if (!record) return [];

  const candidates = [
    record.recentCreations,
    record.items,
    record.data,
    record.created,
    record.rows,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function mapRecentCreationsToHistoryItems(
  payload: unknown,
): CreateHistoryItem[] {
  const rows = getRowsFromRecentCreationsPayload(payload);
  const grouped = new Map<string, CreateHistoryItem>();

  rows.forEach((row, index) => {
    const record = toRecord(row);
    if (!record) return;

    const prompt =
      getStringValue(record.prompt) ??
      getStringValue(record.name) ??
      "Recent creation";
    const modeCandidate = getStringValue(record.mode);
    const mode: GenerationMode = modeCandidate === "image" ? "image" : "text";

    const createdAt =
      getStringValue(record.createdAt) ??
      getStringValue(record.updatedAt) ??
      new Date().toISOString();

    const groupId =
      getStringValue(record.requestGroupId) ??
      getStringValue(record.groupId) ??
      getStringValue(record.id) ??
      `${prompt}-${createdAt}-${index}`;

    const rowImages = extractImageUris(record.images ?? row).filter(isImageUri);

    if (!grouped.has(groupId)) {
      grouped.set(groupId, {
        createdAt,
        id: groupId,
        mode,
        prompt,
        referenceImageUri: null,
        resultImages: [],
      });
    }

    const item = grouped.get(groupId)!;
    for (const uri of rowImages) {
      if (item.resultImages.length >= MAX_IMAGES_PER_GENERATION) {
        break;
      }

      if (item.resultImages.some((result) => result.uri === uri)) {
        continue;
      }

      item.resultImages.push({
        id: `history-${item.resultImages.length}`,
        uri,
      });

      if (item.resultImages.length >= MAX_IMAGES_PER_GENERATION) {
        break;
      }
    }
  });

  return [...grouped.values()]
    .filter(
      (item) =>
        item.resultImages.length > 0 &&
        item.resultImages.some((image) => isImageUri(image.uri)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function CreateTattooScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [resultImages, setResultImages] = useState<GeneratedTattooOption[]>([]);
  const [historyItems, setHistoryItems] = useState<CreateHistoryItem[]>([]);
  const [referenceImageUri, setReferenceImageUri] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedResultImage, setSelectedResultImage] =
    useState<GeneratedTattooOption | null>(null);
  const [savedTattooIdsByImage, setSavedTattooIdsByImage] = useState<
    Record<string, string>
  >({});
  const [credits, setCredits] = useState<number | null>(null);
  const [previewPanelTop, setPreviewPanelTop] = useState<number | null>(null);
  const prompt = generationMode === "image" ? imagePrompt : textPrompt;
  const setPrompt = generationMode === "image" ? setImagePrompt : setTextPrompt;
  const activePromptSuggestions =
    generationMode === "image" ? imagePromptSuggestions : textPromptSuggestions;

  useEffect(() => {
    if (!resultImages.length || previewPanelTop == null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(previewPanelTop - 16, 0),
        animated: true,
      });
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [previewPanelTop, resultImages]);

  const loadCreateHistory = useCallback(async () => {
    try {
      const raw = await getRecentCreationsUseCase();
      const items = mapRecentCreationsToHistoryItems(raw);
      setHistoryItems(items);
    } catch (error) {
      console.error("Failed to load create history", error);
    }
  }, []);

  useEffect(() => {
    loadCreateHistory();
  }, [loadCreateHistory]);

  // Always refresh credits when screen is focused
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          const result = await getCreditsUseCase();
          if (isActive) setCredits(result.creditsRemaining);
        } catch (err) {
          console.error("Failed to load credit count", err);
        }
      })();
      return () => {
        isActive = false;
      };
    }, []),
  );

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
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo library access so you can upload a reference image.",
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
        "The reference image could not be selected. Please try again.",
      );
    }
  };

  const generateTattoo = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      Alert.alert(
        "Prompt required",
        "Describe the tattoo you want to generate.",
      );
      return;
    }

    if (generationMode === "image" && !referenceImageUri) {
      Alert.alert(
        "Reference image required",
        "Upload an image before converting it into a tattoo.",
      );
      return;
    }

    setLoading(true);
    setResultImages([]);
    setSelectedResultImage(null);
    setSavedTattooIdsByImage({});

    try {
      const data =
        generationMode === "image"
          ? await generateTattooFromImageUseCase(
              referenceImageUri!,
              trimmedPrompt,
            )
          : await generateTattooFromPromptUseCase(trimmedPrompt);

      if (typeof data.creditsRemaining === "number") {
        setCredits(data.creditsRemaining);
      }

      const generatedImages = collectGeneratedImages(data);

      if (!generatedImages.length) {
        throw new Error(
          "The server responded, but no generated tattoo image was returned.",
        );
      }

      try {
        const savableImages = await Promise.all(
          generatedImages.map((image) => toSavableGeneratedImage(image.uri)),
        );

        await saveRecentCreationsUseCase({
          name: trimmedPrompt,
          description: "Saved from AI result",
          prompt: trimmedPrompt,
          model: "stability",
          images: savableImages,
        });
        await loadCreateHistory();
      } catch (historyError) {
        console.error("Could not sync recent creations", historyError);
      }

      setResultImages(generatedImages);

      try {
        const refreshedCredits = await getCreditsUseCase();
        setCredits(refreshedCredits.creditsRemaining);
      } catch (creditRefreshError) {
        console.error(
          "Failed to refresh credits after generation",
          creditRefreshError,
        );
      }

      await notifySuccess(
        `Generated ${generatedImages.length} tattoo option${
          generatedImages.length === 1 ? "" : "s"
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
          : "Could not generate the tattoo. Check that your Node server is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const saveAiTattoo = async () => {
    if (!selectedResultImage) return;
    setSaving(true);
    try {
      const generatedImageForSave = await toSavableGeneratedImage(
        selectedResultImage.uri,
      );

      const response = await saveAiTattooUseCase({
        name: prompt.trim() || "AI Tattoo",
        category: "minimal",
        description: "Saved from AI result",
        generatedImage: generatedImageForSave,
        prompt: prompt.trim(),
        model: "stability",
      });

      const responseRecord = response as Record<string, unknown>;
      const nestedTattoo =
        typeof responseRecord.tattoo === "object" && responseRecord.tattoo
          ? (responseRecord.tattoo as Record<string, unknown>)
          : null;
      const savedIdCandidate =
        getStringValue(responseRecord.id) ??
        getStringValue(responseRecord.tattooId) ??
        (nestedTattoo ? getStringValue(nestedTattoo.id) : null);

      if (savedIdCandidate) {
        const imageKey = normalizeImageUri(selectedResultImage.uri);
        setSavedTattooIdsByImage((current) => ({
          ...current,
          [imageKey]: savedIdCandidate,
        }));
      }

      await notifySuccess("Tattoo saved to catalog!");
    } catch (error) {
      await notifyError(
        error instanceof Error ? error.message : "Could not save the tattoo.",
        "Save failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const previewOnCamera = async (selectedImage: GeneratedTattooOption) => {
    const tattooName = prompt.trim() || "AI Tattoo";
    const imageKey = normalizeImageUri(selectedImage.uri);
    let tattooId: string | null = savedTattooIdsByImage[imageKey] ?? null;

    if (!tattooId) {
      try {
        setSaving(true);
        const generatedImageForSave = await toSavableGeneratedImage(
          selectedImage.uri,
        );

        const response = await saveAiTattooUseCase({
          name: tattooName,
          category: "minimal",
          description: "Saved from AI result",
          generatedImage: generatedImageForSave,
          prompt: prompt.trim(),
          model: "stability",
        });

        const responseRecord = response as Record<string, unknown>;
        const nestedTattoo =
          typeof responseRecord.tattoo === "object" && responseRecord.tattoo
            ? (responseRecord.tattoo as Record<string, unknown>)
            : null;
        tattooId =
          getStringValue(responseRecord.id) ??
          getStringValue(responseRecord.tattooId) ??
          (nestedTattoo ? getStringValue(nestedTattoo.id) : null);

        if (tattooId) {
          const resolvedTattooId = tattooId;
          setSavedTattooIdsByImage((current) => ({
            ...current,
            [imageKey]: resolvedTattooId,
          }));
          await notifySuccess("Tattoo saved to catalog before preview.");
        }
      } catch (error) {
        await notifyError(
          error instanceof Error
            ? error.message
            : "Could not save the tattoo before preview.",
          "Save failed",
        );
      } finally {
        setSaving(false);
      }
    }

    if (!tattooId) {
      await notifyError(
        "Could not save this design to catalog, so captured shots cannot sync yet.",
        "Save required",
      );
      return;
    }

    setSelectedTattoo(selectedImage.uri, tattooName);

    router.push({
      pathname: "/camera-preview",
      params: {
        tattooName,
        tattooId: tattooId ?? undefined,
      },
    });
  };

  const switchMode = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setResultImages([]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <Text style={styles.kicker}>AI Tattoo Generator</Text>
            <Text style={styles.creditCount}>Credits: {credits ?? "—"}</Text>
          </View>
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
            onPress={() => switchMode("text")}
          >
            <Text
              style={[
                styles.modeChipText,
                generationMode === "text" ? styles.modeChipTextActive : null,
              ]}
            >
              Text To Tattoo
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeChip,
              generationMode === "image" ? styles.modeChipActive : null,
            ]}
            onPress={() => switchMode("image")}
          >
            <Text
              style={[
                styles.modeChipText,
                generationMode === "image" ? styles.modeChipTextActive : null,
              ]}
            >
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
              contentContainerStyle={styles.historyRow}
            >
              {historyItems.map((item) => {
                const previewUri = item.resultImages.find((img) =>
                  isImageUri(img.uri),
                )?.uri;

                if (!previewUri) {
                  return null;
                }

                return (
                  <Pressable
                    key={item.id}
                    style={styles.historyCard}
                    onPress={() => {
                      void restoreHistoryItem(item);
                    }}
                  >
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
                          <Text style={styles.historyPlaceholderText}>
                            Prompt
                          </Text>
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
                      {item.resultImages.length} option
                      {item.resultImages.length === 1 ? "" : "s"}
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
                      Pick an image from your gallery to turn it into tattoo
                      options.
                    </Text>
                  </View>
                )}

                <View style={styles.uploadActions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={pickReferenceImage}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {referenceImageUri ? "Change Image" : "Upload Image"}
                    </Text>
                  </Pressable>
                  {referenceImageUri ? (
                    <Pressable
                      style={styles.clearButton}
                      onPress={() => setReferenceImageUri(null)}
                    >
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
                onPress={() => setPrompt(item)}
              >
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
            disabled={loading}
          >
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
            }}
          >
            <Text style={styles.previewTitle}>
              {selectedResultImage
                ? "1 Selected"
                : `Tap To Select (${resultImages.length})`}
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
                  style={[
                    styles.optionCard,
                    selectedResultImage?.id === item.id
                      ? styles.optionCardSelected
                      : null,
                  ]}
                  onPress={() =>
                    setSelectedResultImage((prev) =>
                      prev?.id === item.id ? null : item,
                    )
                  }
                >
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
              <Pressable
                style={styles.secondaryButton}
                onPress={generateTattoo}
              >
                <Text style={styles.secondaryButtonText}>Regenerate</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.cameraButton,
                  !selectedResultImage ? styles.cameraButtonDisabled : null,
                ]}
                disabled={!selectedResultImage}
                onPress={() =>
                  selectedResultImage && previewOnCamera(selectedResultImage)
                }
              >
                <Text style={styles.cameraButtonText}>Preview</Text>
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.saveButton,
                !selectedResultImage || saving
                  ? styles.saveButtonDisabled
                  : null,
              ]}
              disabled={!selectedResultImage || saving}
              onPress={saveAiTattoo}
            >
              {saving ? (
                <ActivityIndicator color="#FFF8ED" />
              ) : (
                <Text style={styles.saveButtonText}>Save to Catalog</Text>
              )}
            </Pressable>
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
    fontFamily: Fonts.fredoka,
  },
  container: {
    padding: 20,
    gap: 18,
    fontFamily: Fonts.fredoka,
  },
  hero: {
    gap: 8,
    paddingTop: 4,
    fontFamily: Fonts.fredoka,
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "#EADFD2",
    borderRadius: 20,
    padding: 6,
    gap: 6,
    fontFamily: Fonts.fredoka,
  },
  modeChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    fontFamily: Fonts.fredoka,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  modeChipActive: {
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#DCCDBD",
    fontFamily: Fonts.fredoka,
  },
  modeChipText: {
    color: "#6B5743",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  modeChipTextActive: {
    color: "#22160D",
    fontFamily: Fonts.fredoka,
  },
  historySection: {
    gap: 10,
    fontFamily: Fonts.fredoka,
  },
  historyHeader: {
    gap: 4,
    fontFamily: Fonts.fredoka,
  },
  historyTitle: {
    color: "#24180F",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  historySubtitle: {
    color: "#5E5348",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  historyRow: {
    gap: 12,
    paddingRight: 8,
    fontFamily: Fonts.fredoka,
  },
  historyCard: {
    width: 176,
    backgroundColor: "#FFF9F2",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8DCCE",
    gap: 8,
    fontFamily: Fonts.fredoka,
  },
  historyImageWrap: {
    width: "100%",
    height: 132,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#EEDFD0",
    fontFamily: Fonts.fredoka,
  },
  historyImage: {
    width: "100%",
    height: "100%",
    fontFamily: Fonts.fredoka,
  },
  historyPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E3D3",
    fontFamily: Fonts.fredoka,
  },
  historyPlaceholderText: {
    color: "#6C5848",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  historyBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(18, 13, 10, 0.74)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: Fonts.fredoka,
  },
  historyBadgeText: {
    color: "#FFF4E5",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  historyPrompt: {
    color: "#24180F",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  historyMeta: {
    color: "#7B6B5F",
    fontSize: 12,
    fontWeight: "500",
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
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  subtitle: {
    color: "#5E5348",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  creditCount: {
    color: "#6B5B52",
    fontSize: 13,
    fontFamily: Fonts.fredoka,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  panel: {
    backgroundColor: "#FFF9F2",
    borderRadius: 22,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E8DCCE",
    fontFamily: Fonts.fredoka,
  },
  uploadPanel: {
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  uploadPreviewWrap: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#D8C1A4",
    borderWidth: 1,
    borderColor: "#B39471",
    fontFamily: Fonts.fredoka,
  },
  uploadPreview: {
    width: "100%",
    height: "100%",
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  uploadPlaceholderText: {
    color: "#655548",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  uploadActions: {
    flexDirection: "row",
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  label: {
    color: "#24180F",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  suggestions: {
    gap: 10,
    fontFamily: Fonts.fredoka,
  },
  suggestionChip: {
    backgroundColor: "#F1E3D3",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.fredoka,
  },
  suggestionText: {
    color: "#4C3725",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: Fonts.fredoka,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8D1A8",
    fontFamily: Fonts.fredoka,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
    fontFamily: Fonts.fredoka,
  },
  primaryButtonText: {
    color: "#1D140E",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: Fonts.fredoka,
  },
  previewPanel: {
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  previewTitle: {
    color: "#24180F",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  previewBlend: {
    isolation: "isolate",
    mixBlendMode: "multiply",
    fontFamily: Fonts.fredoka,
  },
  optionsList: {
    gap: 12,
    fontFamily: Fonts.fredoka,
  },
  optionRow: {
    justifyContent: "space-between",
    gap: 12,
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  optionCardSelected: {
    borderColor: "#7D5731",
    borderWidth: 2,
    backgroundColor: "#FFF4E5",
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
    fontFamily: Fonts.fredoka,
  },
  optionImage: {
    width: "100%",
    height: "100%",
    fontFamily: Fonts.fredoka,
  },
  optionLabel: {
    color: "#5C4330",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: Fonts.fredoka,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    fontFamily: Fonts.fredoka,
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
    fontFamily: Fonts.fredoka,
  },
  secondaryButtonText: {
    color: "#2C2117",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  clearButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E3D3",
    paddingHorizontal: 18,
    fontFamily: Fonts.fredoka,
  },
  clearButtonText: {
    color: "#4C3725",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.fredoka,
  },
  cameraButton: {
    flex: 1.35,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#11181C",
    paddingHorizontal: 16,
    fontFamily: Fonts.fredoka,
  },
  cameraButtonDisabled: {
    opacity: 0.6,
    fontFamily: Fonts.fredoka,
  },
  cameraButtonText: {
    color: "#FFF8ED",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: Fonts.fredoka,
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5C3A1E",
    fontFamily: Fonts.fredoka,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: "#FFF8ED",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: Fonts.fredoka,
  },
});
