export const ASTU_EMAIL_DOMAINS = ["astu.edu.et"] as const;

export const ITEM_CATEGORIES = [
  "electronics",
  "id-card",
  "documents",
  "keys",
  "wallet",
  "bag",
  "clothing",
  "book",
  "jewelry",
  "other",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_EVIDENCE_MIME = [...ALLOWED_IMAGE_MIME, "application/pdf"] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_ITEM = 5;
export const MAX_EVIDENCE_PER_CLAIM = 3;

export function isAstuEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return ASTU_EMAIL_DOMAINS.some(
    (domain) => normalized.endsWith(`@${domain}`) || normalized.endsWith(`.${domain}`),
  );
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}
