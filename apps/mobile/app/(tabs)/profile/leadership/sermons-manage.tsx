import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
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
  SectionHeader,
  SermonCard,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';

export default function SermonsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, hasCapability } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingSermon, setEditingSermon] = useState<Sermon | null>(null);
  const [title, setTitle] = useState('');
  const [preacher, setPreacher] = useState('');
  const [scripture, setScripture] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Sermon['status']>('draft');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canCreate = hasCapability('sermons.create') || hasCapability('*');
  const canManage = hasCapability('sermons.manage') || hasCapability('*');
  const canPublish = hasCapability('sermons.publish') || hasCapability('*');
  const sermons = useResource<Sermon[]>(`leadership:sermons:${organizationId || 'none'}:${expression?.id ?? 'general'}`, (signal) =>
    api.request<Sermon[]>('sermons?view=manage', { signal })
  );

  const list = sermons.data ?? [];
  const publishedCount = useMemo(() => list.filter((sermon) => sermon.status === 'published').length, [list]);

  const resetComposer = () => {
    setEditingSermon(null);
    setTitle('');
    setPreacher('');
    setScripture('');
    setDescription('');
    setStatus('draft');
    setErrorMsg('');
  };

  const openCreate = () => {
    if (!canCreate) return;
    resetComposer();
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const openEdit = (sermon: Sermon) => {
    if (!canManage) return;
    setEditingSermon(sermon);
    setTitle(sermon.title ?? '');
    setPreacher(sermon.preacher ?? sermon.preacher_name ?? '');
    setScripture((sermon.scripture_references ?? []).join(', '));
    setDescription(sermon.description ?? '');
    setStatus(sermon.status ?? 'draft');
    setErrorMsg('');
    setSuccessMsg('');
    setComposerOpen(true);
  };

  const handleSaveSermon = async () => {
    if (editingSermon ? !canManage : !canCreate) return;
    if (!title.trim() || !preacher.trim()) {
      setErrorMsg('Enter both a sermon title and speaker.');
      return;
    }
    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const scriptures = scripture
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const isEditing = Boolean(editingSermon);
      if ((status === 'published' || status === 'scheduled') && !canPublish) {
        setErrorMsg('Publishing sermons requires publish permission.');
        return;
      }
      const basePayload = {
        title: title.trim(),
        preacher: preacher.trim(),
        scriptures,
        description: description.trim(),
      };
      await api.request('sermons', {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(
          isEditing
            ? {
                id: editingSermon!.id,
                ...basePayload,
                ...(status !== editingSermon!.status ? { status } : {}),
              }
            : { ...basePayload, status },
        ),
      });
      setComposerOpen(false);
      resetComposer();
      setSuccessMsg(
        isEditing
          ? 'Sermon updated.'
          : status === 'published'
            ? `Sermon published${expression?.name ? ` inside ${expression.name}` : ''}.`
            : status === 'review'
              ? 'Sermon saved for review.'
              : 'Sermon draft created.',
      );
      sermons.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create sermon.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <ScreenHeader
          title="Sermons"
          kicker="LEADERSHIP"
          subtitle={expression?.name ? `Sermon library for ${expression.name}.` : 'Church sermon library and publishing.'}
          showBack
          rightAction={canCreate ? <Button label="New sermon" onPress={openCreate} size="sm" /> : undefined}
        />

        <View style={styles.body}>
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{successMsg}</Text>
            </View>
          ) : null}

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="book-outline" size={22} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{publishedCount}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Published in this scope</Text>
            </View>
{canCreate ? <Button label="Create" onPress={openCreate} variant="secondary" size="sm" /> : null}
          </View>

          <View style={styles.listSection}>
            <SectionHeader title="Sermon library" badge={list.length} subtitle={expression?.name ? 'Expression-scoped teachings' : 'Church-wide teachings'} />
            {sermons.loading ? (
              <Skeleton height={100} count={3} />
            ) : sermons.error && !sermons.data ? (
              <ResourceError message={sermons.error} retry={sermons.refresh} />
            ) : list.length ? (
              list.map((sermon) => (
                <View key={sermon.id} style={styles.sermonWrap}>
                  <SermonCard
                    sermon={sermon}
                    variant="row"
                    onPress={() => router.push(`/sermon/${sermon.id}${expression?.id ? '?context=expression' : ''}` as any)}
                  />
                  <View style={styles.statusRow}>
                    <View style={styles.statusMeta}>
                      <Badge
                        label={(sermon.status || 'draft').toUpperCase()}
                        variant={sermon.status === 'published' ? 'success' : 'neutral'}
                      />
                      <Text style={[styles.scopeText, { color: colors.textMuted }]}>
                        {sermon.visibility === 'public' ? 'Public' : expression?.name || 'Expression'}
                      </Text>
                    </View>
                    {canManage ? <Button label="Edit" onPress={() => openEdit(sermon)} variant="outline" size="sm" /> : null}
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No sermons yet"
                message={canCreate ? 'Create a sermon draft and attach or process its media through the ministry media workflow.' : 'Sermons in this management scope will appear here.'}
                iconName="book-outline"
                actionLabel={canCreate ? 'Create sermon' : undefined}
                onAction={canCreate ? openCreate : undefined}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={composerOpen}
        onClose={() => {
          if (!creating) {
            setComposerOpen(false);
            resetComposer();
          }
        }}
        title={editingSermon ? 'Edit sermon' : 'Create sermon'}
        subtitle={editingSermon ? editingSermon.title : expression?.name ? `Inside ${expression.name}` : 'Church-wide sermon'}
        maxHeightPercent={94}
      >
        <View style={styles.form}>
          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
              <Icon name="alert-circle" size={18} color={colors.live} />
              <Text style={[styles.bannerText, { color: colors.live }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <InputField label="Sermon title" value={title} onChangeText={setTitle} placeholder="Walking in divine alignment" />
          <InputField label="Speaker" value={preacher} onChangeText={setPreacher} placeholder="Pastor / minister name" />
          <InputField label="Scripture references" value={scripture} onChangeText={setScripture} placeholder="Romans 8:28, Hebrews 11:1" helperText="Separate multiple passages with commas." />
          <InputField label="Notes / summary" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Add sermon notes or a short summary…" />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text>
          <View style={styles.chips}>
            <Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} />
            <Chip label="Review" selected={status === 'review'} onPress={() => setStatus('review')} />
            {editingSermon ? <Chip label="Archived" selected={status === 'archived'} onPress={() => setStatus('archived')} /> : null}
            {canPublish ? <Chip label="Published" selected={status === 'published'} onPress={() => setStatus('published')} /> : null}
          </View>
          {!canPublish ? (
            <View style={[styles.infoCard, { backgroundColor: colors.primarySoft }]}>
              <Icon name="lock-closed-outline" size={16} color={colors.interactive} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Publishing remains limited to members with sermon publish permission.</Text>
            </View>
          ) : null}

          <Button
            label={editingSermon ? 'Save changes' : status === 'published' ? 'Publish sermon' : status === 'review' ? 'Save for review' : 'Save sermon draft'}
            onPress={() => void handleSaveSermon()}
            loading={creating}
            size="lg"
            fullWidth
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.xl },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  bannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 1 },
  listSection: { gap: spacing.sm },
  sermonWrap: { marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.xs, marginTop: -spacing.xs },
  statusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  scopeText: { fontSize: 11, fontWeight: '600' },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
