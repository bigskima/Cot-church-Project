import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';

export default function SermonsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [preacher, setPreacher] = useState('');
  const [scripture, setScripture] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const sermons = useResource<Sermon[]>('leadership:sermons', (signal) =>
    api.request<Sermon[]>('sermons', { signal })
  );

  const handleCreateSermon = async () => {
    if (!title.trim() || !preacher.trim()) {
      setErrorMsg('Please provide both a title and preacher name.');
      return;
    }
    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Correctly split comma-separated scriptures
      const scripturesArray = scripture
        ? scripture
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

      await api.request('sermons', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          preacher: preacher.trim(),
          scriptures: scripturesArray,
          description: description.trim(),
          status: 'published',
          visibility: 'public',
        }),
      });
      setTitle('');
      setPreacher('');
      setScripture('');
      setDescription('');
      setSuccessMsg('Sermon teaching published to global library.');
      sermons.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to publish sermon.');
    } finally {
      setCreating(false);
    }
  };

  const list = sermons.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 60 },
        ]}
      >
        <ScreenHeader
          title="Sermons & Media Publishing"
          subtitle="Publish expository teachings, assign scripture references, and manage series."
          showBack
        />

        <View style={styles.body}>
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(22, 163, 106, 0.12)', borderColor: 'rgba(22, 163, 106, 0.3)' }]}>
              <Icon name="checkmark-circle" size={18} color="#16A36A" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#16A36A' }]}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.3)' }]}>
              <Icon name="alert-circle" size={18} color="#E5484D" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#E5484D' }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Create Sermon Form Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="book-outline" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Publish New Sermon</Text>
            </View>

            <InputField
              label="Sermon Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Walking in Divine Alignment"
            />

            <InputField
              label="Preacher / Speaker"
              value={preacher}
              onChangeText={setPreacher}
              placeholder="e.g. Pastor David"
            />

            <InputField
              label="Scripture References (Comma-Separated)"
              value={scripture}
              onChangeText={setScripture}
              placeholder="e.g. Romans 8:28, Hebrews 11:1"
            />

            <InputField
              label="Summary Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder="Expository breakdown, sermon notes..."
            />

            <Button
              label="Publish Teaching"
              onPress={handleCreateSermon}
              loading={creating}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Published Sermons List */}
          <View style={styles.listSection}>
            <SectionHeader title="Published Sermon Archives" badge={list.length} />
            {sermons.loading ? (
              <Skeleton height={80} count={3} />
            ) : sermons.error && !sermons.data ? (
              <ResourceError message={sermons.error} retry={sermons.refresh} />
            ) : list.length > 0 ? (
              list.map((sermon) => (
                <View
                  key={sermon.id}
                  style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                >
                  <View style={styles.tileInfo}>
                    <Text style={[styles.tileTitle, { color: colors.text }]}>{sermon.title}</Text>
                    {sermon.preacher ? (
                      <Text style={[styles.tilePreacher, { color: colors.interactive }]}>
                        {sermon.preacher}
                      </Text>
                    ) : null}
                    {sermon.sermon_date ? (
                      <Text style={[styles.tileDate, { color: colors.textMuted }]}>
                        {new Date(sermon.sermon_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label={sermon.status?.toUpperCase() || 'PUBLISHED'} variant="primary" />
                </View>
              ))
            ) : (
              <EmptyState
                title="No Sermons Published"
                message="Use the form above to publish your first sermon recording."
                iconName="book-outline"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  listSection: {
    gap: spacing.xs,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  tileInfo: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tilePreacher: {
    fontSize: 12,
    fontWeight: '600',
  },
  tileDate: {
    fontSize: 11,
  },
});
