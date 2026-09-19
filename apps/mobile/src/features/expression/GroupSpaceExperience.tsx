import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, BottomSheet, Button, Chip, EmptyState, Icon, InputField, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { DateTimeField } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { invalidate } from '@/services/query-cache';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Permission = 'manage_members' | 'manage_chat' | 'manage_content' | 'pin_messages' | 'create_sections' | 'assign_roles' | 'manage_giving';
type Role = { id: string; name: string; color: string; permissions: Permission[]; is_system: boolean };
type Member = {
  id: string; status: string; is_leader: boolean; chat_restricted_until?: string | null; banned_at?: string | null; moderation_reason?: string | null;
  profile?: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
  roles: Role[];
};
type Section = { id: string; name: string; description?: string; expires_at?: string | null; is_archived: boolean };
type Announcement = { id: string; title: string; body: string; is_pinned: boolean; published_at?: string | null };
type Event = { id: string; title: string; description?: string; starts_at: string; ends_at?: string | null; timezone: string; location?: { name?: string } };
type GivingOption = { id: string; giving_purpose_id: string; label: string; note?: string; purpose?: { id: string; name: string; description?: string } | null };
type Purpose = { id: string; name: string; description?: string };
type Payload = {
  group: { id: string; name: string; description?: string; visibility: string; join_policy: string; meeting_schedule?: Record<string, unknown> };
  membership: { id: string; is_leader: boolean };
  permissions: { manageMembers: boolean; manageChat: boolean; manageContent: boolean; pinMessages: boolean; createSections: boolean; assignRoles: boolean; manageGiving: boolean };
  sections: Section[]; members: Member[]; roles: Role[]; announcements: Announcement[]; events: Event[];
  givingOptions: GivingOption[]; availableGivingPurposes: Purpose[];
};

type Tab = 'home' | 'announcements' | 'events' | 'giving' | 'people';
type Sheet = 'announcement' | 'event' | 'section' | 'role' | null;
const ROLE_PERMISSIONS: { value: Permission; label: string }[] = [
  { value: 'manage_members', label: 'Members' }, { value: 'manage_chat', label: 'Moderate chat' },
  { value: 'manage_content', label: 'Content' }, { value: 'manage_giving', label: 'Giving' },
  { value: 'pin_messages', label: 'Pin' }, { value: 'create_sections', label: 'Rooms' }, { value: 'assign_roles', label: 'Roles' },
];

export function GroupSpaceExperience({ groupId, initialTab = 'home', scope = 'expression' }: { groupId: string; initialTab?: Tab; scope?: 'expression' | 'general' }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const expression = context?.expression;
  const generalGroup = scope === 'general';
  const routeBase = generalGroup ? '/general/groups' : `/expressions/${expression?.id}/groups`;
  const key = `group-chat:${groupId}:space`;
  const resource = useResource<Payload>(key, (signal) => {
    if (mode !== 'authenticated' || !groupId) return Promise.reject(new Error('Join this Group to open its space.'));
    return api.request<Payload>(`group-chat?groupId=${encodeURIComponent(groupId)}`, { signal, context: 'current' });
  });
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [roomHours, setRoomHours] = useState('24');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [roleColor, setRoleColor] = useState('#64748B');
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);

  const mutate = async (action: string, values: Record<string, unknown>, success: string) => {
    setBusy(action);
    setActionError('');
    setFeedback('');
    try {
      const result = await api.request<any>('group-chat', { method: 'POST', context: 'current', body: JSON.stringify({ action, groupId, ...values }) });
      setFeedback(success);
      invalidate(`group-chat:${groupId}:`);
      resource.refresh();
      return result;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'That Group action could not be completed.');
      return null;
    } finally { setBusy(''); }
  };

  const resetSheet = () => { setSheet(null); setTitle(''); setBody(''); setStartsAt(null); setEndsAt(null); setLocation(''); setSelectedMembers([]); setRoomHours('24'); setRoleColor('#64748B'); setRolePermissions([]); };
  const createAnnouncement = async () => {
    if (!title.trim() || !body.trim()) return setActionError('Add an announcement title and message.');
    const result = await mutate('create_announcement', { title: title.trim(), body: body.trim(), isPinned: true }, 'Announcement published.');
    if (result) resetSheet();
  };
  const createEvent = async () => {
    if (!title.trim() || !startsAt) return setActionError('Add an event title and choose its start date/time.');
    if (endsAt && endsAt <= startsAt) return setActionError('The event end must be after its start.');
    const result = await mutate('create_event', {
      title: title.trim(),
      description: body.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      location: location.trim(),
    }, 'Group event published.');
    if (result) resetSheet();
  };
  const createSection = async () => {
    const hours = Number(roomHours);
    if (!title.trim() || !Number.isFinite(hours) || hours < 1 || hours > 720) return setActionError('Enter a room name and duration between 1 and 720 hours.');
    const result = await mutate('create_section', { name: title.trim(), description: body.trim(), memberIds: selectedMembers, expiresAt: new Date(Date.now() + hours * 3600000).toISOString() }, 'Temporary chat created.');
    if (!result) return;
    resetSheet();
    if (result.id) router.push(`${routeBase}/${groupId}/chat?sectionId=${result.id}` as any);
  };
  const createRole = async () => {
    if (!title.trim()) return setActionError('Enter a role name.');
    const result = await mutate('create_role', { name: title.trim(), color: roleColor, permissions: rolePermissions }, 'Group role created.');
    if (result) resetSheet();
  };

  const activeMembers = useMemo(() => (resource.data?.members ?? []).filter((member) => member.status === 'active' && !member.banned_at), [resource.data?.members]);
  const activeSections = useMemo(() => (resource.data?.sections ?? []).filter((section) => !section.is_archived && (!section.expires_at || new Date(section.expires_at).getTime() > Date.now())), [resource.data?.sections]);
  const canAdmin = Boolean(resource.data?.permissions.manageMembers || resource.data?.permissions.manageChat || resource.data?.permissions.assignRoles || resource.data?.permissions.manageGiving);

  if (resource.loading && !resource.data) return <View style={[styles.center, { backgroundColor: colors.bg }]}><Skeleton height={140} count={3} /></View>;
  if (resource.error && !resource.data) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}><ScreenHeader title='Group space' showBack /><View style={styles.body}><ResourceError message={resource.error} retry={resource.refresh} /></View></View>;
  const data = resource.data;
  if (!data) return null;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'home', label: 'Home', icon: 'home-outline' }, { key: 'announcements', label: 'News', icon: 'megaphone-outline' },
    { key: 'events', label: 'Events', icon: 'calendar-outline' }, { key: 'giving', label: 'Giving', icon: 'gift-outline' },
    { key: 'people', label: canAdmin ? 'Admin' : 'People', icon: 'people-outline' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 110 }}>
        <ScreenHeader title={data.group.name} kicker='GROUP SPACE' subtitle={data.group.description || 'A smaller community inside this Expression.'} showBack />
        <View style={styles.body}>
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}><Icon name='people-circle' size={28} color={colors.interactive} /></View>
            <View style={styles.flex}><Text style={[styles.heroTitle, { color: colors.text }]}>{data.group.name}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{activeMembers.length} members · {data.group.visibility === 'private' ? 'Private' : generalGroup ? 'Church members' : 'Expression members'}</Text></View>
            <Button label='Open chat' onPress={() => router.push(`${routeBase}/${groupId}/chat` as any)} variant='primary' size='sm' />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map((item) => <Chip key={item.key} label={item.label} icon={item.icon} selected={tab === item.key} onPress={() => setTab(item.key)} />)}</ScrollView>
          {feedback ? <View style={[styles.notice, { backgroundColor: colors.successSoft }]}><Icon name='checkmark-circle' size={17} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{feedback}</Text></View> : null}
          {actionError ? <View style={[styles.notice, { backgroundColor: colors.liveSoft }]}><Icon name='alert-circle' size={17} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{actionError}</Text></View> : null}

          {tab === 'home' ? <>
            <SectionHeader title='Inside this Group' subtitle='Expression features, scoped to this smaller community' />
            <View style={styles.grid}>
              <Feature title='Announcements' value={data.announcements.length} icon='megaphone-outline' onPress={() => setTab('announcements')} />
              <Feature title='Events' value={data.events.length} icon='calendar-outline' onPress={() => setTab('events')} />
              <Feature title='Giving' value={data.givingOptions.length} icon='gift-outline' onPress={() => generalGroup || expression?.id ? router.push(`${routeBase}/${groupId}/giving` as any) : setTab('giving')} />
              <Feature title='Roles' value={data.roles.length} icon='ribbon-outline' onPress={() => setTab('people')} />
            </View>
            <SectionHeader title='Temporary chats' badge={activeSections.length} subtitle='Focused conversations for selected members' />
            {data.permissions.createSections ? <Button label='Create temporary chat' onPress={() => setSheet('section')} variant='outline' size='sm' /> : null}
            {activeSections.map((section) => <Pressable key={section.id} onPress={() => router.push(`${routeBase}/${groupId}/chat?sectionId=${section.id}` as any)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Icon name='timer-outline' size={20} color={colors.interactive} /><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{section.name}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Expires {section.expires_at ? new Date(section.expires_at).toLocaleString() : 'when closed'}</Text></View><Icon name='chevron-forward' size={18} color={colors.textMuted} /></Pressable>)}
          </> : null}

          {tab === 'announcements' ? <><View style={styles.heading}><SectionHeader title='Announcements' badge={data.announcements.length} />{data.permissions.manageContent ? <Button label='New' onPress={() => setSheet('announcement')} size='sm' /> : null}</View>{data.announcements.length ? data.announcements.map((item) => <View key={item.id} style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><View style={styles.heading}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>{item.is_pinned ? <Badge label='PINNED' variant='primary' /> : null}</View><Text style={[styles.copy, { color: colors.textSecondary }]}>{item.body}</Text></View>) : <EmptyState title='No Group announcements' message='Important updates for this Group will appear here.' iconName='megaphone-outline' />}</> : null}

          {tab === 'events' ? <><View style={styles.heading}><SectionHeader title='Group events' badge={data.events.length} />{data.permissions.manageContent ? <Button label='New' onPress={() => setSheet('event')} size='sm' /> : null}</View>{data.events.length ? data.events.map((item) => <View key={item.id} style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.accent, { color: colors.interactive }]}>{new Date(item.starts_at).toLocaleString()}</Text>{item.location?.name ? <Text style={[styles.meta, { color: colors.textMuted }]}>{item.location.name}</Text> : null}{item.description ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{item.description}</Text> : null}</View>) : <EmptyState title='No Group events' message='Small-group meetings and activities will appear here.' iconName='calendar-outline' />}</> : null}

          {tab === 'giving' ? <><SectionHeader title='Group giving' subtitle={generalGroup ? 'Approved church-wide giving destinations for this Group' : "Approved giving destinations from this Group's Expression"} />{data.permissions.manageGiving ? <Button label={data.givingOptions.length ? 'Manage Group Giving' : 'Set up Group Giving'} onPress={() => router.push(`${routeBase}/${groupId}/giving` as any)} variant='primary' size='sm' /> : null}{data.givingOptions.map((item) => <View key={item.id} style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.label}</Text>{item.note ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{item.note}</Text> : null}<Button label='Open Group Giving' onPress={() => router.push(`${routeBase}/${groupId}/giving` as any)} variant='outline' size='sm' />{data.permissions.manageGiving ? <Button label='Remove link' onPress={() => void mutate('unlink_giving', { givingPurposeId: item.giving_purpose_id }, 'Giving link removed.')} loading={busy === 'unlink_giving'} variant='ghost' size='sm' /> : null}</View>)}{data.permissions.manageGiving && data.availableGivingPurposes.filter((purpose) => !data.givingOptions.some((item) => item.giving_purpose_id === purpose.id)).length ? <><Text style={[styles.label, { color: colors.textMuted }]}>ADD AN APPROVED DESTINATION</Text>{data.availableGivingPurposes.filter((purpose) => !data.givingOptions.some((item) => item.giving_purpose_id === purpose.id)).map((purpose) => <Button key={purpose.id} label={`Add ${purpose.name}`} onPress={() => void mutate('link_giving', { givingPurposeId: purpose.id, label: purpose.name }, 'Giving destination linked.')} loading={busy === 'link_giving'} variant='ghost' size='sm' />)}</> : null}{!data.givingOptions.length ? <EmptyState title='No Group giving link' message={generalGroup ? 'A Group Giving Manager can enable an approved church-wide giving purpose.' : 'A Group Giving Manager can enable an approved purpose from this Expression.'} iconName='gift-outline' /> : null}</> : null}

          {tab === 'people' ? <><View style={styles.heading}><SectionHeader title={canAdmin ? 'Members & admin' : 'Group members'} badge={activeMembers.length} />{data.permissions.assignRoles ? <Button label='New role' onPress={() => setSheet('role')} size='sm' /> : null}</View>{data.members.map((member) => {
            const name = member.profile?.display_name || member.profile?.username || 'Member'; const mine = member.profile?.id === context?.profile?.id; const restricted = member.chat_restricted_until && new Date(member.chat_restricted_until) > new Date();
            return <View key={member.id} style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Avatar url={member.profile?.avatar_url ?? undefined} name={name} size='sm' /><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{name}{mine ? ' · You' : ''}</Text><View style={styles.roleRow}>{member.is_leader ? <Badge label='LEADER' variant='active' /> : null}{member.banned_at ? <Badge label='BANNED' variant='neutral' /> : restricted ? <Badge label='CHAT RESTRICTED' variant='neutral' /> : null}{member.roles.map((role) => <View key={role.id} style={[styles.roleBadge, { borderColor: role.color }]}><Text style={[styles.roleText, { color: role.color }]}>{role.name}</Text></View>)}</View>{data.permissions.assignRoles && member.status === 'active' ? <View style={styles.roleRow}>{data.roles.map((role) => { const assigned = member.roles.some((item) => item.id === role.id); return <Chip key={role.id} label={`${assigned ? '✓ ' : ''}${role.name}`} selected={assigned} onPress={() => void mutate('assign_role', { groupMembershipId: member.id, roleId: role.id, assigned: !assigned }, 'Member role updated.')} />; })}</View> : null}</View>{!mine && canAdmin ? <View style={styles.adminActions}>{data.permissions.manageChat && !member.banned_at ? <Button label={restricted ? 'Unrestrict' : 'Restrict 24h'} onPress={() => void mutate('restrict_member', { groupMembershipId: member.id, until: restricted ? null : new Date(Date.now() + 86400000).toISOString(), reason: restricted ? '' : 'Restricted by a Group administrator' }, restricted ? 'Chat restriction removed.' : 'Member chat restricted for 24 hours.')} variant='ghost' size='sm' /> : null}{data.permissions.manageMembers ? <Button label={member.banned_at ? 'Restore' : 'Ban'} onPress={() => void mutate(member.banned_at ? 'unban_member' : 'ban_member', { groupMembershipId: member.id, reason: 'Group administrator action' }, member.banned_at ? 'Member restored.' : 'Member banned from the Group.')} variant='ghost' size='sm' /> : null}</View> : null}</View>;
          })}</> : null}
        </View>
      </ScrollView>

      <BottomSheet visible={sheet === 'announcement'} onClose={resetSheet} title='New Group announcement'><View style={styles.form}><InputField label='Title' value={title} onChangeText={setTitle} /><InputField label='Message' value={body} onChangeText={setBody} multiline numberOfLines={5} /><Button label='Publish announcement' onPress={() => void createAnnouncement()} loading={busy === 'create_announcement'} /></View></BottomSheet>
      <BottomSheet visible={sheet === 'event'} onClose={resetSheet} title='New Group event' subtitle='Choose dates instead of typing them manually'><View style={styles.form}><InputField label='Title' value={title} onChangeText={setTitle} /><InputField label='Description' value={body} onChangeText={setBody} multiline /><DateTimeField label='Starts' value={startsAt} onChange={setStartsAt} includeTime minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 10} placeholder='Choose start date and time' /><DateTimeField label='Ends (optional)' value={endsAt} onChange={setEndsAt} includeTime minYear={new Date().getFullYear()} maxYear={new Date().getFullYear() + 10} placeholder='Choose end date and time' /><InputField label='Location' value={location} onChangeText={setLocation} /><Button label='Publish event' onPress={() => void createEvent()} loading={busy === 'create_event'} /></View></BottomSheet>
      <BottomSheet visible={sheet === 'section'} onClose={resetSheet} title='Temporary chat' subtitle='Choose exactly who can enter'><View style={styles.form}><InputField label='Room name' value={title} onChangeText={setTitle} /><InputField label='Purpose' value={body} onChangeText={setBody} /><InputField label='Duration in hours' value={roomHours} onChangeText={setRoomHours} keyboardType='number-pad' /><Text style={[styles.label, { color: colors.textMuted }]}>ADD PEOPLE</Text>{activeMembers.map((member) => <Chip key={member.id} label={member.profile?.display_name || member.profile?.username || 'Member'} selected={selectedMembers.includes(member.id)} onPress={() => setSelectedMembers((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} />)}<Button label='Create private room' onPress={() => void createSection()} loading={busy === 'create_section'} /></View></BottomSheet>
      <BottomSheet visible={sheet === 'role'} onClose={resetSheet} title='Create Group role'><View style={styles.form}><InputField label='Role name' value={title} onChangeText={setTitle} /><InputField label='Color' value={roleColor} onChangeText={setRoleColor} autoCapitalize='characters' /><Text style={[styles.label, { color: colors.textMuted }]}>PERMISSIONS</Text><View style={styles.roleRow}>{ROLE_PERMISSIONS.map((permission) => <Chip key={permission.value} label={permission.label} selected={rolePermissions.includes(permission.value)} onPress={() => setRolePermissions((current) => current.includes(permission.value) ? current.filter((item) => item !== permission.value) : [...current, permission.value])} />)}</View><Button label='Create role' onPress={() => void createRole()} loading={busy === 'create_role'} /></View></BottomSheet>
    </View>
  );
}

function Feature({ title, value, icon, onPress }: { title: string; value: number; icon: any; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.feature, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Icon name={icon} size={22} color={colors.interactive} /><Text style={[styles.featureValue, { color: colors.text }]}>{value}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, padding: spacing.lg }, body: { paddingHorizontal: spacing.md, gap: spacing.md }, flex: { flex: 1, minWidth: 0 },
  hero: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, heroIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, heroTitle: { fontSize: 18, fontWeight: '900' },
  tabs: { gap: 6 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, feature: { width: '47%', minHeight: 105, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 5 }, featureValue: { fontSize: 22, fontWeight: '900' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, contentCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, cardTitle: { fontSize: 14, fontWeight: '800' }, copy: { fontSize: 13, lineHeight: 19 }, meta: { fontSize: 10, lineHeight: 14 }, accent: { fontSize: 12, fontWeight: '800' },
  notice: { borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 7 }, noticeText: { flex: 1, fontSize: 11, fontWeight: '700' }, label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  memberCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }, roleBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }, roleText: { fontSize: 9, fontWeight: '800' }, adminActions: { alignItems: 'flex-end', gap: 3 }, form: { gap: spacing.md },
});
