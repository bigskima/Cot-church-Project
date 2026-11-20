alter table public.app_distribution_channels
  add column if not exists metadata_url text;

update public.app_distribution_channels
set metadata_url = 'https://github.com/bigskima/Cot-church-Project/releases/download/cot-android-latest/release.json',
    updated_at = now()
where platform='android' and channel='testing';

insert into public.app_distribution_channels (
  platform,channel,distribution,download_url,metadata_url,version_name,
  release_notes,remind_after_hours,is_active
)
values (
  'android',
  'play_store',
  'play_store',
  'https://play.google.com/store/apps/details?id=com.cot.app',
  null,
  '1.0.0',
  'Google Play distribution channel. Activate after the public Play Store release is approved.',
  24,
  false
)
on conflict (platform,channel) do update
set distribution=excluded.distribution,
    download_url=excluded.download_url,
    metadata_url=excluded.metadata_url,
    release_notes=excluded.release_notes,
    updated_at=now();
