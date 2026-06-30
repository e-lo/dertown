import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import {
  EVENT_IMAGES_BUCKET,
  validateImageUpload,
  buildImageObjectPath,
} from '@/lib/event-image-upload';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  // The image is sent as a raw binary body (Content-Type = the image's MIME
  // type), NOT multipart/form-data. Astro's checkOrigin CSRF guard only applies
  // to form content-types, and multipart parsing is unreliable in the Netlify
  // SSR runtime; a raw body sidesteps both.
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    return jsonError('Could not read request body', 400);
  }

  const validation = validateImageUpload({ type: contentType, size: bytes.byteLength });
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const objectPath = buildImageObjectPath(crypto.randomUUID(), validation.extension);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(EVENT_IMAGES_BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: false });

  if (uploadError) {
    console.error('[UPLOAD EVENT IMAGE] Storage error:', uploadError);
    return jsonError('Failed to upload image', 500);
  }

  const { data } = supabaseAdmin.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(objectPath);

  return jsonResponse({ url: data.publicUrl, path: objectPath }, 201);
});
