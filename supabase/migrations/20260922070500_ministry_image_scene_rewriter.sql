-- Keep the copy-to-scene rewrite model configurable with the image provider.
update public.cot_image_providers
set configuration = coalesce(configuration,'{}'::jsonb) || jsonb_build_object(
  'promptModel','@cf/meta/llama-3.2-3b-instruct'
),
updated_at=now()
where code='cloudflare';
