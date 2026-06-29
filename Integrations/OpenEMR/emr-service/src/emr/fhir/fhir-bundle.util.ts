export function extractBundleEntries<T = Record<string, unknown>>(bundle: unknown): T[] {
  if (!bundle || typeof bundle !== 'object') return [];
  const resource = bundle as { resourceType?: string; entry?: Array<{ resource?: T }> };
  if (resource.resourceType !== 'Bundle' || !Array.isArray(resource.entry)) return [];
  return resource.entry
    .map((entry) => entry.resource)
    .filter((item): item is T => !!item && typeof item === 'object');
}

export function formatUuidFromHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const normalized = hex.replace(/-/g, '').toUpperCase();
  if (normalized.length !== 32) return null;
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

export function fhirCodeableText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const coded = value as { text?: string; coding?: Array<{ display?: string; code?: string }> };
  if (coded.text) return coded.text;
  const coding = coded.coding?.[0];
  return coding?.display || coding?.code || null;
}

export function fhirReferenceId(reference: string | undefined): string | null {
  if (!reference) return null;
  const parts = reference.split('/');
  return parts[parts.length - 1] || null;
}
