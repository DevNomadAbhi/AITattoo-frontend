import * as FileSystem from "expo-file-system/legacy";

export type CreateHistoryMode = "text" | "image";

export type CreateHistoryResultImage = {
  id: string;
  uri: string;
};

export type CreateHistoryItem = {
  createdAt: string;
  id: string;
  mode: CreateHistoryMode;
  prompt: string;
  referenceImageUri: string | null;
  resultImages: CreateHistoryResultImage[];
};

const HISTORY_DIR = `${FileSystem.documentDirectory}create-history`;
const HISTORY_INDEX_URI = `${HISTORY_DIR}/history.json`;
const MAX_HISTORY_ITEMS = 12;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function getFileExtension(uri: string) {
  if (uri.startsWith("data:image/")) {
    const mimeMatch = uri.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
    const extension = mimeMatch?.[1]?.toLowerCase();
    return extension === "jpeg" ? "jpg" : extension || "png";
  }

  const extensionMatch = uri.match(/\.([a-zA-Z0-9]+)(?:$|[?#])/);
  const extension = extensionMatch?.[1]?.toLowerCase();
  return extension === "jpeg" ? "jpg" : extension || "png";
}

async function ensureHistoryDirectory() {
  const info = await FileSystem.getInfoAsync(HISTORY_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(HISTORY_DIR, { intermediates: true });
  }
}

async function readHistoryIndex() {
  await ensureHistoryDirectory();
  const info = await FileSystem.getInfoAsync(HISTORY_INDEX_URI);

  if (!info.exists) {
    return [] as CreateHistoryItem[];
  }

  try {
    const raw = await FileSystem.readAsStringAsync(HISTORY_INDEX_URI);
    const parsed = JSON.parse(raw) as CreateHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeHistoryIndex(items: CreateHistoryItem[]) {
  await ensureHistoryDirectory();
  await FileSystem.writeAsStringAsync(
    HISTORY_INDEX_URI,
    JSON.stringify(items, null, 2),
  );
}

async function persistImageAsset(sourceUri: string, name: string) {
  await ensureHistoryDirectory();

  if (sourceUri.startsWith(FileSystem.documentDirectory || "")) {
    return sourceUri;
  }

  const extension = getFileExtension(sourceUri);
  const fileName = `${Date.now()}-${slugify(name || "history-image")}.${extension}`;
  const destinationUri = `${HISTORY_DIR}/${fileName}`;

  if (sourceUri.startsWith("data:image/")) {
    const [, payload = ""] = sourceUri.split(",", 2);
    await FileSystem.writeAsStringAsync(destinationUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destinationUri;
  }

  if (sourceUri.startsWith("http://") || sourceUri.startsWith("https://")) {
    const result = await FileSystem.downloadAsync(sourceUri, destinationUri);
    return result.uri;
  }

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
}

async function removeHistoryAssets(item: CreateHistoryItem) {
  const uris = [
    item.referenceImageUri,
    ...item.resultImages.map((result) => result.uri),
  ].filter((value): value is string => Boolean(value));

  await Promise.all(
    uris.map(async (uri) => {
      if (!uri.startsWith(FileSystem.documentDirectory || "")) {
        return;
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    }),
  );
}

export async function getCreateHistory() {
  const items = await readHistoryIndex();
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveCreateHistoryEntry({
  mode,
  prompt,
  referenceImageUri,
  resultImageUris,
}: {
  mode: CreateHistoryMode;
  prompt: string;
  referenceImageUri: string | null;
  resultImageUris: string[];
}) {
  const persistedReferenceImageUri = referenceImageUri
    ? await persistImageAsset(referenceImageUri, `${prompt}-reference`)
    : null;

  const persistedResultImages = await Promise.all(
    resultImageUris.map(async (uri, index) => ({
      id: `history-${index}`,
      uri: await persistImageAsset(uri, `${prompt}-result-${index + 1}`),
    })),
  );

  const historyItem: CreateHistoryItem = {
    createdAt: new Date().toISOString(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    prompt,
    referenceImageUri: persistedReferenceImageUri,
    resultImages: persistedResultImages,
  };

  const existingItems = await readHistoryIndex();
  const trimmedItems = [historyItem, ...existingItems].slice(0, MAX_HISTORY_ITEMS);
  const removedItems = existingItems.slice(MAX_HISTORY_ITEMS - 1);

  await writeHistoryIndex(trimmedItems);
  await Promise.all(removedItems.map((item) => removeHistoryAssets(item)));

  return historyItem;
}

