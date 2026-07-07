/**
 * Wire a drag-and-drop / click-to-browse image uploader to an existing URL
 * input. On a successful upload the returned public URL is written into the URL
 * input (so existing form-submit code picks it up unchanged) and a thumbnail
 * preview is shown. Pasting a URL into the input still works.
 *
 * Because the admin modal sets the URL input's value programmatically when it
 * opens (which does not fire an `input` event), this also installs a global
 * `window.refreshEventImagePreview()` the modal can call to re-sync the preview.
 */
export interface ImageDropZoneOptions {
  urlInputId: string;
  dropZoneId: string;
  fileInputId: string;
  previewId: string;
  statusId: string;
  endpoint?: string;
  /** Optional name for the global refresh function (default refreshEventImagePreview). */
  refreshGlobalName?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
// Netlify's SSR function rejects request bodies over ~4.5 MB (it base64-encodes
// the binary body, ~33% overhead, hitting the function payload ceiling). Keep
// uploads safely under that; larger images are downscaled/re-encoded first.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// Refuse to even decode absurdly large originals.
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
// Longest-edge cap for downscaled images — plenty for web display; the Netlify
// Image CDN resizes further at render time.
const MAX_DIMENSION = 2000;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * Return an upload-ready image Blob under MAX_UPLOAD_BYTES. Images already within
 * the size and dimension limits pass through untouched (no re-encode, no quality
 * loss); larger ones are scaled to MAX_DIMENSION and re-encoded as WebP with
 * decreasing quality until they fit.
 */
async function prepareImageForUpload(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // undecodable here — let the server validate/reject
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));

  // Small enough and within dimensions → upload the original, no quality loss.
  if (scale === 1 && file.size <= MAX_UPLOAD_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, 'image/webp', quality);
  }
  return blob ?? file;
}

export function initImageDropZone(opts: ImageDropZoneOptions): void {
  const endpoint = opts.endpoint ?? '/api/admin/events/upload-image';
  const urlInput = document.getElementById(opts.urlInputId) as HTMLInputElement | null;
  const dropZone = document.getElementById(opts.dropZoneId);
  const fileInput = document.getElementById(opts.fileInputId) as HTMLInputElement | null;
  const preview = document.getElementById(opts.previewId) as HTMLImageElement | null;
  const status = document.getElementById(opts.statusId);
  if (!urlInput || !dropZone || !fileInput || !preview || !status) return;

  function showPreview(url: string): void {
    if (url) {
      preview!.src = url;
      preview!.classList.remove('hidden');
    } else {
      preview!.removeAttribute('src');
      preview!.classList.add('hidden');
    }
  }

  function setStatus(message: string, isError: boolean): void {
    status!.textContent = message;
    status!.classList.toggle('text-red-600', isError);
  }

  async function upload(file: File): Promise<void> {
    if (!ACCEPTED.includes(file.type)) {
      setStatus('Unsupported file type. Use JPEG, PNG, or WebP.', true);
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setStatus('Image is too large. Please use a file under 40 MB.', true);
      return;
    }
    try {
      // Large photos exceed Netlify's SSR function upload limit, so downscale/
      // re-encode in the browser first (also speeds up page loads).
      setStatus('Preparing image…', false);
      const blob = await prepareImageForUpload(file);
      if (blob.size > MAX_UPLOAD_BYTES) {
        setStatus('Could not shrink this image enough to upload. Try a smaller image.', true);
        return;
      }
      // Send the prepared image as a raw binary body (not multipart/form-data).
      // This avoids Astro's form-POST CSRF guard and unreliable multipart parsing
      // in the Netlify SSR runtime. The server reads the MIME type from this header.
      const contentType = blob.type || file.type;
      setStatus('Uploading…', false);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || 'Upload failed.', true);
        return;
      }
      urlInput!.value = data.url;
      showPreview(data.url);
      setStatus('Uploaded.', false);
    } catch (err) {
      console.error('[image upload] failed', err);
      setStatus('Upload failed. Please try again.', true);
    }
  }

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void upload(file);
  });
  ['dragenter', 'dragover'].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('ring-2', 'ring-indigo-400');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('ring-2', 'ring-indigo-400');
    })
  );
  dropZone.addEventListener('drop', (e) => {
    const file = (e as DragEvent).dataTransfer?.files?.[0];
    if (file) void upload(file);
  });

  // Sync preview when a URL is typed/pasted.
  urlInput.addEventListener('input', () => showPreview(urlInput.value.trim()));

  // Global hook so the modal can re-sync after setting the value programmatically.
  const globalName = opts.refreshGlobalName ?? 'refreshEventImagePreview';
  (window as unknown as Record<string, () => void>)[globalName] = () =>
    showPreview(urlInput.value.trim());
}
