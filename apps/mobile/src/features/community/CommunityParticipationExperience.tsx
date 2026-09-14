import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  Skeleton,
} from '@/components';
import { DateTimeField } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Scope = 'general' | 'expression';
type PollOption = {
  id: string;
  label: string;
  displayOrder?: number;
  votes: number;
  selected: boolean;
};
type Poll = {
  id: string;
  question: string;
  description: string;
  status: string;
  allows_multiple: boolean;
  closes_at?: string | null;
  created_at: string;
  author_profile_id: string;
  options: PollOption[];
  viewer_has_voted: boolean;
};
type Winner = {
  profileId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  giftNote?: string | null;
  fulfilledAt?: string | null;
  selectedAt?: string | null;
};
type Giveaway = {
  id: string;
  title: string;
  description: string;
  prize_description: string;
  status: string;
  winners_count: number;
  opens_at?: string | null;
  closes_at?: string | null;
  created_at: string;
  host_profile_id: string;
  host_name?: string | null;
  viewer_entered: boolean;
  entry_count: number;
  winners: Winner[];
};
type ParticipationData = { polls: Poll[]; giveaways: Giveaway[] };

function safeOptions(value: unknown): PollOption[] {
  return Array.isArray(value) ? value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? ''),
      label: String(row.label ?? ''),
      displayOrder: Number(row.displayOrder ?? 0),
      votes: Number(row.votes ?? 0),
      selected: Boolean(row.selected),
    };
  }).filter((item) => item.id && item.label) : [];
}

function safeWinners(value: unknown): Winner[] {
  return Array.isArray(value) ? value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      profileId: String(row.profileId ?? ''),
      displayName: row.displayName == null ? null : String(row.displayName),
      avatarUrl: row.avatarUrl == null ? null : String(row.avatarUrl),
      giftNote: row.giftNote == null ? null : String(row.giftNote),
      fulfilledAt: row.fulfilledAt == null ? null : String(row.fulfilledAt),
      selectedAt: row.selectedAt == null ? null : String(row.selectedAt),
    };
  }).filter((item) => item.profileId) : [];
}

function dateLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function CommunityParticipationExperience({ scope, expressionId }: { scope: Scope; expressionId?: string }) {
  const { tab: routeTab, compose: routeCompose, intentId } = useLocalSearchParams<{ tab?: string; compose?: string; intentId?: string }>();
  const { auth, context, mode, accessReady, hasCapability, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const organizationId = scope === 'expression'
    ? context?.expressions?.find((item) => item.id === expressionId)?.organizationId ?? context?.organization?.id ?? ''
    : context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const branchId = scope === 'expression' ? expressionId ?? null : null;
  const accessToken = auth?.session.accessToken ?? null;
  const canCreatePoll = mode === 'authenticated' && (scope === 'general' ? hasOrganizationCapability('polls.manage') : hasCapability('polls.manage'));
  const canHostGiveaway = mode === 'authenticated' && Boolean(organizationId) && (scope === 'general' || Boolean(branchId));
  const viewerProfileId = context?.profile?.id ?? '';
  const requestedTab: 'polls' | 'giveaways' = routeTab === 'giveaways' || routeCompose === 'giveaway' ? 'giveaways' : 'polls';
  const requestedCompose = routeCompose === 'poll' || routeCompose === 'giveaway' ? routeCompose : null;
  const routeIntent = `${scope}:${expressionId ?? 'general'}:${requestedTab}:${requestedCompose ?? 'browse'}:${intentId ?? 'initial'}`;
  const handledRouteIntent = useRef<string | null>(null);

  const [tab, setTab] = useState<'polls' | 'giveaways'>(requestedTab);
  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  const [giveawayComposerOpen, setGiveawayComposerOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [pollClosesAt, setPollClosesAt] = useState<Date | null>(null);
  const [giveawayTitle, setGiveawayTitle] = useState('');
  const [giveawayDescription, setGiveawayDescription] = useState('');
  const [prize, setPrize] = useState('');
  const [winnerCount, setWinnerCount] = useState('1');
  const [giveawayClosesAt, setGiveawayClosesAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (handledRouteIntent.current === routeIntent) return;
    setTab(requestedTab);

    if (!requestedCompose) {
      handledRouteIntent.current = routeIntent;
      return;
    }
    if (!accessReady) return;

    if (requestedCompose === 'poll') {
      if (canCreatePoll) {
        setError('');
        setPollComposerOpen(true);
      } else if (mode === 'authenticated') {
        setError('Official poll publishing is available only to members with poll publishing access.');
      }
      handledRouteIntent.current = routeIntent;
      return;
    }

    if (canHostGiveaway) {
      setError('');
      setGiveawayComposerOpen(true);
      handledRouteIntent.current = routeIntent;
    } else if (mode !== 'authenticated' || organizationId) {
      handledRouteIntent.current = routeIntent;
    }
  }, [accessReady, canCreatePoll, canHostGiveaway, mode, organizationId, requestedCompose, requestedTab, routeIntent]);

  const resource = useResource<ParticipationData>(
    `participation:${scope}:${organizationId || 'none'}:${branchId ?? 'general'}:${mode}`,
    async () => {
      if (!organizationId) return { polls: [], giveaways: [] };
      const client = await getRuntimeSupabase(accessToken);
      const pollsResult = await client.rpc('community_poll_feed', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
      });
      if (pollsResult.error) throw new Error(pollsResult.error.message);
      const polls = (Array.isArray(pollsResult.data) ? pollsResult.data : []).map((row: any) => ({ ...row, options: safeOptions(row.options) })) as Poll[];

      if (mode !== 'authenticated') return { polls, giveaways: [] };
      const giveawaysResult = await client.rpc('community_giveaway_feed', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
      });
      if (giveawaysResult.error) throw new Error(giveawaysResult.error.message);
      const giveaways = (Array.isArray(giveawaysResult.data) ? giveawaysResult.data : []).map((row: any) => ({ ...row, winners: safeWinners(row.winners) })) as Giveaway[];
      return { polls, giveaways };
    },
  );

  const polls = resource.data?.polls ?? [];
  const giveaways = resource.data?.giveaways ?? [];
  const expressionName = branchId ? context?.expressions?.find((item) => item.id === branchId)?.name ?? context?.expression?.name : null;
  const openPollCount = useMemo(() => polls.filter((item) => item.status === 'open' && (!item.closes_at || Date.parse(item.closes_at) > Date.now())).length, [polls]);

  const clearMessages = () => { setError(''); setSuccess(''); };
  const resetPoll = () => {
    setQuestion(''); setPollDescription(''); setPollOptions(['', '']); setAllowMultiple(false); setPollClosesAt(null);
  };
  const resetGiveaway = () => {
    setGiveawayTitle(''); setGiveawayDescription(''); setPrize(''); setWinnerCount('1'); setGiveawayClosesAt(null);
  };

  const createPoll = async () => {
    const options = pollOptions.map((item) => item.trim()).filter(Boolean);
    if (!question.trim()) return setError('Enter a poll question.');
    if (options.length < 2) return setError('Add at least two poll options.');
    setSaving(true); clearMessages();
    try {
      const client = await getRuntimeSupabase(accessToken);
      const result = await client.rpc('create_community_poll', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
        poll_question: question.trim(),
        poll_description: pollDescription.trim(),
        option_labels: options,
        allow_multiple: allowMultiple,
        close_at: pollClosesAt?.toISOString() ?? null,
        poll_visibility: scope === 'general' ? 'public' : 'members',
      });
      if (result.error) throw new Error(result.error.message);
      resetPoll(); setPollComposerOpen(false); setSuccess('Poll published.'); resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to create poll.');
    } finally { setSaving(false); }
  };

  const vote = async (poll: Poll) => {
    if (mode !== 'authenticated') {
      router.push({ pathname: '/(auth)/login', params: { returnTo: scope === 'general' ? '/general/participate' : `/expressions/${branchId}/participate` } } as any);
      return;
    }
    const selected = selections[poll.id] ?? poll.options.filter((item) => item.selected).map((item) => item.id);
    if (!selected.length) return setError('Choose an option first.');
    setActionId(poll.id); clearMessages();
    try {
      const client = await getRuntimeSupabase(accessToken);
      const result = await client.rpc('vote_community_poll', { target_poll_id: poll.id, target_option_ids: selected });
      if (result.error) throw new Error(result.error.message);
      setSelections((current) => ({ ...current, [poll.id]: [] }));
      resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to vote.'); }
    finally { setActionId(null); }
  };

  const toggleOption = (poll: Poll, optionId: string) => {
    const existing = selections[poll.id] ?? poll.options.filter((item) => item.selected).map((item) => item.id);
    const next = poll.allows_multiple
      ? existing.includes(optionId) ? existing.filter((id) => id !== optionId) : [...existing, optionId]
      : [optionId];
    setSelections((current) => ({ ...current, [poll.id]: next }));
  };

  const createGiveaway = async () => {
    const winners = Number(winnerCount);
    if (!giveawayTitle.trim() || !prize.trim()) return setError('Add a title and describe the prize.');
    if (!Number.isInteger(winners) || winners < 1 || winners > 100) return setError('Winner count must be between 1 and 100.');
    setSaving(true); clearMessages();
    try {
      const client = await getRuntimeSupabase(accessToken);
      const result = await client.rpc('create_community_giveaway', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
        giveaway_title: giveawayTitle.trim(),
        giveaway_description: giveawayDescription.trim(),
        prize: prize.trim(),
        number_of_winners: winners,
        open_at: null,
        close_at: giveawayClosesAt?.toISOString() ?? null,
        giveaway_visibility: scope === 'general' ? 'public' : 'members',
      });
      if (result.error) throw new Error(result.error.message);
      resetGiveaway(); setGiveawayComposerOpen(false); setSuccess('Giveaway is open.'); resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to host giveaway.'); }
    finally { setSaving(false); }
  };

  const enterGiveaway = async (giveaway: Giveaway) => {
    setActionId(giveaway.id); clearMessages();
    try {
      const client = await getRuntimeSupabase(accessToken);
      const result = await client.rpc('enter_community_giveaway', { target_giveaway_id: giveaway.id });
      if (result.error) throw new Error(result.error.message);
      setSuccess('You joined the giveaway.'); resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to enter giveaway.'); }
    finally { setActionId(null); }
  };

  const drawGiveaway = async (giveaway: Giveaway) => {
    setActionId(giveaway.id); clearMessages();
    try {
      const client = await getRuntimeSupabase(accessToken);
      const result = await client.rpc('draw_community_giveaway', { target_giveaway_id: giveaway.id });
      if (result.error) throw new Error(result.error.message);
      setSuccess('Winners selected and recorded.'); resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to draw winners.'); }
    finally { setActionId(null); }
  };

  const markWinnerFulfilled = async (giveaway: Giveaway, winner: Winner) => {
    const fulfillmentActionId = `fulfill:${giveaway.id}:${winner.profileId}`;
    setActionId(fulfillmentActionId); clearMessages();
    try {
      const client = await getRuntimeSupabase(accessToken);
      const result = await client.rpc('mark_giveaway_winner_fulfilled', {
        target_giveaway_id: giveaway.id,
        target_profile_id: winner.profileId,
        fulfillment_note: '',
      });
      if (result.error) throw new Error(result.error.message);
      setSuccess(`Prize fulfillment recorded for ${winner.displayName || 'the selected winner'}.`);
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to record prize fulfillment.');
    } finally { setActionId(null); }
  };

  const renderPoll = (poll: Poll) => {
    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
    const selected = selections[poll.id] ?? poll.options.filter((item) => item.selected).map((item) => item.id);
    const closed = poll.status !== 'open' || Boolean(poll.closes_at && Date.parse(poll.closes_at) <= Date.now());
    return (
      <View key={poll.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}><Icon name="stats-chart-outline" size={20} color={colors.interactive} /></View>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{poll.question}</Text>
            {poll.description ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{poll.description}</Text> : null}
          </View>
          <Badge label={closed ? 'CLOSED' : 'OPEN'} variant={closed ? 'neutral' : 'active'} />
        </View>
        <View style={styles.optionStack}>
          {poll.options.map((option) => {
            const active = selected.includes(option.id);
            const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
            return (
              <Pressable key={option.id} disabled={closed} onPress={() => toggleOption(poll, option.id)} style={[styles.option, { backgroundColor: active ? colors.primarySoft : colors.bgSecondary, borderColor: active ? colors.interactive : colors.borderSubtle }]}>
                <View style={[styles.choiceDot, { borderColor: active ? colors.interactive : colors.textMuted }, active && { backgroundColor: colors.interactive }]} />
                <View style={styles.flex}><Text style={[styles.optionText, { color: colors.text }]}>{option.label}</Text>{poll.viewer_has_voted || closed ? <Text style={[styles.optionMeta, { color: colors.textMuted }]}>{option.votes} vote{option.votes === 1 ? '' : 's'} · {percent}%</Text> : null}</View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{poll.allows_multiple ? 'Multiple choices allowed' : 'Choose one'}{poll.closes_at ? ` · closes ${dateLabel(poll.closes_at)}` : ''}</Text>
          {!closed ? <Button label={poll.viewer_has_voted ? 'Update vote' : 'Vote'} onPress={() => void vote(poll)} loading={actionId === poll.id} size="sm" /> : null}
        </View>
      </View>
    );
  };

  const renderGiveaway = (giveaway: Giveaway) => {
    const host = giveaway.host_profile_id === viewerProfileId;
    const closedByTime = Boolean(giveaway.closes_at && Date.parse(giveaway.closes_at) <= Date.now());
    const canDraw = host && giveaway.status === 'open' && (!giveaway.closes_at || closedByTime);
    return (
      <View key={giveaway.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}><Icon name="gift-outline" size={21} color={colors.interactive} /></View>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{giveaway.title}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Hosted by {giveaway.host_name || 'a COT member'}</Text>
          </View>
          <Badge label={giveaway.status.toUpperCase()} variant={giveaway.status === 'open' ? 'active' : giveaway.status === 'completed' ? 'success' : 'neutral'} />
        </View>
        <View style={[styles.prize, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.prizeLabel, { color: colors.interactive }]}>PRIZE</Text>
          <Text style={[styles.prizeText, { color: colors.text }]}>{giveaway.prize_description}</Text>
        </View>
        {giveaway.description ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{giveaway.description}</Text> : null}
        {giveaway.winners?.length ? (
          <View style={styles.winnersWrap}>
            <Text style={[styles.smallLabel, { color: colors.textMuted }]}>WINNER{giveaway.winners.length === 1 ? '' : 'S'}</Text>
            {giveaway.winners.map((winner) => {
              const fulfillmentActionId = `fulfill:${giveaway.id}:${winner.profileId}`;
              return (
                <View key={winner.profileId} style={styles.winnerRow}>
                  <Icon name="trophy-outline" size={16} color={colors.interactive} />
                  <View style={styles.flex}>
                    <Text style={[styles.winnerText, { color: colors.text }]}>{winner.displayName || 'COT member'}</Text>
                    {winner.fulfilledAt ? <Text style={[styles.meta, { color: colors.textMuted }]}>Prize fulfilled {dateLabel(winner.fulfilledAt)}</Text> : null}
                  </View>
                  {winner.fulfilledAt ? (
                    <Badge label="FULFILLED" variant="success" />
                  ) : host && giveaway.status === 'completed' ? (
                    <Button label="Mark fulfilled" onPress={() => void markWinnerFulfilled(giveaway, winner)} loading={actionId === fulfillmentActionId} variant="outline" size="sm" />
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{giveaway.winners_count} winner{giveaway.winners_count === 1 ? '' : 's'}{giveaway.closes_at ? ` · closes ${dateLabel(giveaway.closes_at)}` : ''}{host ? ` · ${giveaway.entry_count} entries` : ''}</Text>
          {giveaway.status === 'open' && !host ? <Button label={giveaway.viewer_entered ? 'Entered' : 'Join'} disabled={giveaway.viewer_entered} onPress={() => void enterGiveaway(giveaway)} loading={actionId === giveaway.id} size="sm" /> : null}
          {canDraw ? <Button label="Draw winners" onPress={() => void drawGiveaway(giveaway)} loading={actionId === giveaway.id} size="sm" /> : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Community participation" kicker={scope === 'general' ? 'GENERAL COT' : 'EXPRESSION'} subtitle={scope === 'general' ? 'Vote in official polls and join member-hosted giveaways.' : `Polls and giveaways inside ${expressionName || 'this Expression'}.`} showBack />

        {error ? <Pressable onPress={() => setError('')} style={[styles.message, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={17} color={colors.live} /><Text style={[styles.messageText, { color: colors.live }]}>{error}</Text></Pressable> : null}
        {success ? <Pressable onPress={() => setSuccess('')} style={[styles.message, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle-outline" size={17} color={colors.success} /><Text style={[styles.messageText, { color: colors.success }]}>{success}</Text></Pressable> : null}

        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.flex}><Text style={[styles.summaryValue, { color: colors.text }]}>{openPollCount}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>open poll{openPollCount === 1 ? '' : 's'}</Text></View>
          <View style={styles.summaryActions}>
            {canCreatePoll ? <Button label="New poll" onPress={() => { clearMessages(); setPollComposerOpen(true); }} variant="outline" size="sm" /> : null}
            {canHostGiveaway ? <Button label="Host giveaway" onPress={() => { clearMessages(); setGiveawayComposerOpen(true); }} size="sm" /> : null}
          </View>
        </View>

        <View style={styles.tabs}>
          <Chip label={`Polls (${polls.length})`} selected={tab === 'polls'} onPress={() => setTab('polls')} />
          <Chip label={`Giveaways (${giveaways.length})`} selected={tab === 'giveaways'} onPress={() => setTab('giveaways')} />
        </View>

        {resource.loading && !resource.data ? <Skeleton height={170} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : tab === 'polls' ? (
          polls.length ? <View style={styles.stack}>{polls.map(renderPoll)}</View> : <EmptyState title="No polls yet" message={canCreatePoll ? 'Create the first official poll for this space.' : 'Authorized leaders can publish polls here.'} iconName="stats-chart-outline" />
        ) : mode !== 'authenticated' ? (
          <EmptyState title="Sign in for giveaways" message="Giveaways are a member participation feature." iconName="gift-outline" actionLabel="Sign in" onAction={() => router.push({ pathname: '/(auth)/login', params: { returnTo: scope === 'general' ? '/general/participate' : `/expressions/${branchId}/participate` } } as any)} />
        ) : giveaways.length ? <View style={styles.stack}>{giveaways.map(renderGiveaway)}</View> : <EmptyState title="No giveaways yet" message="Any member can host a giveaway and record the selected winners here." iconName="gift-outline" actionLabel={canHostGiveaway ? 'Host giveaway' : undefined} onAction={canHostGiveaway ? () => setGiveawayComposerOpen(true) : undefined} />}
      </ScrollView>

      <BottomSheet visible={pollComposerOpen} onClose={() => !saving && setPollComposerOpen(false)} title="Create poll" subtitle="Official polls require poll publishing permission." maxHeightPercent={94}>
        <View style={styles.form}>
          <InputField label="Question" value={question} onChangeText={setQuestion} placeholder="What should the community decide or respond to?" />
          <InputField label="Context (optional)" value={pollDescription} onChangeText={setPollDescription} multiline numberOfLines={3} placeholder="Add helpful context…" />
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>OPTIONS</Text>
          {pollOptions.map((option, index) => <InputField key={index} label={`Option ${index + 1}`} value={option} onChangeText={(value) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder={`Choice ${index + 1}`} />)}
          <View style={styles.inlineActions}>
            {pollOptions.length < 12 ? <Button label="Add option" onPress={() => setPollOptions((current) => [...current, ''])} variant="outline" size="sm" /> : null}
            {pollOptions.length > 2 ? <Button label="Remove last" onPress={() => setPollOptions((current) => current.slice(0, -1))} variant="outline" size="sm" /> : null}
          </View>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>VOTING</Text>
          <View style={styles.tabs}><Chip label="One choice" selected={!allowMultiple} onPress={() => setAllowMultiple(false)} /><Chip label="Multiple choices" selected={allowMultiple} onPress={() => setAllowMultiple(true)} /></View>
          <DateTimeField label="Closing date (optional)" value={pollClosesAt} onChange={setPollClosesAt} helperText="Leave empty if you want to close the poll manually later." />
          <Button label="Publish poll" onPress={() => void createPoll()} loading={saving} size="lg" fullWidth />
        </View>
      </BottomSheet>

      <BottomSheet visible={giveawayComposerOpen} onClose={() => !saving && setGiveawayComposerOpen(false)} title="Host giveaway" subtitle="No payment or purchase is required to enter." maxHeightPercent={94}>
        <View style={styles.form}>
          <InputField label="Giveaway title" value={giveawayTitle} onChangeText={setGiveawayTitle} placeholder="Community appreciation giveaway" />
          <InputField label="Prize" value={prize} onChangeText={setPrize} multiline numberOfLines={3} placeholder="Describe exactly what the winner receives." />
          <InputField label="Description (optional)" value={giveawayDescription} onChangeText={setGiveawayDescription} multiline numberOfLines={3} placeholder="Rules or a short note for participants." />
          <InputField label="Number of winners" value={winnerCount} onChangeText={setWinnerCount} keyboardType="number-pad" placeholder="1" />
          <DateTimeField label="Closing date (optional)" value={giveawayClosesAt} onChange={setGiveawayClosesAt} helperText="After this time the host can draw winners." />
          <View style={[styles.info, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={17} color={colors.interactive} /><Text style={[styles.infoText, { color: colors.textSecondary }]}>COT records entrants and selected winners. Prize fulfillment is handled by the host; online payment is not required.</Text></View>
          <Button label="Open giveaway" onPress={() => void createGiveaway()} loading={saving} size="lg" fullWidth />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: spacing.md, paddingBottom: 120, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  message: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  messageText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  summary: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryValue: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { fontSize: 11.5, marginTop: 1 },
  summaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'flex-end' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stack: { gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  iconBox: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  copy: { fontSize: 12.5, lineHeight: 19, marginTop: 3 },
  meta: { fontSize: 10.5, lineHeight: 15 },
  optionStack: { gap: spacing.xs },
  option: { minHeight: 52, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  choiceDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  optionText: { fontSize: 13, fontWeight: '800' },
  optionMeta: { fontSize: 10, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  prize: { borderRadius: radius.lg, padding: spacing.md, gap: 3 },
  prizeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  prizeText: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
  winnersWrap: { gap: spacing.xs },
  winnerRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  winnerText: { fontSize: 12.5, fontWeight: '800' },
  smallLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  form: { gap: spacing.md },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  info: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
});