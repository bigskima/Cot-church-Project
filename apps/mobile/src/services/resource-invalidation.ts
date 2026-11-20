import { invalidate } from './query-cache';

export const engagementResources = [
  'comments:', 'mobile:home-feed:', 'mobile:community:', 'expression:',
  'reels:immersive:', 'watch:engagement:', 'watch:detail:', 'watch:catalogue:', 'sermon:engagement:', 'saved:',
];

const mutationResources: Record<string, string[]> = {
  engagement: engagementResources,
  'social-feed': ['mobile:home-feed:', 'mobile:community:', 'expression:'],
  groups: ['expression:groups:', 'group-chat:'],
  chat: ['chat:'],
  'group-chat': ['group-chat:'],
  sermons: ['sermon:', 'expression:', 'mobile:home-feed:', 'saved:'],
  events: ['events:', 'expression:', 'mobile:home-feed:'],
  'event-registrations': ['events:', 'expression:'],
  follows: ['mobile:home-feed:', 'public-profile:'],
  'expression-media': ['expression:', 'mobile:home-feed:', 'reels:immersive:', 'watch:'],
  'creator-studio': ['expression:', 'mobile:home-feed:', 'reels:immersive:', 'watch:'],
  'live-interactions': ['live:'],
  'streaming-broadcasts': ['live:', 'leadership:streams:', 'expression:', 'mobile:home-feed:'],
};

export function invalidateAfterMutation(path: string, body: unknown) {
  const endpoint = path.split('?')[0];
  let action: string | undefined;
  if (typeof body === 'string') {
    try { action = JSON.parse(body).action; } catch { return; }
  }
  // Playback progress and moderation reports do not change the visible feed.
  if (endpoint === 'engagement' && !['react', 'unreact', 'bookmark', 'comment'].includes(action ?? '')) return;
  for (const prefix of mutationResources[endpoint] ?? []) invalidate(prefix);
}
