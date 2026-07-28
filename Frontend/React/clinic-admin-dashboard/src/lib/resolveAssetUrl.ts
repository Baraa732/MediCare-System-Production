import { API_BASE } from "@/lib/api/client";

/** Resolve relative API asset paths (e.g. clinic logo) to a fetchable URL. */
export function resolveAssetUrl(path?: string | null): string | undefined {
  if (!path?.trim()) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const base = API_BASE.replace(/\/api\/?$/, "");
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}
