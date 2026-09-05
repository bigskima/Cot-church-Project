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

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [preacher, setPreacher] = useState('');
  const [scripture, setScripture] = useState('');
  const [description, setDescription] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canPublish = hasCapability('sermons.publish') || hasCapability('*');
  const sermons = useResource<Sermon[]>('leadership:sermons', (signal) =>
    api.request<Sermon[]>('sermons', { signal })
  );

  const list = sermons.data ?? [];
  const publishedCount = useMemo(() => list.filter((sermon) => sermon.status === 'published').length, [list]);

  const resetComposer = () => {
    setTitle('');
    setPreacher('');
    setScripture('');
    setDescription('');
    setPublishNow(false);
    setErrorMsg('');
  };

  const handleCreateSermon = async () => {
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

      await api.request('sermons', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          preacher: preacher.trim(),
          scriptures,
          description: description.trim(),
          ...(publishNow && canPublish ? { status: 'published' } : {}),
        }),
      });
      resetComposer();
      setComposerOpen(false);
      setSuccessMsg(
        publishNow && canPublish
          ? `Sermon published${expression?.name ? ` inside ${expression.name}` : ''}.`
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
          rightAction={<Button label="New sermon" onPress={() => setComposerOpen(true)} size="sm" />}
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
            <Button label="Create" onPress={() => setComposerOpen(true)} variant="secondary" size="sm" />
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
                    <Badge
                      label={(sermon.status || 'draft').toUpperCase()}
                      variant={sermon.status === 'published' ? 'success' : 'neutral'}
                    />
                    <Text style={[styles.scopeText, { color: colors.textMuted }]}>
                      {sermon.visibility === 'public' ? 'Public' : expression?.name || 'Expression'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No sermons yet"
                message="Create a sermon draft and attach or process its media through the ministry media workflow."
                iconName="book-outline"
                actionLabel="Create sermon"
                onAction={() => setComposerOpen(true)}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={composerOpen}
        onClose={() => !creating && setComposerOpen(false)}
        title="Create sermon"
        subtitle={expression?.name ? `Inside ${expression.name}` : 'Church-wide sermon'}
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

          {canPublish ? (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SAVE AS</Text>
              <View style={styles.chips}>
                <Chip label="Draft" selected={!publishNow} onPress={() => setPublishNow(false)} />
                <Chip label="Publish now" selected={publishNow} onPress={() => setPublishNow(true)} />
              </View>
            </>
          ) : (
            <View style={[styles.infoCard, { backgroundColor: colors.primarySoft }]}>
              <Icon name="lock-closed-outline" size={16} color={colors.interactive} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>You can create sermon drafts. Publishing remains limited to members with publish permission.</Text>
            </View>
          )}

          <Button
            label={publishNow && canPublish ? 'Publish sermon' : 'Save sermon draft'}
            onPress={() => void handleCreateSermon()}
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
  bannerText: { fontSize: 13, fontWeight: '650', flex: 1 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 1 },
  listSection: { gap: spacing.sm },
  sermonWrap: { marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, marginTop: -spacing.xs },
  scopeText: { fontSize: 11, fontWeight: '650' },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
