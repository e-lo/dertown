import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import {
  EVENT_IMAGES_BUCKET,
  validateImageUpload,
  buildImageObjectPath,
} from '@/lib/event-image-upload';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Expected multipart form data', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError('No file provided', 400);
  }

  const validation = validateImageUpload({ type: file.type, size: file.size });
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const objectPath = buildImageObjectPath(crypto.randomUUID(), validation.extension);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(EVENT_IMAGES_BUCKET)
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[UPLOAD EVENT IMAGE] Storage error:', uploadError);
    return jsonError('Failed to upload image', 500);
  }

  const { data } = supabaseAdmin.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(objectPath);

  return jsonResponse({ url: data.publicUrl, path: objectPath }, 201);
});
