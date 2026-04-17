import { auth } from "../firebase/firebaseConfig";
import axiosClient, { API_BASE_URL } from "./axiosClient";

// Replaces server-side localhost URLs with the device-reachable IP from axiosClient
function fixImageUrl(url?: string | null): string {
  if (!url) return "";

  const trimmed = url.trim();
  if (!trimmed) return "";

  // Replace loopback hosts with the device-reachable API host.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
    return trimmed.replace(
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
      API_BASE_URL,
    );
  }

  // Already absolute and non-loopback URL.
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  // Handle relative backend paths like "/uploads/..." or "uploads/...".
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

// ── Domain types ──────────────────────────────────────────────────────────────

export type AddTattooPayload = {
  name: string;
  imageUrl: string;
  category: string;
  description?: string;
};

export type CatalogTattoo = {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  description: string;
  source: string;
  createdBy: string;
  createdAt: { _seconds: number; _nanoseconds: number };
};

export type CatalogCategory = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt?: { _seconds: number; _nanoseconds: number };
  tattoos: CatalogTattoo[];
};

export type CatalogResponse = {
  categories: CatalogCategory[];
  totalCategories: number;
  totalTattoos: number;
};

export async function callProtectedEndpointUseCase() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not logged in");
  }

  const response = await axiosClient.post("/protected");
  return response.data;
}

export async function listTattoosUseCase(category?: string) {
  const params = category ? { category } : undefined;
  const response = await axiosClient.get("/tattoos", { params });
  return response.data;
}

export async function addTattooUseCase(payload: AddTattooPayload) {
  const response = await axiosClient.post("/tattoos", payload);
  return response.data;
}

export type SaveAiTattooPayload = {
  name: string;
  category: string;
  description: string;
  generatedImage: string;
  prompt: string;
  model: string;
};

export async function saveAiTattooUseCase(payload: SaveAiTattooPayload) {
  console.log("[saveAiTattooUseCase] request payload:", payload);
  const response = await axiosClient.post("/tattoos/from-ai", payload);
  console.log("[saveAiTattooUseCase] response:", response.data);
  return response.data;
}

// ── Catalog use-case ─────────────────────────────────────────────────────────

export async function getCatalogUseCase(): Promise<CatalogResponse> {
  const response = await axiosClient.get("/tattoos/catalog");
  const data: CatalogResponse = response.data;
  console.log("[getCatalogUseCase] raw response:", data);
  // Fix image URLs so they point to the device-reachable host
  data.categories = data.categories.map((cat) => ({
    ...cat,
    tattoos: cat.tattoos.map((t) => ({
      ...t,
      imageUrl: fixImageUrl(t.imageUrl),
    })),
  }));
  console.log("[getCatalogUseCase] categories after URL fix:", data.categories);
  return data;
}

// ── Saved-tattoos use-cases ──────────────────────────────────────────────────

export type SavedTattooEntry = {
  id: string;
  tattooId: string;
  savedAt: { _seconds: number; _nanoseconds: number } | string;
  capturedShotUrl?: string;
  capturedShotPath?: string;
  tattoo: {
    id: string;
    name: string;
    imageUrl: string;
    category: string;
    description?: string;
    source?: string;
    createdBy?: string;
    createdAt?: { _seconds: number; _nanoseconds: number };
  };
};

export type SavedTattoosResponse = {
  savedTattoos: SavedTattooEntry[];
  total: number;
};

export type SaveTattooPayload = {
  tattooId: string;
  capturedShot?: string;
};

export async function bookmarkTattooUseCase(
  payload: SaveTattooPayload,
): Promise<{ duplicate: boolean }> {
  const response = await axiosClient.post("/saved-tattoos", payload);
  return response.data as { duplicate: boolean };
}

export async function getSavedTattoosApiUseCase(): Promise<SavedTattoosResponse> {
  const response = await axiosClient.get("/saved-tattoos");
  const data: SavedTattoosResponse = response.data;
  data.savedTattoos = data.savedTattoos.map((entry) => ({
    ...entry,
    capturedShotUrl: fixImageUrl(entry.capturedShotUrl),
    tattoo: { ...entry.tattoo, imageUrl: fixImageUrl(entry.tattoo.imageUrl) },
  }));
  return data;
}

// ── Credits use-case ────────────────────────────────────────────────────────

export type CreditsResponse = {
  creditsRemaining: number;
  consumedCredits: number;
  totalFreeCredits: number;
  purchasedCredits?: number;
  pricing?: {
    textToImageCost: number;
    imageToImageCost: number;
  };
};

export async function getCreditsUseCase(): Promise<CreditsResponse> {
  const response = await axiosClient.get("/credits");
  return response.data as CreditsResponse;
}

export type RevenueCatSyncPayload = {
  productId?: string;
  transactionId?: string;
  entitlementId?: string;
  appUserId?: string;
  purchaseDate?: string;
  platform?: string;
  customerInfo?: unknown;
};

export async function syncRevenueCatCreditPurchaseUseCase(
  payload: RevenueCatSyncPayload,
): Promise<unknown> {
  const response = await axiosClient.post("/iap/revenuecat/credits", payload);
  return response.data;
}

export async function syncRevenueCatSubscriptionPurchaseUseCase(
  payload: RevenueCatSyncPayload,
): Promise<unknown> {
  const response = await axiosClient.post(
    "/iap/revenuecat/subscription",
    payload,
  );
  return response.data;
}

export async function syncRevenueCatCustomerInfoUseCase(
  payload: RevenueCatSyncPayload,
): Promise<unknown> {
  const response = await axiosClient.post(
    "/iap/revenuecat/customer-info",
    payload,
  );
  return response.data;
}

// ── Profile use-cases ───────────────────────────────────────────────────────

export type UserProfile = {
  uid?: string;
  email?: string;
  name?: string;
  profileImageUrl?: string;
  profileImagePath?: string;
};

export async function getProfileUseCase(): Promise<UserProfile> {
  const response = await axiosClient.get("/profile");
  const raw = (response.data as { profile?: UserProfile })?.profile ?? {};

  return {
    ...raw,
    profileImageUrl: fixImageUrl(raw.profileImageUrl),
  };
}

export type UploadProfileImageResponse = {
  message: string;
  profileImageUrl: string;
  profileImagePath?: string;
  storageMode?: string;
};

function getMimeTypeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function uploadProfileImageUseCase(
  imageUri: string,
): Promise<UploadProfileImageResponse> {
  const fileName = imageUri.split("/").pop() ?? `profile-${Date.now()}.jpg`;
  const formData = new FormData();

  formData.append("profileImage", {
    uri: imageUri,
    name: fileName,
    type: getMimeTypeFromFileName(fileName),
  } as unknown as Blob);

  const response = await axiosClient.post("/profile-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  const data = response.data as UploadProfileImageResponse;
  return {
    ...data,
    profileImageUrl: fixImageUrl(data.profileImageUrl),
  };
}

// ── Recent creations use-cases ───────────────────────────────────────────────

export type SaveRecentCreationsPayload = {
  name: string;
  description: string;
  prompt: string;
  model: string;
  images: string[];
};

export type SaveRecentCreationsResponse = {
  requestGroupId?: string;
  count?: number;
  created?: unknown[];
};

export async function saveRecentCreationsUseCase(
  payload: SaveRecentCreationsPayload,
): Promise<SaveRecentCreationsResponse> {
  const response = await axiosClient.post("/recent-creations", payload);
  return response.data as SaveRecentCreationsResponse;
}

export async function getRecentCreationsUseCase(): Promise<unknown> {
  const response = await axiosClient.get("/recent-creations");
  return response.data;
}

// ── AI generation use-cases ───────────────────────────────────────────────────

const IMAGE_TO_TATTOO_ENDPOINTS = [
  "/generate-tattoo-from-image",
  "/convert-image-to-tattoo",
] as const;
const GENERATED_IMAGE_COUNT = 4;
const AI_GENERATION_TIMEOUT_MS = 120000;

async function readJsonFromFetch(
  response: Response,
): Promise<Record<string, unknown>> {
  const rawText = await response.text();
  if (!rawText.trim()) return {};
  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    const preview = rawText.slice(0, 140).trim();
    throw new Error(
      `Server did not return JSON. Response started with: ${preview}`,
    );
  }
}

export async function generateTattooFromPromptUseCase(
  originalPrompt: string,
): Promise<Record<string, unknown>> {
  const tattooOnlyPrompt = [
    originalPrompt,
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

  const response = await axiosClient.post(
    "/generate-tattoo-from-prompt",
    {
      prompt: tattooOnlyPrompt,
      originalPrompt,
      outputCount: GENERATED_IMAGE_COUNT,
      numImages: GENERATED_IMAGE_COUNT,
      variations: GENERATED_IMAGE_COUNT,
      transparentBackground: true,
      format: "png",
      removeBackground: true,
      isolated: true,
      negativePrompt:
        "white background, solid background, skin, arm, person, mockup, poster, paper, wall, framed artwork, photo background",
    },
    { timeout: AI_GENERATION_TIMEOUT_MS },
  );
  return response.data as Record<string, unknown>;
}

export async function generateTattooFromImageUseCase(
  referenceImageUri: string,
  originalPrompt: string,
): Promise<Record<string, unknown>> {
  const tattooOnlyPrompt = [
    originalPrompt,
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
  formData.append("originalPrompt", originalPrompt);
  formData.append("outputCount", String(GENERATED_IMAGE_COUNT));
  formData.append("numImages", String(GENERATED_IMAGE_COUNT));
  formData.append("variations", String(GENERATED_IMAGE_COUNT));
  formData.append("transparentBackground", "true");
  formData.append("format", "png");
  formData.append("removeBackground", "true");
  formData.append("isolated", "true");
  formData.append(
    "negativePrompt",
    "white background, solid background, skin, arm, person, mockup, poster, paper, wall, framed artwork, photo background",
  );

  let lastError: Error | null = null;

  const authHeaders: Record<string, string> = {};
  const currentUser = auth.currentUser;
  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    authHeaders["Authorization"] = `Bearer ${idToken}`;
  }

  for (const endpoint of IMAGE_TO_TATTOO_ENDPOINTS) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      const data = await readJsonFromFetch(response);

      if (response.status === 404) {
        lastError = new Error(
          `Endpoint ${endpoint} was not found on the server.`,
        );
        continue;
      }

      if (response.status >= 500) {
        throw new Error("Something went wrong. Please try again.");
      }

      if (!response.ok) {
        const errMsg = typeof data.error === "string" ? data.error : undefined;
        throw new Error(
          errMsg ??
            `AI failed to convert the image. Server returned ${response.status}.`,
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
    new Error(
      "Could not find a backend endpoint to convert the uploaded image.",
    )
  );
}
