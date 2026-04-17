import axios from "axios";
import Constants from "expo-constants";
import { auth } from "../firebase/firebaseConfig";

function getBackendErrorMessage(error: unknown): string | null {
  const responseData = (error as any)?.response?.data;
  if (!responseData) return null;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.trim();
  }

  if (
    typeof responseData?.message === "string" &&
    responseData.message.trim()
  ) {
    return responseData.message.trim();
  }

  if (typeof responseData?.error === "string" && responseData.error.trim()) {
    return responseData.error.trim();
  }

  return null;
}

function getDevApiBaseUrlFromExpoHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  const [host] = hostUri.split(":");
  if (!host) return null;

  return `http://${host}:3000`;
}

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

const DEFAULT_API_BASE_URL = "https://tattoo-backend-kkbo.onrender.com";

export const API_BASE_URL = DEFAULT_API_BASE_URL;

const axiosClient = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 25000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the Firebase ID token
axiosClient.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      config.headers.Authorization = `Bearer ${idToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Map 5xx server errors to a user-friendly message
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.code === "ECONNABORTED") {
      return Promise.reject(
        new Error(
          "Request timed out while waiting for the API. AI generation can take longer; please try again.",
        ),
      );
    }

    if (!error?.response || error?.message === "Network Error") {
      return Promise.reject(
        new Error(
          `Cannot reach API at ${DEFAULT_API_BASE_URL}. Make sure your phone and computer are on the same Wi-Fi, backend is running, and the configured port is open.`,
        ),
      );
    }

    const status = error?.response?.status;
    const backendMessage = getBackendErrorMessage(error);
    const requestUrl = String(error?.config?.url || "");

    if (status >= 500) {
      if (requestUrl.includes("/iap/purchase") && backendMessage) {
        return Promise.reject(
          new Error(`Purchase verification failed: ${backendMessage}`),
        );
      }

      return Promise.reject(
        new Error(backendMessage || "Something went wrong. Please try again."),
      );
    }

    if (backendMessage) {
      return Promise.reject(new Error(backendMessage));
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
