import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { toUserFacingErrorMessage } from '@/api';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

type GroupMembership = {
  id: string;
  status: 'requested' | 'active' | 'declined' | 'removed';
  is_leader: boolean;
  requested_at: string;
  responded_at?: string | null;
};

type Group = {
  id: string;
  branch_id: string | null;
  ministry_id: string | null;
  name: string;
  description: string;
  visibility: 'members' | 'private';
  capacity: number | null;
  meeting_schedule: Record<string, unknown>;
  is_active: boolean;
  myMembership: GroupMembership | null;
};

type PendingRequest = {
  id: string;
  group_id: string;
  membership_id: string;
  requested_at: string;
  member?: {
    id: string;
    profile_id: string;
    branch_id: string | null;
    profile?: { id: string; display_name: string; username?: string | null; avatar_url?: string | null } | null;
  } | null;
};

type GroupPayload = {
  scope: 'expression' | 'church' | 'all';
  groups: Group[];
  pendingRequests: PendingRequest[];
};

export function ExpressionGroupsExperience({ embedded = false, focusGroupId, expressionId }: { embedded?: boolean; focusGroupId?: string; expressionId?: string }) {
  const insets = useSafeAreaInsets();
  const { api, context, mode, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const targetExpressionId = expressionId || expression?.id || '';
  const canManageGroups = hasCapability('groups.manage');
  const canManageMembers = hasCapability('groups.members.manage');
  const includeManagement = canManageMembers ? '&includeManagement=true' : '';

  const resource = useResource<GroupPayload>(
    `expression:groups:${targetExpressionId || 'none'}:${includeManagement}`,
    (signal) => {
      if (mode !== 'authenticated' || !targetExpressionId) {
        return Promise.resolve({ scope: 'expression', groups: [], pendingRequests: [] });
      }
      const query = new URLSearchParams({ scope: 'expression', branchId: targetExpressionId });
      if (canManageMembers) query.set('includeManagement', 'true');
      return api.request<GroupPayload>(`groups?${query.toString()}`, { signal });
    }
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'members' | 'private'>('members');
  const [capacity, setCapacity] = useState('');
  const [meetingNote, setMeetingNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');

  const pendingByGroup = useMemo(() => {
    const map = new Map<string, PendingRequest[]>();
    for (const request of resource.data?.pendingRequests ?? []) {
      map.set(request.group_id, [...(map.get(request.group_id) ?? []), request]);
    }
    return map;
  }, [resource.data?.pendingRequests]);

  const requestMembership = async (groupId: string) => {
    setBusyId(groupId);
    setActionError('');
    setFeedback('');
    try {
      await api.request('groups', {
        method: 'POST',
        body: JSON.stringify({ action: 'request_membership', groupId }),
      });
      setFeedback('Membership request sent to the group leaders.');
      resource.refresh();
    } catch (value) {
      setActionError(toUserFacingErrorMessage(value, 'We couldn’t send your request. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const reviewRequest = async (requestId: string, approved: boolean) => {
    setBusyId(requestId);
    setActionError('');
    setFeedback('');
    try {
      await api.request('groups', {
        method: 'POST',
        body: JSON.stringify({ action: 'review_membership', groupMembershipId: requestId, approved }),
      });
      setFeedback(approved ? 'Group membership approved.' : 'Group membership declined.');
      resource.refresh();
    } catch (value) {
      setActionError(toUserFacingErrorMessage(value, 'We couldn’t update this request. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const createGroup = async () => {
    if (!name.trim()) {
      setActionError('Enter a group name.');
      return;
    }
    const parsedCapacity = capacity.trim() ? Number(capacity) : null;
    if (parsedCapacity !== null && (!Number.isInteger(parsedCapacity) || parsedCapacity < 1)) {
      setActionError('Capacity must be a positive whole number.');
      return;
    }

    setSaving(true);
    setActionError('');
    setFeedback('');
    try {
      await api.request('groups', {
        method: 'POST',
        body: JSON.stringify({
          branchId: targetExpressionId,
          name: name.trim(),
          description: description.trim(),
          visibility,
          capacity: parsedCapacity,
          meetingSchedule: meetingNote.trim() ? { summary: meetingNote.trim() } : {},
        }),
      });
      setName('');
      setDescription('');
      setCapacity('');
      setMeetingNote('');
      setVisibility('members');
      setCreateOpen(false);
      setFeedback(`Group created inside ${expression?.name ?? 'this Expression'}.`);
      resource.refresh();
    } catch (value) {
      setActionError(toUserFacingErrorMessage(value, 'We couldn’t create this group. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (mode !== 'authenticated' || !targetExpressionId) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
        <ScreenHeader title="Groups" subtitle="Expression community groups." showBack />
        <View style={styles.body}>
          <EmptyState title="Join an Expression first" message="Expression groups are available only to members of that specific Expression." iconName="people-outline" />
        </View>
      </View>
    );
  }

  const groups = resource.data?.groups ?? [];
  const focusedGroup = focusGroupId ? groups.find((group) => group.id === focusGroupId) ?? null : null;
  const visibleGroups = focusGroupId ? (focusedGroup ? [focusedGroup] : []) : groups;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: embedded ? spacing.md : insets.top + spacing.sm, paddingBottom: embedded ? insets.bottom + spacing.xl : insets.bottom + 130 }}
      >
        {!embedded ? (
          <ScreenHeader title={focusedGroup?.name ?? (focusGroupId ? "Group" : "Groups")} kicker={(expression?.name ?? 'this Expression').toUpperCase()} subtitle={focusGroupId ? "A smaller community inside this Expression." : "Smaller communities inside this Expression."} showBack />
        ) : (
          <View style={[styles.embeddedIntro, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View pointerEvents="none" style={[styles.introGlow, { backgroundColor: colors.primarySoft }]} />
            <View style={[styles.introIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name={focusGroupId ? 'people-circle' : 'people-outline'} size={23} color={colors.interactive} />
            </View>
            <View style={styles.introCopy}>
              <Text style={[styles.embeddedEyebrow, { color: colors.interactive }]}>COMMUNITY SPACES</Text>
              <Text style={[styles.embeddedTitle, { color: colors.text }]}>{focusedGroup?.name ?? (focusGroupId ? 'Group' : 'Groups')}</Text>
              <Text style={[styles.embeddedCopy, { color: colors.textSecondary }]}>
                {focusGroupId ? 'Conversation, fellowship and group activity in one place.' : `Find smaller communities inside ${(expression?.name ?? 'this Expression')}.`}
              </Text>
            </View>
            {!focusGroupId && canManageGroups ? (
              <Button label="New group" onPress={() => setCreateOpen(true)} size="sm" />
            ) : null}
          </View>
        )}
        <View style={styles.body}>
          {feedback ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{feedback}</Text></View> : null}
          {actionError ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{actionError}</Text></View> : null}

          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionCopy}>
              <View style={styles.sectionTitleLine}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{focusGroupId ? 'Group space' : 'Your groups'}</Text>
                {!focusGroupId ? <Badge label={String(groups.length)} variant="neutral" /> : null}
              </View>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                {focusGroupId ? 'Membership, meeting details and requests' : 'Conversations and fellowship spaces you can enter'}
              </Text>
            </View>
            {focusGroupId ? (
              <Button label="All groups" onPress={() => router.replace(`/expressions/${targetExpressionId}/groups` as any)} variant="outline" size="sm" />
            ) : null}
          </View>

          {resource.loading && !resource.data ? (
            <Skeleton height={130} count={3} />
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} compact />
          ) : visibleGroups.length ? visibleGroups.map((group) => {
            const membership = group.myMembership;
            const meetingSummary = typeof group.meeting_schedule?.summary === 'string' ? group.meeting_schedule.summary : null;
            const requests = pendingByGroup.get(group.id) ?? [];
            return (
              <View key={group.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                    <View style={styles.badges}>
                      <Badge label={group.visibility === 'private' ? 'PRIVATE' : 'MEMBERS'} variant={group.visibility === 'private' ? 'neutral' : 'primary'} />
                      {membership?.status === 'active' ? <Badge label={membership.is_leader ? 'GROUP LEADER' : 'JOINED'} variant="active" /> : null}
                      {membership?.status === 'requested' ? <Badge label="REQUEST PENDING" variant="neutral" /> : null}
                    </View>
                  </View>
                  <View style={[styles.groupIcon, { backgroundColor: colors.primarySoft }]}><Icon name="people-outline" size={20} color={colors.interactive} /></View>
                </View>

                {group.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{group.description}</Text> : null}
                {meetingSummary ? <View style={styles.metaRow}><Icon name="calendar-outline" size={15} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textMuted }]}>{meetingSummary}</Text></View> : null}
                {group.capacity ? <View style={styles.metaRow}><Icon name="person-outline" size={15} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textMuted }]}>Capacity: {group.capacity.toLocaleString()}</Text></View> : null}

                {!membership && group.visibility === 'members' ? <Button label="Request to Join" onPress={() => void requestMembership(group.id)} loading={busyId === group.id} variant="primary" size="sm" /> : null}
                {membership?.status === 'declined' || membership?.status === 'removed' ? <Button label="Request Again" onPress={() => void requestMembership(group.id)} loading={busyId === group.id} variant="outline" size="sm" /> : null}
                {!focusGroupId ? (
                  <Button
                    label="Open group"
                    onPress={() => router.push(`/expressions/${targetExpressionId}/groups/${group.id}` as any)}
                    variant="ghost"
                    size="sm"
                  />
                ) : null}

                {canManageMembers && requests.length ? (
                  <View style={[styles.requestsBlock, { borderTopColor: colors.borderSubtle }]}>
                    <Text style={[styles.requestsTitle, { color: colors.text }]}>Pending Requests ({requests.length})</Text>
                    {requests.map((request) => {
                      const profile = request.member?.profile;
                      const label = profile?.display_name || profile?.username || 'Expression member';
                      return (
                        <View key={request.id} style={styles.requestRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.requestName, { color: colors.text }]}>{label}</Text>
                            {profile?.username ? <Text style={[styles.metaText, { color: colors.textMuted }]}>@{profile.username}</Text> : null}
                          </View>
                          <Button label="Decline" onPress={() => void reviewRequest(request.id, false)} disabled={busyId === request.id} variant="ghost" size="sm" />
                          <Button label="Approve" onPress={() => void reviewRequest(request.id, true)} loading={busyId === request.id} variant="outline" size="sm" />
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          }) : (
            <EmptyState
              title={focusGroupId ? "Group unavailable" : "No groups yet"}
              message={focusGroupId ? "This group does not belong to the active Expression or is no longer available." : canManageGroups ? 'Create the first group for this Expression.' : 'Expression leaders have not published any member groups yet.'}
              iconName="people-outline"
              style={styles.emptyCompact}
            />
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Create group" subtitle={`Inside ${(expression?.name ?? 'this Expression')}`}>
        <View style={styles.form}>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>This group will be permanently scoped to the currently selected Expression.</Text>
          <InputField label="Group Name" value={name} onChangeText={setName} placeholder="e.g. Young Adults Fellowship" />
          <InputField label="Description" value={description} onChangeText={setDescription} placeholder="What is this group for?" multiline numberOfLines={3} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>VISIBILITY</Text>
          <View style={styles.chips}><Chip label="Expression Members" selected={visibility === 'members'} onPress={() => setVisibility('members')} /><Chip label="Private / Invite-led" selected={visibility === 'private'} onPress={() => setVisibility('private')} /></View>
          <InputField label="Capacity (Optional)" value={capacity} onChangeText={setCapacity} placeholder="Leave blank for no limit" keyboardType="number-pad" />
          <InputField label="Meeting Note (Optional)" value={meetingNote} onChangeText={setMeetingNote} placeholder="e.g. Saturdays, 5:00 PM · Fellowship Hall" />
          <Button label="Create Expression Group" onPress={() => void createGroup()} loading={saving} variant="primary" size="lg" />
        </View>
      </BottomSheet>
    </View>
  );
}

export default function ExpressionGroupsRouteExperience() {
  return <ExpressionGroupsExperience />;
}

const styles = StyleSheet.create({
  embeddedIntro: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  introGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, right: -70, top: -90, opacity: 0.8 },
  introIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, minWidth: 0 },
  embeddedEyebrow: { fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: 1 },
  embeddedTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.6, marginTop: 1 },
  embeddedCopy: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  screen: { flex: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.md },
  emptyCompact: { minHeight: 180, marginTop: spacing.xs },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '600' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.45 },
  sectionSubtitle: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  groupIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  description: { fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, lineHeight: 16 },
  requestsBlock: { borderTopWidth: 1, marginTop: spacing.xs, paddingTop: spacing.md, gap: spacing.sm },
  requestsTitle: { fontSize: 13, fontWeight: '800' },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  requestName: { fontSize: 12, fontWeight: '700' },
  form: { gap: spacing.md },
  helper: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
