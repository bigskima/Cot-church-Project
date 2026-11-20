-- Use a Cloudflare-hosted image model that supports explicit wide dimensions.
-- SDXL Lightning accepts width/height and low-step generation, which fits the
-- stored 16:7 COT Home/dedicated-screen visual contract.

update public.cot_image_providers
set configuration = coalesce(configuration,'{}'::jsonb) || jsonb_build_object(
  'model','@cf/bytedance/stable-diffusion-xl-lightning',
  'width',1280,
  'height',560,
  'steps',4
),
updated_at=now()
where code='cloudflare';
