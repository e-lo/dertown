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
const MAX_BYTES = 5 * 1024 * 1024;

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
    if (file.size > MAX_BYTES) {
      setStatus('Image is too large. Maximum size is 5 MB.', true);
      return;
    }
    setStatus('Uploading…', false);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', body });
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
