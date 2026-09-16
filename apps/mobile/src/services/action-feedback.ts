export type ActionFeedback = {
  id: string;
  kind: 'success' | 'error';
  title: string;
  message: string;
  retry?: (() => Promise<unknown>) | null;
};

type Listener = (feedback: ActionFeedback) => void;
const listeners = new Set<Listener>();

export function subscribeActionFeedback(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitActionFeedback(feedback: Omit<ActionFeedback, 'id'>) {
  const item: ActionFeedback = {
    ...feedback,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  listeners.forEach((listener) => listener(item));
}

export function defaultMutationSuccess(path: string, method: string) {
  const clean = path.split('?')[0];
  if (clean.includes('announcements')) return method === 'DELETE' ? 'Announcement removed.' : 'Announcement changes saved.';
  if (clean.includes('events')) return method === 'DELETE' ? 'Event removed.' : 'Event changes saved.';
  if (clean.includes('event-registrations')) return 'Your event registration was updated.';
  if (clean.includes('church-story')) return 'Church information saved.';
  if (clean.includes('branches')) return 'Expression information saved.';
  if (clean.includes('prayer')) return 'Prayer action completed.';
  if (clean.includes('giving') || clean.includes('finance')) return 'Giving or finance changes saved.';
  if (clean.includes('leadership')) return 'Leadership changes saved.';
  if (clean.includes('roles') || clean.includes('invitations') || clean.includes('access')) return 'Access changes saved.';
  if (clean.includes('profile')) return 'Profile changes saved.';
  if (clean.includes('settings')) return 'Settings saved.';
  if (clean.includes('groups')) return 'Group changes saved.';
  if (clean.includes('sermons')) return 'Sermon changes saved.';
  if (clean.includes('creator-studio') || clean.includes('content-media')) return 'Content changes saved.';
  return 'Your changes were saved.';
}

const SILENT_MUTATION_PREFIXES = [
  'chat',
  'group-chat',
  'expression-chat',
  'engagement',
  'live-interactions',
  'stream-presence',
  'realtime-config',
  'content-playback',
  'content-media?action=playback',
  'notification-dispatch',
  'workflow-dispatch',
];

export function shouldShowMutationFeedback(path: string) {
  const clean = path.replace(/^\/+/, '');
  return !SILENT_MUTATION_PREFIXES.some((prefix) => clean.startsWith(prefix));
}
