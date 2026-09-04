-- Seed provider adapter registry records without storing provider credentials.
-- Platform Authority may change the secret reference and enable a provider only after
-- the corresponding Supabase runtime secret has been configured.

insert into public.ai_providers (
  code,
  name,
  adapter_version,
  status,
  secret_reference,
  configuration
) values
  ('openai', 'OpenAI', 'v1', 'disabled', 'OPENAI_API_KEY', '{}'::jsonb),
  ('gemini', 'Google Gemini', 'v1', 'disabled', 'GEMINI_API_KEY', '{}'::jsonb),
  ('anthropic', 'Anthropic Claude', 'v1', 'disabled', 'ANTHROPIC_API_KEY', '{}'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  adapter_version = excluded.adapter_version,
  secret_reference = case
    when nullif(trim(public.ai_providers.secret_reference), '') is null then excluded.secret_reference
    else public.ai_providers.secret_reference
  end,
  configuration = coalesce(public.ai_providers.configuration, '{}'::jsonb);
