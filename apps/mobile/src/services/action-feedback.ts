export type ActionFeedback = {
  id: string;
  kind: 'success' | 'error';
  title: string;
  message: string;
  details?: string[];
  retry?: (() => Promise<unknown>) | null;
  operationKey?: string;
};

type Listener = (feedback: ActionFeedback) => void;
const listeners = new Set<Listener>();

type MutationDescription = {
  action: string;
  resource: string;
  target?: string;
};

export function subscribeActionFeedback(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitActionFeedback(feedback: Omit<ActionFeedback, 'id'>) {
  const item: ActionFeedback = {
    ...feedback,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  listeners.forEach((listener) => listener(item));
}

export function mutationFeedbackKey(path: string, method: string, body?: unknown) {
  const parsed = parseMutationBody(body);
  const cleanPath = path.split('?')[0].replace(/^\/+/, '');
  const action = readable(parsed.action) || method.toUpperCase();
  const identity = [
    parsed.id,
    parsed.groupId,
    parsed.expressionId,
    parsed.conversationId,
    parsed.profileId,
    parsed.definitionId,
    parsed.campaignId,
    parsed.key,
  ].map(readable).find(Boolean) || '';
  return [cleanPath, action.toLowerCase(), identity].filter(Boolean).join(':');
}

function parseMutationBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'string') return {};
  try {
    const value = JSON.parse(body) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readable(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function resourceName(path: string) {
  const clean = path.split('?')[0].replace(/^\/+/, '');
  const matches: Array<[string, string]> = [
    ['announcements', 'announcement'],
    ['event-registrations', 'event registration'],
    ['events', 'event'],
    ['church-story', 'church information'],
    ['branches', 'Expression'],
    ['prayer', 'prayer request'],
    ['giving', 'giving setting'],
    ['finance', 'finance setting'],
    ['leadership', 'leadership setting'],
    ['roles', 'role or access setting'],
    ['invitations', 'invitation'],
    ['profile', 'profile'],
    ['settings', 'setting'],
    ['groups', 'group'],
    ['sermons', 'sermon'],
    ['creator-studio', 'content'],
    ['content-media', 'content'],
  ];
  return matches.find(([fragment]) => clean.includes(fragment))?.[1] ?? 'change';
}

function actionName(method: string, body: Record<string, unknown>, resource: string) {
  const action = readable(body.action).toLowerCase();
  const named: Record<string, string> = {
    store: 'Stored',
    delete: 'Removed',
    check: 'Checked',
    configure_global: 'Configured',
    set_provider_active: body.isActive === false ? 'Disabled' : 'Enabled',
    terminate_stream: 'Terminated',
    configure_provider: 'Configured',
    upsert_model: 'Saved',
    set_route: 'Updated',
    upsert_provider_config: 'Prepared',
    retry_job: 'Queued for retry',
    set_connection_status: readable(body.status).toLowerCase() === 'disabled' ? 'Disabled' : 'Enabled',
    set_global: body.enabled === false ? 'Disabled' : 'Enabled',
    set_public_posting_policy: 'Updated',
    add_public_posting_exemption: 'Granted',
    remove_public_posting_exemption: 'Revoked',
    resolve_report: 'Updated',
    retry_storage_cleanup: 'Retried',
    remove_content: 'Removed',
    remove_comment: 'Removed',
    upsert_story: 'Saved',
    create_leader: 'Added',
    update_leader: 'Updated',
    archive_leader: 'Archived',
  };
  if (named[action]) return named[action];
  if (method === 'DELETE') return 'Removed';
  if (method === 'POST') return resource === 'change' ? 'Completed' : 'Created or submitted';
  if (method === 'PATCH' || method === 'PUT') return 'Updated';
  return 'Completed';
}

function mutationTarget(body: Record<string, unknown>) {
  const candidates = [
    body.displayName,
    body.name,
    body.title,
    body.email,
    body.reference,
    body.permissionCode,
    body.capabilityCode,
    body.providerCode,
    body.key,
  ];
  return candidates.map(readable).find(Boolean) || undefined;
}

export function describeMutation(path: string, method: string, body?: unknown): MutationDescription {
  const parsed = parseMutationBody(body);
  const resource = resourceName(path);
  return {
    action: actionName(method.toUpperCase(), parsed, resource),
    resource,
    target: mutationTarget(parsed),
  };
}

function responseDetail(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  const record = data as Record<string, unknown>;
  const status = readable(record.status);
  if (status) return `Returned status: ${status.replaceAll('_', ' ')}`;
  if (typeof record.is_active === 'boolean') return `Current state: ${record.is_active ? 'active' : 'inactive'}`;
  if (typeof record.effective_enabled === 'boolean') return `Current state: ${record.effective_enabled ? 'enabled' : 'disabled'}`;
  return '';
}

export function buildMutationSuccessFeedback(path: string, method: string, body?: unknown, data?: unknown) {
  const description = describeMutation(path, method, body);
  const target = description.target ? ` “${description.target}”` : '';
  const resultDetail = responseDetail(data);
  const resourceLabel = `${description.resource[0]?.toUpperCase() ?? ''}${description.resource.slice(1)}`;
  return {
    title: `${resourceLabel} ${description.action.toLowerCase()}`,
    message: description.target
      ? `${resourceLabel}${target} was updated successfully.`
      : `${resourceLabel} was updated successfully.`,
    details: [
      ...(description.target ? [`Updated: ${description.target}`] : []),
      ...(resultDetail ? [resultDetail] : []),
    ],
  };
}

export function buildMutationFailureDetails(path: string, method: string, body?: unknown) {
  const description = describeMutation(path, method, body);
  return [
    ...(description.target ? [`Target: ${description.target}`] : []),
    `The ${description.resource} update was not completed.`,
  ];
}

export function defaultMutationSuccess(path: string, method: string) {
  return buildMutationSuccessFeedback(path, method).message;
}

const SILENT_MUTATION_PREFIXES = [
  // Conversational / continuous interactions have their own inline UI state.
  'chat',
  'group-chat',
  'expression-chat',
  'engagement',
  'live-interactions',
  'ai-gateway',

  // Session/auth flows already present dedicated screen-level confirmation or errors.
  'login',
  'signup',
  'verify-otp',
  'password-recovery',
  'password-reset',
  'logout',

  // Transport, upload, playback and presence steps are intermediate operations,
  // not user-facing actions that should each open a modal.
  'stream-access',
  'stream-presence',
  'realtime-config',
  'content-playback',
  'content-media',
  'community-media',
  'notification-dispatch',
  'workflow-dispatch',
];

export function shouldShowMutationFeedback(path: string) {
  const clean = path.replace(/^\/+/, '');
  return !SILENT_MUTATION_PREFIXES.some((prefix) => clean.startsWith(prefix));
}
