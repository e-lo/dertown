-- Public storage bucket for admin-uploaded event images.
-- Public READ so images render directly and via the Netlify Image CDN.
-- WRITES happen only through the server upload endpoint using the service-role
-- key (which bypasses RLS), so no storage.objects policies are needed here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
