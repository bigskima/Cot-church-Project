const MENTION_PATTERN = /(?:^|[\\s([{])@([a-z0-9][a-z0-9._]{2,29})/gi;

export function notificationPreview(value: unknown, fallback = "Open COT to view this update.", max = 180) {
  const text = typeof value === "string" ? value.trim().replace(/\\s+/g, " ") : "";
  return (text || fallback).slice(0, max);
}

export function mentionUsernames(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [] as string[];
  const usernames = new Set<string>();
  for (const match of value.matchAll(MENTION_PATTERN)) {
    if (match[1]) usernames.add(match[1].toLowerCase());
  }
  return [...usernames];
}

export async function senderIdentity(admin: any, profileId: string) {
  const { data } = await admin.from("profiles")
    .select("id,username,display_name,avatar_url")
    .eq("id", profileId)
    .maybeSingle();
  return data ?? { id: profileId, username: null, display_name: "COT member", avatar_url: null };
}

export async function profileIdsForUsernames(admin: any, usernames: string[]) {
  if (!usernames.length) return [] as Array<{ id: string; username: string | null; display_name: string | null }>;
  const { data, error } = await admin.from("profiles")
    .select("id,username,display_name")
    .in("username", usernames)
    .limit(100);
  if (error) return [];
  return (data ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>;
}

export async function commonOrganizationId(admin: any, firstProfileId: string, secondProfileId: string) {
  const { data, error } = await admin.from("memberships")
    .select("profile_id,organization_id,created_at")
    .in("profile_id", [firstProfileId, secondProfileId])
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return null;
  const first = new Set((data ?? []).filter((row: any) => row.profile_id === firstProfileId).map((row: any) => row.organization_id));
  return (data ?? []).find((row: any) => row.profile_id === secondProfileId && first.has(row.organization_id))?.organization_id ?? null;
}

export async function createNotifications(admin: any, input: {
  organizationId: string;
  recipientProfileIds: string[];
  senderProfileId?: string | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const recipients = [...new Set(input.recipientProfileIds.filter(Boolean))]
    .filter((id) => !input.senderProfileId || id !== input.senderProfileId);
  if (!recipients.length) return [];

  const rows = recipients.map((recipientProfileId) => ({
    organization_id: input.organizationId,
    recipient_profile_id: recipientProfileId,
    type: input.type,
    title: notificationPreview(input.title, "COT", 160),
    body: notificationPreview(input.body),
    data: input.data ?? {},
  }));
  const { data, error } = await admin.from("notifications")
    .insert(rows)
    .select("id,recipient_profile_id");
  if (error) {
    console.error(JSON.stringify({ event: "notification_insert_failed", type: input.type, recipientCount: recipients.length, error: error.message }));
    return [];
  }
  return data ?? [];
}
