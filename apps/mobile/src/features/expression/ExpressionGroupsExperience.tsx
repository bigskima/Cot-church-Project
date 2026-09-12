import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { ExpressionPeopleHeader } from '@/components/expression/ExpressionPeopleHeader';
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
  join_policy: 'open' | 'approval' | 'invite';
  canManageMembers: boolean;
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

export function ExpressionGroupsExperience({ embedded = false, focusGroupId }: { embedded?: boolean; focusGroupId?: string }) {
  const insets = useSafeAreaInsets();
  const { api, context, mode, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const canManageGroups = hasCapability('groups.manage');
  const includeManagement = '&includeManagement=true';

  const resource = useResource<GroupPayload>(
    `expression:groups:${expression?.id ?? 'none'}:${includeManagement}`,
    (signal) => {
      if (mode !== 'authenticated' || !expression?.id) {
        return Promise.resolve({ scope: 'expression', groups: [], pendingRequests: [] });
      }
      return api.request<GroupPayload>(`groups?scope=expression${includeManagement}`, { signal });
    }
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'members' | 'private'>('members');
  const [joinPolicy, setJoinPolicy] = useState<'open' | 'approval'>('open');
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
      const result = await api.request<GroupMembership>('groups', {
        method: 'POST',
        body: JSON.stringify({ action: 'request_membership', groupId }),
      });
      setFeedback(result.status === 'active' ? 'You have joined the group.' : 'Membership request sent to the group leaders.');
      resource.refresh();
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to request group membership.');
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
      setActionError(value instanceof Error ? value.message : 'Unable to review the membership request.');
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
          name: name.trim(),
          description: description.trim(),
          visibility,
          joinPolicy: visibility === 'private' ? 'invite' : joinPolicy,
          capacity: parsedCapacity,
          meetingSchedule: meetingNote.trim() ? { summary: meetingNote.trim() } : {},
        }),
      });
      setName('');
      setDescription('');
      setCapacity('');
      setMeetingNote('');
      setVisibility('members');
      setJoinPolicy('open');
      setCreateOpen(false);
      setFeedback(`Group created inside ${expression?.name ?? 'this Expression'}.`);
      resource.refresh();
    } catch (value) {
      setActionError(value instanceof Error ? value.message : 'Unable to create the group.');
    } finally {
      setSaving(false);
    }
  };

  if (mode !== 'authenticated' || !expression?.id) {
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
  const joinedCount = groups.filter((group) => group.myMembership?.status === 'active').length;
  const pendingCount = groups.filter((group) => group.myMembership?.status === 'requested').length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {embedded ? (
        <ExpressionPeopleHeader
          expressionId={expression.id}
          expressionName={expression.name}
          active="groups"
          title={focusedGroup?.name ?? (focusGroupId ? 'Group' : 'Groups')}
          subtitle={focusGroupId ? 'Membership, meeting details and group leadership actions.' : 'Smaller communities for fellowship, service and conversation inside this Expression.'}
          icon="people-circle-outline"
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: embedded ? spacing.sm : insets.top + spacing.sm, paddingBottom: embedded ? insets.bottom + spacing.xl : insets.bottom + 130 }}
      >
        {!embedded ? (
          <ScreenHeader title={focusedGroup?.name ?? (focusGroupId ? 'Group' : 'Groups')} kicker={expression.name.toUpperCase()} subtitle={focusGroupId ? 'A smaller community inside this Expression.' : 'Smaller communities inside this Expression.'} showBack />
        ) : null}

        <View style={styles.body}>
          {!focusGroupId ? (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="people-outline" size={17} color={colors.interactive} />
                </View>
                <Text style={[styles.summaryNumber, { color: colors.text }]}>{groups.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Available</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={[styles.summaryIcon, { backgroundColor: colors.successSoft }]}>
                  <Icon name="checkmark-circle-outline" size={17} color={colors.success} />
                </View>
                <Text style={[styles.summaryNumber, { color: colors.text }]}>{joinedCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Joined</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={[styles.summaryIcon, { backgroundColor: colors.bgSecondary }]}>
                  <Icon name="time-outline" size={17} color={colors.textSecondary} />
                </View>
                <Text style={[styles.summaryNumber, { color: colors.text }]}>{pendingCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Pending</Text>
              </View>
            </View>
          ) : null}

          {feedback ? <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.bannerText, { color: colors.success }]}>{feedback}</Text></View> : null}
          {actionError ? <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.bannerText, { color: colors.live }]}>{actionError}</Text></View> : null}

          <View style={styles.sectionHeaderRow}>
            <SectionHeader
              title={focusGroupId ? 'Group space' : 'Community groups'}
              badge={focusGroupId ? undefined : groups.length}
              subtitle={focusGroupId ? 'Membership, meeting details and requests' : 'Choose a smaller space to connect more closely'}
            />
            {focusGroupId ? (
              <Button label="All groups" onPress={() => router.replace(`/expressions/${expression.id}/groups` as any)} variant="ghost" size="sm" />
            ) : canManageGroups ? (
              <Button label="New group" onPress={() => setCreateOpen(true)} variant="primary" size="sm" />
            ) : null}
          </View>

          {resource.loading && !resource.data ? (
            <Skeleton height={142} count={3} />
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : visibleGroups.length ? visibleGroups.map((group) => {
            const membership = group.myMembership;
            const meetingSummary = typeof group.meeting_schedule?.summary === 'string' ? group.meeting_schedule.summary : null;
            const requests = pendingByGroup.get(group.id) ?? [];
            const joined = membership?.status === 'active';
            return (
              <View
                key={group.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: joined ? colors.interactive : colors.borderSubtle },
                  shadows.sm,
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.groupIcon, { backgroundColor: joined ? colors.primarySoft : colors.bgSecondary }]}>
                    <Icon name={group.visibility === 'private' ? 'lock-closed-outline' : 'people-outline'} size={19} color={joined ? colors.interactive : colors.textSecondary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                    <View style={styles.badges}>
                      <Badge label={group.visibility === 'private' ? 'PRIVATE' : 'MEMBERS'} variant={group.visibility === 'private' ? 'neutral' : 'primary'} />
                      {joined ? <Badge label={membership?.is_leader ? 'GROUP LEADER' : 'JOINED'} variant="active" /> : null}
                      {membership?.status === 'requested' ? <Badge label="REQUEST PENDING" variant="neutral" /> : null}
                    </View>
                  </View>
                </View>

                {group.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{group.description}</Text> : null}

                {(meetingSummary || group.capacity) ? (
                  <View style={[styles.metaPanel, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
                    {meetingSummary ? <View style={styles.metaRow}><Icon name="calendar-outline" size={15} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{meetingSummary}</Text></View> : null}
                    {group.capacity ? <View style={styles.metaRow}><Icon name="person-outline" size={15} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>Up to {group.capacity.toLocaleString()} members</Text></View> : null}
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  {!membership && group.visibility === 'members' && group.join_policy !== 'invite' ? <Button label={group.join_policy === 'open' ? 'Join group' : 'Request to join'} onPress={() => void requestMembership(group.id)} loading={busyId === group.id} variant="primary" size="sm" /> : null}
                  {(membership?.status === 'declined' || membership?.status === 'removed') && group.visibility !== 'private' && group.join_policy !== 'invite' ? <Button label="Request Again" onPress={() => void requestMembership(group.id)} loading={busyId === group.id} variant="outline" size="sm" /> : null}
                  {joined ? <Button label="Group chat" onPress={() => router.push(`/expressions/${expression.id}/groups/${group.id}/chat` as any)} variant="primary" size="sm" /> : null}
                  {!focusGroupId ? <Button label="Open group" onPress={() => router.push(`/expressions/${expression.id}/groups/${group.id}` as any)} variant="ghost" size="sm" /> : null}
                </View>

                {group.canManageMembers && requests.length ? (
                  <View style={[styles.requestsBlock, { borderTopColor: colors.borderSubtle }]}>
                    <View style={styles.requestsHeading}>
                      <View style={[styles.requestIcon, { backgroundColor: colors.primarySoft }]}><Icon name="person-add-outline" size={15} color={colors.interactive} /></View>
                      <View style={styles.flex}>
                        <Text style={[styles.requestsTitle, { color: colors.text }]}>Membership requests</Text>
                        <Text style={[styles.requestsSubtitle, { color: colors.textMuted }]}>{requests.length} awaiting review</Text>
                      </View>
                    </View>
                    {requests.map((request) => {
                      const profile = request.member?.profile;
                      const label = profile?.display_name || profile?.username || 'Expression member';
                      return (
                        <View key={request.id} style={[styles.requestRow, { backgroundColor: colors.bgSecondary }]}>
                          <View style={styles.flex}>
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
              title={focusGroupId ? 'Group unavailable' : 'No groups yet'}
              message={focusGroupId ? 'This group does not belong to the active Expression or is no longer available.' : canManageGroups ? 'Create the first group for this Expression.' : 'Expression leaders have not published any member groups yet.'}
              iconName="people-outline"
            />
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Create group" subtitle={`Inside ${expression.name}`}>
        <View style={styles.form}>
          <View style={[styles.formIntro, { backgroundColor: colors.primarySoft }]}>
            <Icon name="lock-closed-outline" size={17} color={colors.interactive} />
            <Text style={[styles.helper, { color: colors.textSecondary }]}>This group will be permanently scoped to the currently selected Expression.</Text>
          </View>
          <InputField label="Group Name" value={name} onChangeText={setName} placeholder="e.g. Young Adults Fellowship" />
          <InputField label="Description" value={description} onChangeText={setDescription} placeholder="What is this group for?" multiline numberOfLines={3} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>VISIBILITY</Text>
          <View style={styles.chips}><Chip label="Expression Members" selected={visibility === 'members'} onPress={() => setVisibility('members')} /><Chip label="Private / Invite-led" selected={visibility === 'private'} onPress={() => setVisibility('private')} /></View>
          {visibility === 'members' ? (
            <View style={styles.actionRow}>
              <Chip label="Open joining" selected={joinPolicy === 'open'} onPress={() => setJoinPolicy('open')} />
              <Chip label="Leader approval" selected={joinPolicy === 'approval'} onPress={() => setJoinPolicy('approval')} />
            </View>
          ) : null}
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
  screen: { flex: 1 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryCard: { flex: 1, minHeight: 86, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  summaryIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  summaryNumber: { fontSize: 17, lineHeight: 21, fontWeight: '900' },
  summaryLabel: { fontSize: 9, lineHeight: 12, fontWeight: '800', marginTop: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '600' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  groupIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  description: { fontSize: 13, lineHeight: 19 },
  metaPanel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, lineHeight: 16 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  requestsBlock: { borderTopWidth: 1, marginTop: spacing.xs, paddingTop: spacing.md, gap: spacing.sm },
  requestsHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  requestIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  requestsTitle: { fontSize: 13, fontWeight: '800' },
  requestsSubtitle: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, padding: spacing.sm },
  requestName: { fontSize: 12, fontWeight: '700' },
  form: { gap: spacing.md },
  formIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  helper: { flex: 1, fontSize: 12, lineHeight: 17 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
