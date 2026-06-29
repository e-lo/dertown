/** Storage bucket holding admin-uploaded event images. */
export const EVENT_IMAGES_BUCKET = 'event-images';

/** Image MIME types we accept for upload. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Maximum upload size in bytes (5 MiB). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ImageValidation =
  | { ok: true; extension: string }
  | { ok: false; error: string };

/** Validate an uploaded image's MIME type and size. Pure — no I/O. */
export function validateImageUpload(input: { type: string; size: number }): ImageValidation {
  const extension = EXTENSION_BY_TYPE[input.type];
  if (!extension) {
    return { ok: false, error: 'Unsupported image type. Use JPEG, PNG, or WebP.' };
  }
  if (input.size <= 0) {
    return { ok: false, error: 'File is empty.' };
  }
  if (input.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Image is too large. Maximum size is 5 MB.' };
  }
  return { ok: true, extension };
}

/** Build the object path (filename) for a freshly uploaded image. */
export function buildImageObjectPath(uuid: string, extension: string): string {
  return `${uuid}.${extension}`;
}
