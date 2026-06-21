import { useEffect, useState } from "react";
import { api, resolveFileUrl } from "../lib/api";

/**
 * Resolves a server-relative file path to a URL that can be used in <img> src.
 * Paths under /uploads/atlet-documents require an auth header — the browser
 * can't send that via <img> directly. For those paths, we fetch via axios
 * (which has the Bearer interceptor) and return a blob URL.
 * All other paths are served publicly and resolved as a plain URL.
 */
export function useAuthenticatedUrl(path: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const needsAuth = Boolean(path && path.includes("atlet-documents"));

  useEffect(() => {
    if (!path || !needsAuth) {
      setBlobUrl(null);
      return;
    }
    let revoked = false;
    api.get(resolveFileUrl(path), { responseType: "blob" })
      .then((res) => {
        if (!revoked) {
          const url = URL.createObjectURL(res.data as Blob);
          setBlobUrl(url);
        }
      })
      .catch(() => setBlobUrl(null));
    return () => {
      revoked = true;
      // Don't revoke here — the img element may still be mounted; revoke on next update
    };
  }, [path, needsAuth]);

  // Revoke the previous blob URL when it changes
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!path) return null;
  if (needsAuth) return blobUrl; // null while loading, then blob URL
  return resolveFileUrl(path);
}
