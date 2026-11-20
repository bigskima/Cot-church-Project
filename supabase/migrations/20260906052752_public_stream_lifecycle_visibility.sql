drop policy if exists streams_public_read on public.live_streams;
create policy streams_public_read
on public.live_streams
for select to anon, authenticated
using (
  visibility = 'public'::public.content_visibility
  and status in (
    'scheduled'::public.stream_status,
    'provisioning'::public.stream_status,
    'ready'::public.stream_status,
    'live'::public.stream_status,
    'ended'::public.stream_status,
    'processing'::public.stream_status,
    'replay_ready'::public.stream_status
  )
);
