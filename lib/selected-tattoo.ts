import * as FileSystem from "expo-file-system/legacy";

type SelectedTattoo = {
  name: string | null;
  uri: string | null;
};

export type SavedTattoo = {
  id: string;
  name: string;
  savedAt: string;
  sourceUri: string;
  uri: string;
};

let selectedTattoo: SelectedTattoo = {
  name: null,
  uri: null,
};

const LIBRARY_DIR = `${FileSystem.documentDirectory}my-tattoos`;
const LIBRARY_INDEX_URI = `${LIBRARY_DIR}/saved-tattoos.json`;

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

async function ensureLibraryDirectory() {
  const info = await FileSystem.getInfoAsync(LIBRARY_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LIBRARY_DIR, { intermediates: true });
  }
}

async function readLibraryIndex() {
  await ensureLibraryDirectory();
  const info = await FileSystem.getInfoAsync(LIBRARY_INDEX_URI);

  if (!info.exists) {
    return [] as SavedTattoo[];
  }

  try {
    const raw = await FileSystem.readAsStringAsync(LIBRARY_INDEX_URI);
    const parsed = JSON.parse(raw) as SavedTattoo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLibraryIndex(items: SavedTattoo[]) {
  await ensureLibraryDirectory();
  await FileSystem.writeAsStringAsync(
    LIBRARY_INDEX_URI,
    JSON.stringify(items, null, 2),
  );
}

async function persistTattooAsset(sourceUri: string, name: string) {
  await ensureLibraryDirectory();

  if (sourceUri.startsWith(FileSystem.documentDirectory || "")) {
    return sourceUri;
  }

  const extension = getFileExtension(sourceUri);
  const fileName = `${Date.now()}-${slugify(name || "tattoo")}.${extension}`;
  const destinationUri = `${LIBRARY_DIR}/${fileName}`;

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

export function setSelectedTattoo(uri: string, name?: string) {
  selectedTattoo = {
    uri,
    name: name ?? null,
  };
}

export function getSelectedTattoo() {
  return selectedTattoo;
}

export function clearSelectedTattoo() {
  selectedTattoo = {
    name: null,
    uri: null,
  };
}

export async function getSavedTattoos() {
  const items = await readLibraryIndex();
  return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function getSavedTattooById(id: string) {
  const items = await readLibraryIndex();
  return items.find((item) => item.id === id) ?? null;
}

export async function getSavedTattooBySourceUri(sourceUri: string) {
  const items = await readLibraryIndex();
  return items.find((item) => item.sourceUri === sourceUri) ?? null;
}

export async function renameSavedTattoo(id: string, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Enter a name before saving.");
  }

  const items = await readLibraryIndex();
  const nextItems = items.map((item) =>
    item.id === id
      ? {
          ...item,
          name: trimmedName,
        }
      : item,
  );

  await writeLibraryIndex(nextItems);
  return nextItems.find((item) => item.id === id) ?? null;
}

export async function saveTattooToLibrary({
  name,
  uri,
}: {
  name: string;
  uri: string;
}) {
  const items = await readLibraryIndex();
  const existingItem = items.find((item) => item.sourceUri === uri);

  if (existingItem) {
    return existingItem;
  }

  const persistedUri = await persistTattooAsset(uri, name);
  const savedTattoo: SavedTattoo = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: new Date().toISOString(),
    sourceUri: uri,
    uri: persistedUri,
  };

  const nextItems = [savedTattoo, ...items];
  await writeLibraryIndex(nextItems);

  return savedTattoo;
}

export async function removeSavedTattoo(id: string) {
  const items = await readLibraryIndex();
  const tattooToRemove = items.find((item) => item.id === id);

  if (!tattooToRemove) {
    return;
  }

  const nextItems = items.filter((item) => item.id !== id);
  await writeLibraryIndex(nextItems);

  if (tattooToRemove.uri.startsWith(FileSystem.documentDirectory || "")) {
    const info = await FileSystem.getInfoAsync(tattooToRemove.uri);

    if (info.exists) {
      await FileSystem.deleteAsync(tattooToRemove.uri, { idempotent: true });
    }
  }
}

export async function removeSavedTattooBySourceUri(sourceUri: string) {
  const items = await readLibraryIndex();
  const existingItem = items.find((item) => item.sourceUri === sourceUri);

  if (!existingItem) {
    return false;
  }

  await removeSavedTattoo(existingItem.id);
  return true;
}


