import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1",
});

/** Origin used to resolve server-relative paths such as `/uploads/...`. */
export const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/v1\/?$/, "");

export function resolveFileUrl(path: string): string {
  return path.startsWith("http") ? path : `${apiOrigin}${path}`;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// On a 401 (expired access token), try once to refresh using the stored
// refresh token before giving up and logging out (specs/001-auth-rbac §6).
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post(
      `${api.defaults.baseURL}/auth/refresh`,
      { refreshToken },
    );
    useAuthStore.getState().setSession(data.accessToken, data.refreshToken, data.user);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;

    const isAuthEndpoint = config?.url?.startsWith("/auth/");

    if (error.response?.status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      refreshPromise ??= refreshAccessToken();
      const newAccessToken = await refreshPromise;
      refreshPromise = null;

      if (newAccessToken) {
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        return api.request(config);
      }

      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);
